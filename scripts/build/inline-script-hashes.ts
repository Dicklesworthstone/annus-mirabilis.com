import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import type {
  InlineScriptRegistry,
  InlineScriptRegistryEntry,
  InlineScriptRoutes,
} from "../../src/app/inline-scripts/registry.ts";
import { INLINE_SCRIPT_REGISTRY } from "../../src/app/inline-scripts/registry.ts";
import {
  appendLogLine,
  evidenceDirFor,
  logPathFor,
  newLogRunId,
  writeEvidenceFile,
} from "../scaffold/logLine.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SUITE = "inline-script-hashes";
const BEAD_ID = "am-scaf-nextjs-app-bu2";

// ---------------------------------------------------------------------------
// Pure functions over parsed inputs. No filesystem or process access below
// this line except inside the CLI section at the bottom of the file.
// ---------------------------------------------------------------------------

export function sha256Base64(source: string): string {
  return createHash("sha256").update(source, "utf8").digest("base64");
}

export type InlineScriptManifestEntry = {
  id: string;
  ownerBeadId: string;
  routes: InlineScriptRoutes;
  sha256: string;
  length: number;
};

export type InlineScriptHashManifest = {
  buildRevision: string;
  generatedAt: string;
  scripts: InlineScriptManifestEntry[];
};

/**
 * Deterministic: calling this twice with the same registry, buildRevision,
 * and generatedAt produces byte-identical JSON (sorted by id).
 */
export function buildInlineScriptHashManifest(
  registry: InlineScriptRegistry,
  options: { buildRevision: string; generatedAt: string },
): InlineScriptHashManifest {
  const scripts = registry
    .map((entry) => ({
      id: entry.id,
      ownerBeadId: entry.ownerBeadId,
      routes: entry.routes,
      sha256: sha256Base64(entry.source),
      length: Buffer.byteLength(entry.source, "utf8"),
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { buildRevision: options.buildRevision, generatedAt: options.generatedAt, scripts };
}

export function serializeInlineScriptHashManifest(manifest: InlineScriptHashManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export type FoundInlineScript = {
  source: string;
  sha256: string;
  excerpt: string;
};

/**
 * Elements without a `src` carry hashable content; an inline
 * `<script src="...">` is ignored because its bytes are not emitted inline.
 */
export function extractInlineScripts(html: string): FoundInlineScript[] {
  const found: FoundInlineScript[] = [];
  const scriptTagPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptTagPattern.exec(html)) !== null) {
    const attrs = match[1] ?? "";
    const source = match[2] ?? "";
    if (/\bsrc\s*=/i.test(attrs)) continue;
    found.push({ source, sha256: sha256Base64(source), excerpt: source.slice(0, 200) });
  }
  return found;
}

function entryAppliesToRoute(entry: InlineScriptRegistryEntry, route: string): boolean {
  return entry.routes === "all" || entry.routes.includes(route);
}

export type InlineScriptCheckIssue =
  | { kind: "unregistered-script"; route: string; sha256: string; excerpt: string }
  | { kind: "stale-entry"; id: string; ownerBeadId: string };

/**
 * Scans the built HTML of every prerendered route for inline scripts and
 * matches each one against the registry by exact byte content (never by id
 * alone, because a CSP hash is byte-exact): a script has no matching entry,
 * or a registered entry that no route emits (a trailing-whitespace-only
 * difference from the registered `source` fails here as an unregistered
 * script, which is the correct outcome for a byte-exact hash).
 */
export function checkInlineScriptsAgainstRegistry(
  registry: InlineScriptRegistry,
  htmlByRoute: Readonly<Record<string, string>>,
): InlineScriptCheckIssue[] {
  const issues: InlineScriptCheckIssue[] = [];
  const seenEntryIds = new Set<string>();

  for (const [route, html] of Object.entries(htmlByRoute)) {
    const applicable = registry.filter((entry) => entryAppliesToRoute(entry, route));
    for (const found of extractInlineScripts(html)) {
      const matchedEntry = applicable.find((entry) => entry.source === found.source);
      if (matchedEntry) {
        seenEntryIds.add(matchedEntry.id);
      } else {
        issues.push({
          kind: "unregistered-script",
          route,
          sha256: found.sha256,
          excerpt: found.excerpt,
        });
      }
    }
  }

  for (const entry of registry) {
    if (!seenEntryIds.has(entry.id)) {
      issues.push({ kind: "stale-entry", id: entry.id, ownerBeadId: entry.ownerBeadId });
    }
  }

  return issues;
}

export function formatInlineScriptCheckIssue(issue: InlineScriptCheckIssue): string {
  if (issue.kind === "unregistered-script") {
    return `unregistered inline script on route ${issue.route} (sha256=${issue.sha256}): ${JSON.stringify(issue.excerpt)}`;
  }
  return `stale registry entry "${issue.id}" (owner ${issue.ownerBeadId}): no prerendered route emits it`;
}

// ---------------------------------------------------------------------------
// Thin CLI: reads the real build output and the real registry, then calls
// the pure functions above. Supports two modes:
//   bun scripts/build/inline-script-hashes.ts           (write + check)
//   bun scripts/build/inline-script-hashes.ts --check    (verify only)
// ---------------------------------------------------------------------------

async function walkHtmlFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = join(dir, name);
      const info = await stat(full);
      if (info.isDirectory()) await walk(full);
      else if (info.isFile() && name.endsWith(".html")) results.push(full);
    }
  }
  await walk(root);
  return results;
}

function routeForHtmlFile(outRoot: string, filePath: string): string {
  const rel = relative(outRoot, filePath).split("\\").join("/");
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"index.html".length)}`;
  return `/${rel}`;
}

async function loadPrerenderedHtml(outRoot: string): Promise<Record<string, string>> {
  const files = await walkHtmlFiles(outRoot);
  const htmlByRoute: Record<string, string> = {};
  for (const file of files) {
    htmlByRoute[routeForHtmlFile(outRoot, file)] = await readFile(file, "utf8");
  }
  return htmlByRoute;
}

function currentBuildRevision(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function main(): Promise<void> {
  const checkOnly = process.argv.includes("--check");
  const logRunId = newLogRunId();
  const logPath = logPathFor(SUITE, logRunId, ROOT);
  const outRoot = join(ROOT, "out");
  const manifestPath = join(ROOT, "artifacts/build/inline-script-hashes.json");

  const htmlByRoute = await loadPrerenderedHtml(outRoot);
  const manifest = buildInlineScriptHashManifest(INLINE_SCRIPT_REGISTRY, {
    buildRevision: currentBuildRevision(),
    generatedAt: new Date().toISOString(),
  });

  if (!checkOnly) {
    await mkdir(dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, serializeInlineScriptHashManifest(manifest), "utf8");
  }

  const issues = checkInlineScriptsAgainstRegistry(INLINE_SCRIPT_REGISTRY, htmlByRoute);
  const outcome = issues.length === 0 ? "pass" : "fail";

  appendLogLine(logPath, {
    suite: SUITE,
    logRunId,
    testId: "inline-script-registry-matches-build-output",
    beadId: BEAD_ID,
    outcome,
    message:
      outcome === "pass"
        ? `${INLINE_SCRIPT_REGISTRY.length} registry entries match emitted HTML across ${Object.keys(htmlByRoute).length} routes`
        : issues.map(formatInlineScriptCheckIssue).join("; "),
    extra: { manifestPath },
  });

  if (issues.length > 0) {
    const evidenceDir = evidenceDirFor(SUITE, logRunId, ROOT);
    issues.forEach((issue, index) => {
      writeEvidenceFile(evidenceDir, `issue-${index}.json`, JSON.stringify(issue, null, 2));
    });
    for (const issue of issues) console.error(formatInlineScriptCheckIssue(issue));
    process.exitCode = 1;
    return;
  }

  console.log(
    JSON.stringify({ outcome: "pass", manifestPath, entries: manifest.scripts.length, logPath }),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
