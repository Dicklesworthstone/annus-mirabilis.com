/**
 * Does the app's bundled edition match the web release? (bead am-app-edition-parity-bwa5)
 *
 * Two ways to ask, one answer format:
 *
 * - against a static build directory (`--web out/`, or the `.vercel/output/static` a prebuilt
 *   deploy uploaded): every web file is either in the edition with the same SHA-256, or dropped by
 *   one of the export's own declared exclusion rules (export-edition.ts EXCLUSION_RULES, applied by
 *   the same planEdition); every edition file exists on the web side with the same SHA-256.
 * - against the live deployment (`--site https://annus-mirabilis.com`): every route in the site's
 *   sitemap is a page the edition carries, and every file the edition carries is served with the
 *   same bytes. The live site is the release readers get, whichever worktree deployed it.
 *
 * Any difference no rule declares fails with the path and both digests. Nothing is ever fixed by
 * editing the edition: re-export it from the release's build, or declare a rule in the export.
 *
 *   bun scripts/app/edition-parity.ts --web <dir> | --site <origin> [--manifest <edition-manifest.json>]
 */

import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { planEdition, referencedDigests } from "./export-edition.ts";
import { editionPageFor, sitemapRoutes } from "./site-routes.ts";

export { sitemapRoutes };

export type ParityOutcome =
  | "same"
  | "excluded"
  | "differs"
  | "missing-from-web"
  | "missing-from-edition"
  | "unreachable";

export interface ParityRecord {
  readonly path: string;
  readonly outcome: ParityOutcome;
  readonly editionSha256: string | null;
  readonly webSha256: string | null;
  /** The declared exclusion rule, for an "excluded" record. */
  readonly rule: string | null;
  readonly detail?: string;
}

export interface ParityReport {
  readonly source: string;
  readonly records: readonly ParityRecord[];
  readonly counts: Readonly<Record<ParityOutcome, number>>;
  /** True when every record is "same" or "excluded", and at least one file was compared. */
  readonly passed: boolean;
}

export interface EditionManifestFiles {
  readonly files: readonly {
    readonly path: string;
    readonly sha256: string;
    readonly size?: number;
  }[];
}

/**
 * The one difference the live site is allowed, and why. Vercel appends its Toolbar loader to the
 * webpack runtime chunk it serves: a script, gated on a `__vercel_toolbar` cookie, that loads
 * https://vercel.live/_next-live/feedback/feedback.js. The edition is taken from the build, so it
 * does not carry it. The rule holds only when the served bytes begin with the edition's own bytes
 * exactly and the rest is that loader; any other difference in the same file still fails.
 */
export const VERCEL_TOOLBAR_RULE = "vercel-toolbar-injection";

export function isVercelToolbarSuffix(suffix: string): boolean {
  return (
    suffix.includes("__vercel_toolbar") &&
    suffix.includes("https://vercel.live/_next-live/feedback/feedback.js") &&
    !suffix.includes("</script")
  );
}

const FAILING: ReadonlySet<ParityOutcome> = new Set([
  "differs",
  "missing-from-web",
  "missing-from-edition",
  "unreachable",
]);

function report(source: string, records: ParityRecord[]): ParityReport {
  const counts = {
    same: 0,
    excluded: 0,
    differs: 0,
    "missing-from-web": 0,
    "missing-from-edition": 0,
    unreachable: 0,
  } satisfies Record<ParityOutcome, number>;
  for (const record of records) counts[record.outcome] += 1;
  records.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    source,
    records,
    counts,
    // A comparison of nothing is not a pass.
    passed: counts.same > 0 && records.every((record) => !FAILING.has(record.outcome)),
  };
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function listFiles(root: string): string[] {
  const out: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) out.push(relative(root, full).split("\\").join("/"));
    }
  };
  visit(root);
  return out.sort();
}

/** The edition against a static build directory, both ways. */
export function compareWithDirectory(manifest: EditionManifestFiles, webDir: string): ParityReport {
  const webPaths = listFiles(webDir);
  const digests = referencedDigests(webPaths, (path) => readFileSync(join(webDir, path), "utf8"));
  const plan = planEdition(webPaths, digests);
  const ruleOf = new Map<string, string>();
  for (const [rule, paths] of plan.excluded) for (const path of paths) ruleOf.set(path, rule);
  const edition = new Map(manifest.files.map((file) => [file.path, file.sha256]));
  const records: ParityRecord[] = [];
  const webSet = new Set(webPaths);
  for (const path of webPaths) {
    const webSha256 = sha256(readFileSync(join(webDir, path)));
    const editionSha256 = edition.get(path) ?? null;
    if (editionSha256 !== null) {
      records.push({
        path,
        outcome: editionSha256 === webSha256 ? "same" : "differs",
        editionSha256,
        webSha256,
        rule: null,
      });
    } else {
      const rule = ruleOf.get(path) ?? null;
      records.push({
        path,
        outcome: rule === null ? "missing-from-edition" : "excluded",
        editionSha256: null,
        webSha256,
        rule,
      });
    }
  }
  for (const [path, editionSha256] of edition) {
    if (!webSet.has(path)) {
      records.push({
        path,
        outcome: "missing-from-web",
        editionSha256,
        webSha256: null,
        rule: null,
      });
    }
  }
  return report(webDir, records);
}

export type Fetcher = (url: string) => Promise<{ status: number; body: Uint8Array }>;

/** The site path that serves an edition file: a directory's index.html is its route. */
export function siteUrlPath(path: string): string {
  if (path === "index.html") return "/";
  if (path.endsWith("/index.html")) return `/${path.slice(0, -"index.html".length)}`;
  return `/${path}`;
}

/** The edition against the live deployment: sitemap routes carried, carried files served identically. */
export async function compareWithSite(
  manifest: EditionManifestFiles,
  origin: string,
  fetcher: Fetcher,
  concurrency = 8,
): Promise<ParityReport> {
  const records: ParityRecord[] = [];
  const edition = new Map(manifest.files.map((file) => [file.path, file.sha256]));

  // The not-found page is served with status 404 by design; every other file with 200.
  const expectedStatus = (path: string) =>
    path === "404.html" || path === "404/index.html" ? 404 : 200;
  const queue = [...manifest.files];
  const worker = async () => {
    for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
      const url = `${origin}${siteUrlPath(file.path)}`;
      try {
        const response = await fetcher(url);
        if (response.status !== expectedStatus(file.path)) {
          records.push({
            path: file.path,
            outcome: response.status === 404 ? "missing-from-web" : "unreachable",
            editionSha256: file.sha256,
            webSha256: null,
            rule: null,
            detail: `${url} answered ${response.status}`,
          });
          continue;
        }
        const webSha256 = sha256(response.body);
        const size = file.size;
        const injected =
          webSha256 !== file.sha256 &&
          size !== undefined &&
          response.body.length > size &&
          sha256(response.body.subarray(0, size)) === file.sha256 &&
          isVercelToolbarSuffix(new TextDecoder().decode(response.body.subarray(size)));
        records.push({
          path: file.path,
          outcome: webSha256 === file.sha256 ? "same" : injected ? "excluded" : "differs",
          editionSha256: file.sha256,
          webSha256,
          rule: injected ? VERCEL_TOOLBAR_RULE : null,
          ...(injected
            ? { detail: "the served file is the edition's bytes plus Vercel's Toolbar loader" }
            : {}),
        });
      } catch (error) {
        records.push({
          path: file.path,
          outcome: "unreachable",
          editionSha256: file.sha256,
          webSha256: null,
          rule: null,
          detail: `${url}: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));

  // Every route the site says it has is a page the app carries.
  const sitemap = await fetcher(`${origin}/sitemap.xml`);
  if (sitemap.status !== 200) {
    records.push({
      path: "sitemap.xml",
      outcome: "unreachable",
      editionSha256: null,
      webSha256: null,
      rule: null,
      detail: `the sitemap answered ${sitemap.status}, so the site's routes could not be listed`,
    });
  } else {
    for (const route of sitemapRoutes(new TextDecoder().decode(sitemap.body), origin)) {
      const page = editionPageFor(route);
      if (!edition.has(page)) {
        records.push({
          path: page,
          outcome: "missing-from-edition",
          editionSha256: null,
          webSha256: null,
          rule: null,
          detail: `the sitemap lists ${route}`,
        });
      }
    }
  }
  return report(origin, records);
}

/** One JSON line per record, then a summary line, under artifacts/test-logs/app-edition-parity/. */
export function writeParityLog(repo: string, result: ParityReport): string {
  const logRunId = `${new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z")}-${randomBytes(4).toString("hex")}`;
  const directory = join(repo, "artifacts", "test-logs", "app-edition-parity");
  mkdirSync(directory, { recursive: true });
  const file = join(directory, `${logRunId}.jsonl`);
  const base = { suite: "app-edition-parity", logRunId, source: result.source };
  const lines = result.records.map((record) =>
    JSON.stringify({ timestamp: new Date().toISOString(), ...base, ...record }),
  );
  lines.push(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      ...base,
      outcome: result.passed ? "passed" : "failed",
      counts: result.counts,
      message: summary(result),
    }),
  );
  writeFileSync(file, `${lines.join("\n")}\n`);
  return file;
}

export function summary(result: ParityReport): string {
  const counts = Object.entries(result.counts)
    .filter(([, n]) => n > 0)
    .map(([outcome, n]) => `${n} ${outcome}`)
    .join(", ");
  return `edition parity against ${result.source}: ${result.passed ? "PASSED" : "FAILED"} (${counts || "nothing compared"})`;
}

async function main(argv: readonly string[]): Promise<number> {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const option = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const manifestPath =
    option("--manifest") ?? join(repo, "generated", "app-edition", "edition-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as EditionManifestFiles;
  const web = option("--web");
  const site = option("--site");
  if ((web === undefined) === (site === undefined)) {
    process.stderr.write(
      "usage: bun scripts/app/edition-parity.ts --web <dir> | --site <https origin>\n",
    );
    return 2;
  }
  let result: ParityReport;
  if (web !== undefined) {
    statSync(web);
    result = compareWithDirectory(manifest, web);
  } else {
    const origin = (site ?? "").replace(/\/+$/, "");
    const fetcher: Fetcher = async (url) => {
      // AGENTS.md: every web request carries this user agent.
      const response = await fetch(url, {
        headers: { "User-Agent": "OpenAI File Downloader, XaiImageApiFetch/1.0" },
        redirect: "follow",
      });
      return { status: response.status, body: new Uint8Array(await response.arrayBuffer()) };
    };
    result = await compareWithSite(manifest, origin, fetcher);
  }
  const log = writeParityLog(repo, result);
  for (const record of result.records.filter((r) => FAILING.has(r.outcome)).slice(0, 20)) {
    process.stdout.write(
      `${record.outcome}\t${record.path}\tedition ${record.editionSha256 ?? "-"}\tweb ${record.webSha256 ?? "-"}${record.detail ? `\t${record.detail}` : ""}\n`,
    );
  }
  process.stdout.write(`${summary(result)}\nlog: ${log}\n`);
  return result.passed ? 0 : 1;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main(process.argv.slice(2)).then((code) => process.exit(code));
}
