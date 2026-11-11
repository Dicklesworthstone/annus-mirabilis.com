/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: scripts/app-router-architecture.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Refactored pure checkArchitecture function to check 5 violation rules (Pages router, second app root, legacy files, root allowlist, scratch files).
 * - Added CLI entry point with filesystem walk, git check-ignore integration, and JSONL test logging.
 * - Added root allowlist parser and validation.
 */

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join, normalize, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { reportPopulation } from "./gate-census/population.ts";

/**
 * Generates a standard log run ID in the format YYYYMMDDTHHMMSSZ-<8 hex>.
 */
export function generateLogRunId(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  const hex = randomBytes(4).toString("hex");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z-${hex}`;
}

export interface RepoEntry {
  readonly path: string;
  readonly kind: "file" | "directory";
}

export type ArchitectureRule =
  | "rule-1-pages-router"
  | "rule-2-second-app-root"
  | "rule-3-legacy-files"
  | "rule-4-root-allowlist"
  | "rule-5-scratch-files";

export interface ArchitectureViolation {
  readonly rule: ArchitectureRule;
  readonly path: string;
  readonly message: string;
  readonly repair: string;
}

export type Allowlist = Record<string, string>;

export interface LogEntryViolation {
  readonly timestamp: string;
  readonly suite: "architecture";
  readonly logRunId: string;
  readonly rule: ArchitectureRule;
  readonly path: string;
  readonly message: string;
  readonly repair: string;
}

export interface LogEntrySummary {
  readonly timestamp: string;
  readonly suite: "architecture";
  readonly logRunId: string;
  readonly outcome: "passed" | "failed";
  readonly violations: number;
  readonly entriesScanned: number;
}

/**
 * Loads and validates the architecture allowlist from a JSON file path or raw object.
 * Rejects entries that do not have a valid, non-empty reason explaining why they are permitted.
 */
export function loadAllowlist(allowlistInput: string | Record<string, unknown>): Allowlist {
  let raw: Record<string, unknown>;

  if (typeof allowlistInput === "string") {
    const fileContent = readFileSync(allowlistInput, "utf8");
    raw = JSON.parse(fileContent);
  } else {
    raw = allowlistInput;
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Allowlist must be a valid JSON object mapping patterns to reasons.");
  }

  const allowlist: Allowlist = {};

  for (const [pattern, reasonValue] of Object.entries(raw)) {
    if (!pattern || pattern.trim().length === 0) {
      throw new Error("Allowlist pattern key cannot be empty.");
    }

    let reason = "";
    if (typeof reasonValue === "string") {
      reason = reasonValue.trim();
    } else if (
      typeof reasonValue === "object" &&
      reasonValue !== null &&
      "reason" in reasonValue &&
      typeof (reasonValue as { reason: unknown }).reason === "string"
    ) {
      reason = ((reasonValue as { reason: string }).reason || "").trim();
    }

    // The repair message for rule-4 says "add it with a reason". Non-empty is not a reason:
    // "n/a", "x", "-" and "TODO" all satisfied that test, so the gate prescribed a remedy it
    // did not read past the first character. Same defect and same 20-character bar as
    // e3f4881e on NOT_IN_PACKAGE_JSON. Every one of the 32 committed entries is 28 characters
    // or longer, so this refuses nothing that exists; the shortest is "PostCSS plugin
    // configuration".
    const MINIMUM_REASON = 20;
    if (reason.length < MINIMUM_REASON) {
      throw new Error(
        `Allowlist entry '${pattern}' must have a valid reason explaining why it is permitted, ` +
          `of at least ${MINIMUM_REASON} characters. Found ${reason.length}: '${reason}'.`,
      );
    }

    allowlist[pattern] = reason;
  }

  return allowlist;
}

/**
 * Tests whether a path matches an allowlist entry, supporting exact matches and simple wildcards (e.g. next.config.*).
 */
export function matchesAllowlist(entryPath: string, allowlist: Allowlist): boolean {
  if (entryPath in allowlist) {
    return true;
  }

  for (const pattern of Object.keys(allowlist)) {
    if (pattern.includes("*")) {
      const regexStr = `^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`;
      const regex = new RegExp(regexStr);
      if (regex.test(entryPath)) {
        return true;
      }
    }
  }

  return false;
}

const APP_ROUTER_SPECIAL_FILES = /^(page|layout|route|template|default)\.(tsx|ts|jsx|js|mdx)$/;
const LEGACY_FILES = /^(_app|_document|_error)(\.[^/]+)?$/;
const FORBIDDEN_EXTENSIONS = new Set([".py", ".sh", ".ipynb", ".bak", ".orig", ".rej", ".tmp"]);
const FORBIDDEN_PREFIXES = /^(scratch|tmp_|fix_|debug_)/i;

function normalizeRepoPath(p: string): string {
  const norm = normalize(p).replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\//, "");
  return norm.endsWith("/") && norm.length > 1 ? norm.slice(0, -1) : norm;
}

/**
 * Pure checking function evaluating repository entries against the 5 architecture rules.
 */
export function checkArchitecture(
  entries: readonly RepoEntry[],
  isIgnored: (path: string) => boolean,
  allowlist: Allowlist,
): ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];

  for (const entry of entries) {
    const rawPath = entry.path;
    const path = normalizeRepoPath(rawPath);
    if (!path || path === ".") {
      continue;
    }

    const base = basename(path);
    const ext = extname(path).toLowerCase();
    const isRootEntry = !path.includes("/");

    // Rule 1: Pages Router directory
    if (
      path === "src/pages" ||
      path.startsWith("src/pages/") ||
      path === "pages" ||
      path.startsWith("pages/")
    ) {
      violations.push({
        rule: "rule-1-pages-router",
        path: rawPath,
        message: `Forbidden Pages Router path '${rawPath}' detected. Next.js App Router projects forbid src/pages and root pages directories (even if empty, ignored, or containing only .keep). All routes belong in 'src/app/'.`,
        repair: `Delete '${rawPath}' or move route definitions to 'src/app/'. Pure Next.js App Router architecture is required.`,
      });
      continue;
    }

    // Rule 2: Second App Router root & App Router special files
    if (path === "app" || path.startsWith("app/")) {
      violations.push({
        rule: "rule-2-second-app-root",
        path: rawPath,
        message: `Root-level 'app/' directory detected at '${rawPath}'. The sole App Router root must be 'src/app/'.`,
        repair: `Move all routes into 'src/app/' and delete the root 'app/' directory.`,
      });
      continue;
    }

    // Rule 2 check: App Router special file outside src/app/
    if (APP_ROUTER_SPECIAL_FILES.test(base)) {
      const isInsideSrcApp = path.startsWith("src/app/");
      if (!isInsideSrcApp) {
        violations.push({
          rule: "rule-2-second-app-root",
          path: rawPath,
          message: `App Router special file '${rawPath}' found outside 'src/app/'.`,
          repair: `Rename '${rawPath}' to a standard component name (e.g., ReaderLayout.tsx) or move it into 'src/app/'.`,
        });
      }
    }

    // Rule 2 check: next.config.* outside repository root
    if (/^next\.config\.(mjs|js|ts|cjs)$/.test(base) && !isRootEntry) {
      violations.push({
        rule: "rule-2-second-app-root",
        path: rawPath,
        message: `Nested Next.js configuration found at '${rawPath}'. Only one Next.js project is permitted at the repository root.`,
        repair: `Remove nested Next.js project configuration at '${rawPath}'.`,
      });
    }

    // Rule 2 check: pages directory or App Router special files under ios/
    if (path.startsWith("ios/")) {
      const iosSegments = path.split("/");
      if (iosSegments.includes("pages")) {
        violations.push({
          rule: "rule-2-second-app-root",
          path: rawPath,
          message: `Forbidden pages directory found under 'ios/' at '${rawPath}'. The native iOS app shell must not replicate Pages Router structures.`,
          repair: `Rename or remove the 'pages' directory under 'ios/'.`,
        });
      }
    }

    // Rule 3: Legacy file names (_app, _document, _error)
    if (LEGACY_FILES.test(base)) {
      if (path.startsWith("src/") || path.startsWith("pages/") || isRootEntry) {
        violations.push({
          rule: "rule-3-legacy-files",
          path: rawPath,
          message: `Legacy Pages Router file '${rawPath}' detected.`,
          repair: `Remove '${rawPath}'. App Router uses 'src/app/error.tsx', 'src/app/global-error.tsx', and 'src/app/layout.tsx' instead.`,
        });
      }
    }

    // Rule 4: Root allowlist (checked only for root entries)
    if (isRootEntry) {
      if (path === "sources") {
        if (!isIgnored("sources") && !isIgnored("sources/")) {
          violations.push({
            rule: "rule-4-root-allowlist",
            path: rawPath,
            message: `Root 'sources/' directory exists but is not ignored by git. Raw scans and local-only pins in sources/ must never be committed.`,
            repair: `Add 'sources/' to .gitignore immediately before placing files in it.`,
          });
        }
      } else {
        const isAllowlisted = matchesAllowlist(path, allowlist);
        if (!isAllowlisted) {
          const ignored = isIgnored(path) || isIgnored(`${path}/`);
          if (!ignored) {
            violations.push({
              rule: "rule-4-root-allowlist",
              path: rawPath,
              message: `Unapproved unignored root entry '${rawPath}' is not in scripts/architecture-allowlist.json.`,
              repair: `If '${rawPath}' is a temporary/scratch file, remove it. If required by a reviewed project decision, add it with a reason to scripts/architecture-allowlist.json.`,
            });
          }
        }
      }
    }

    // Rule 5: Scratch files in the source tree (under src/, content/, public/)
    if (
      (path.startsWith("src/") || path.startsWith("content/") || path.startsWith("public/")) &&
      entry.kind === "file"
    ) {
      const isForbiddenExt = FORBIDDEN_EXTENSIONS.has(ext);
      const isWip = base.includes(".wip.");
      const isForbiddenPrefix = FORBIDDEN_PREFIXES.test(base);

      if (isForbiddenExt || isWip || isForbiddenPrefix) {
        const isExplicitlyAllowlisted = matchesAllowlist(path, allowlist);
        if (!isExplicitlyAllowlisted) {
          violations.push({
            rule: "rule-5-scratch-files",
            path: rawPath,
            message: `Forbidden scratch/temporary file '${rawPath}' found in source tree.`,
            repair: `Remove '${rawPath}' from the repository. Use a session scratch directory (honour TMPDIR) or proper typed test fixtures.`,
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Builds the list of RepoEntries from the real filesystem.
 * Walks root entries and recursively scans src/, content/, public/, docs/, scripts/, perf/, ios/, pages/, app/.
 * Skips node_modules, .git, .next, and never descends into sources/.
 */
export function collectRepoEntries(
  rootDir: string,
  _isIgnored?: (path: string) => boolean,
): RepoEntry[] {
  const entries: RepoEntry[] = [];
  const rootItems = readdirSync(rootDir, { withFileTypes: true });

  for (const item of rootItems) {
    if (item.name === ".git") {
      continue;
    }
    entries.push({
      path: item.name,
      kind: item.isDirectory() ? "directory" : "file",
    });
  }

  const dirsToWalk = ARCHITECTURE_SCAN_ROOTS;
  const rootDirectories = new Set(
    rootItems.filter((item) => item.isDirectory()).map((item) => item.name),
  );

  for (const dirName of dirsToWalk) {
    const fullDir = join(rootDir, dirName);
    if (!rootDirectories.has(dirName)) {
      continue;
    }
    if (dirName === "sources") {
      // Rule 4: never descend into sources/
      continue;
    }
    walkDirectoryRecursive(fullDir, rootDir, entries);
  }

  return entries;
}

function walkDirectoryRecursive(dir: string, rootDir: string, entries: RepoEntry[]): void {
  const items = readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (ARCHITECTURE_WALK_EXCLUSIONS.has(item.name)) {
      continue;
    }
    const fullPath = join(dir, item.name);
    const relPath = relative(rootDir, fullPath).replace(/\\/g, "/");
    entries.push({
      path: relPath,
      kind: item.isDirectory() ? "directory" : "file",
    });
    if (item.isDirectory()) {
      walkDirectoryRecursive(fullPath, rootDir, entries);
    }
  }
}

/**
 * Parses gitignore file content and creates a pattern-matching predicate.
 */
export function parseGitIgnorePatterns(gitignoreContent: string): (path: string) => boolean {
  const lines = gitignoreContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  const rules: { regex: RegExp; isNegation: boolean }[] = [];

  for (const line of lines) {
    let pat = line;
    let isNegation = false;
    if (pat.startsWith("!")) {
      isNegation = true;
      pat = pat.slice(1).trim();
    }
    if (pat.endsWith("/")) {
      pat = pat.slice(0, -1);
    }
    if (pat.startsWith("/")) {
      pat = pat.slice(1);
    }

    const escaped = pat
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, "[^/]");

    const regex = new RegExp(`^(?:.*/)?${escaped}(?:/.*)?$`);
    rules.push({ regex, isNegation });
  }

  return (testPath: string): boolean => {
    let ignored = false;
    const normalized = testPath.replace(/\\/g, "/").replace(/^\//, "").replace(/\/$/, "");
    for (const rule of rules) {
      if (rule.regex.test(normalized)) {
        ignored = !rule.isNegation;
      }
    }
    return ignored;
  };
}

/**
 * Creates a git check-ignore query predicate against the given working directory.
 * Falls back to in-memory .gitignore parsing if child process spawning is not available.
 */
export function createGitIgnorePredicate(cwd: string): (path: string) => boolean {
  let fileMatcher: ((path: string) => boolean) | undefined;
  const gitignorePath = join(cwd, ".gitignore");
  if (existsSync(gitignorePath)) {
    try {
      const content = readFileSync(gitignorePath, "utf8");
      fileMatcher = parseGitIgnorePatterns(content);
    } catch {
      fileMatcher = undefined;
    }
  }

  return (testPath: string): boolean => {
    try {
      const bunGlobal = (
        globalThis as unknown as {
          Bun?: {
            spawnSync: (
              args: string[],
              options: {
                cwd: string;
                env: NodeJS.ProcessEnv;
                stdin: "ignore";
                stdout: "pipe";
                stderr: "ignore";
              },
            ) => { exitCode: number; stdout: { toString: () => string } };
          };
        }
      ).Bun;
      if (typeof bunGlobal !== "undefined") {
        const proc = bunGlobal.spawnSync(["git", "check-ignore", testPath], {
          cwd,
          env: process.env,
          stdin: "ignore",
          stdout: "pipe",
          stderr: "ignore",
        });
        if (proc.exitCode === 0 && proc.stdout.toString().trim().length > 0) {
          return true;
        }
      } else {
        const res = spawnSync("git", ["check-ignore", testPath], {
          cwd,
          env: process.env,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        });
        if (res.status === 0 && res.stdout && res.stdout.trim().length > 0) {
          return true;
        }
      }
    } catch {
      // ignore process spawn failure
    }

    if (fileMatcher) {
      return fileMatcher(testPath);
    }
    return false;
  };
}

/**
 * Scans the repository for entries and sets up the git check-ignore predicate.
 */
export function scanRepository(rootDir: string = process.cwd()): {
  entries: RepoEntry[];
  isIgnored: (path: string) => boolean;
} {
  const isIgnored = createGitIgnorePredicate(rootDir);
  const entries = collectRepoEntries(rootDir, isIgnored);
  return { entries, isIgnored };
}

/**
 * Writes structured JSONL logs and evidence artifacts for gate runs.
 */
export function writeGateLog(
  artifactsDir: string,
  logRunId: string,
  entries: readonly RepoEntry[],
  violations: readonly ArchitectureViolation[],
  population?: ArchitecturePopulation,
): { logPath: string; evidenceDir?: string | undefined } {
  const logDir = join(artifactsDir, "test-logs", "architecture");
  mkdirSync(logDir, { recursive: true });

  const logPath = join(logDir, `${logRunId}.jsonl`);
  const lines: string[] = [];
  const timestamp = new Date().toISOString();

  for (const v of violations) {
    const entry: LogEntryViolation = {
      timestamp,
      suite: "architecture",
      logRunId,
      rule: v.rule,
      path: v.path,
      message: v.message,
      repair: v.repair,
    };
    lines.push(JSON.stringify(entry));
  }

  const summary: LogEntrySummary = {
    timestamp,
    suite: "architecture",
    logRunId,
    outcome: violations.length === 0 && (population?.complete ?? true) ? "passed" : "failed",
    violations: violations.length,
    entriesScanned: entries.length,
  };
  if (population) {
    lines.push(
      JSON.stringify({
        timestamp,
        suite: "architecture",
        logRunId,
        population: {
          examined: population.examined,
          expected: population.expected.length,
          missing: population.missing,
          problems: population.problems,
          complete: population.complete,
        },
      }),
    );
  }

  lines.push(JSON.stringify(summary));
  writeFileSync(logPath, `${lines.join("\n")}\n`, "utf8");

  let evidenceDir: string | undefined;
  if (violations.length > 0 || population?.complete === false) {
    evidenceDir = join(logDir, logRunId, "evidence");
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(
      join(evidenceDir, "violations.json"),
      JSON.stringify(violations, null, 2),
      "utf8",
    );
    writeFileSync(
      join(evidenceDir, "scanned-entries.json"),
      JSON.stringify(entries, null, 2),
      "utf8",
    );
  }

  return { logPath, evidenceDir };
}

/**
 * Filesystem scope shared by the walker and the independent tracked-file census.
 * Root entries are always examined; these directories are also walked recursively.
 */
export const ARCHITECTURE_SCAN_ROOTS: readonly string[] = [
  "src",
  "content",
  "public",
  "docs",
  "scripts",
  "perf",
  "ios",
  "pages",
  "app",
];
const ARCHITECTURE_WALK_EXCLUSIONS = new Set([".git", "node_modules", ".next"]);

export interface ArchitectureManifestRead {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly failure: string | null;
}

export interface ArchitecturePopulation {
  readonly expected: readonly RepoEntry[];
  readonly examined: number;
  readonly missing: readonly RepoEntry[];
  readonly problems: readonly string[];
  readonly complete: boolean;
}

/** A failed Git read must never become an empty, apparently complete scan. */
export function readArchitectureManifest(
  rootDir: string = process.cwd(),
): ArchitectureManifestRead {
  try {
    const result = spawnSync("git", ["ls-files", "--cached", "-z"], {
      cwd: rootDir,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    return {
      status: result.status,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      failure: result.error?.message ?? null,
    };
  } catch (error) {
    return {
      status: null,
      stdout: "",
      stderr: "",
      failure: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Count only tracked identities that the filesystem walker actually examined.
 * Generated files cannot replace a missing tracked file, even when their total is larger.
 * Git keeps sparse-checkout paths in its index, so an incomplete checkout is refused.
 */
export function inspectArchitecturePopulation(
  entries: readonly RepoEntry[],
  manifest: ArchitectureManifestRead,
): ArchitecturePopulation {
  const problems: string[] = [];
  const refused = (): ArchitecturePopulation => ({
    expected: [],
    examined: 0,
    missing: [],
    problems,
    complete: false,
  });
  if (manifest.status !== 0 || manifest.failure !== null) {
    problems.push(
      `Cannot read Git's tracked manifest: ${
        manifest.failure || manifest.stderr.trim() || `exit ${manifest.status}`
      }`,
    );
    return refused();
  }
  if (manifest.stdout.length === 0) {
    problems.push("Git returned an empty tracked manifest.");
    return refused();
  }
  if (!manifest.stdout.endsWith("\0")) {
    problems.push("Git's tracked manifest is not NUL-terminated.");
    return refused();
  }
  const paths = manifest.stdout.slice(0, -1).split("\0");
  const seen = new Set<string>();
  for (const path of paths) {
    const parts = path.split("/");
    if (
      path.length === 0 ||
      path.includes("\\") ||
      parts.some((part) => part === "" || part === "." || part === "..")
    ) {
      problems.push(`Invalid tracked repository path: ${JSON.stringify(path)}.`);
    }
    if (seen.has(path)) {
      problems.push(`Duplicate tracked repository path: ${JSON.stringify(path)}.`);
    }
    seen.add(path);
  }
  for (const path of paths) {
    let slash = path.indexOf("/");
    while (slash !== -1) {
      const ancestor = path.slice(0, slash);
      if (seen.has(ancestor)) {
        problems.push(`Tracked path is both file and directory: ${JSON.stringify(ancestor)}.`);
        break;
      }
      slash = path.indexOf("/", slash + 1);
    }
  }
  if (problems.length > 0) return refused();

  const expectedByPath = new Map<string, RepoEntry>();
  const representedRoots = new Set<string>();
  for (const path of paths) {
    const parts = path.split("/");
    const root = parts[0];
    if (root === undefined || root === ".git") continue;
    if (parts.length === 1) {
      expectedByPath.set(path, { path, kind: "file" });
      continue;
    }
    expectedByPath.set(root, { path: root, kind: "directory" });
    if (!ARCHITECTURE_SCAN_ROOTS.includes(root)) continue;
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part === undefined || ARCHITECTURE_WALK_EXCLUSIONS.has(part)) break;
      const entryPath = parts.slice(0, i + 1).join("/");
      const kind = i === parts.length - 1 ? "file" : "directory";
      expectedByPath.set(entryPath, { path: entryPath, kind });
      if (kind === "file") representedRoots.add(root);
    }
  }
  for (const root of ARCHITECTURE_SCAN_ROOTS) {
    if (root !== "pages" && root !== "app" && !representedRoots.has(root)) {
      problems.push(`Git's tracked manifest has no in-scope files under ${root}/.`);
    }
  }

  const expected = [...expectedByPath.values()].sort((a, b) => a.path.localeCompare(b.path));
  const observed = new Set(entries.map((entry) => `${entry.kind}\0${entry.path}`));
  const missing = expected.filter((entry) => !observed.has(`${entry.kind}\0${entry.path}`));
  return {
    expected,
    examined: expected.length - missing.length,
    missing,
    problems,
    complete: expected.length > 0 && missing.length === 0 && problems.length === 0,
  };
}

/**
 * CLI execution entry point.
 */
export function runArchitectureGateCli(rootDir: string = process.cwd()): number {
  const allowlistPath = join(rootDir, "scripts", "architecture-allowlist.json");
  if (!existsSync(allowlistPath)) {
    console.error(`🚨 Architecture gate error: allowlist file missing at ${allowlistPath}`);
    return 1;
  }

  const allowlist = loadAllowlist(allowlistPath);
  const isIgnored = createGitIgnorePredicate(rootDir);
  const entries = collectRepoEntries(rootDir, isIgnored);
  const violations = checkArchitecture(entries, isIgnored, allowlist);

  const logRunId = generateLogRunId();
  const artifactsDir = join(rootDir, "artifacts");

  const population = inspectArchitecturePopulation(entries, readArchitectureManifest(rootDir));
  writeGateLog(artifactsDir, logRunId, entries, violations, population);

  // The denominator comes from Git, independently of the filesystem walk. Requiring every
  // tracked identity catches a missing subtree even when generated artifacts inflate the total.
  const censusVacuous = reportPopulation({
    gate: "architecture",
    examined: population.examined,
    noun: "tracked repository entries",
    minimum: Math.max(1, population.expected.length),
  });
  if (censusVacuous || !population.complete) {
    console.error(
      `\n🚨 Architecture Gate Refused: examined ${population.examined} of ` +
        `${population.expected.length} tracked repository entries.\n`,
    );
    for (const problem of population.problems) console.error(`  ${problem}`);
    for (const entry of population.missing.slice(0, 20)) {
      console.error(`  Missing tracked ${entry.kind}: ${entry.path}`);
    }
    console.error(`Evidence logged to: artifacts/test-logs/architecture/${logRunId}.jsonl\n`);
    return 1;
  }

  if (violations.length > 0) {
    console.error(
      `\n🚨 Architecture Gate Failed (${violations.length} violation${violations.length === 1 ? "" : "s"} found):`,
    );
    for (const v of violations) {
      console.error(`\n  [${v.rule}] ${v.path}`);
      console.error(`    ${v.message}`);
      console.error(`    Repair: ${v.repair}`);
    }
    console.error(`\nEvidence logged to: artifacts/test-logs/architecture/${logRunId}.jsonl\n`);
    return 1;
  }

  console.log(`✔ Architecture gate passed (${entries.length} entries scanned, 0 violations).`);
  return 0;
}

// Auto-run if executed directly as a script
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("app-router-architecture.ts") ||
    pathToFileURL(process.argv[1]).href === import.meta.url);

if (isMain) {
  const exitCode = runArchitectureGateCli(process.cwd());
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
