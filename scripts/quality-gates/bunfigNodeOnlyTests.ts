/**
 * bunfig.toml [test].pathIgnorePatterns is the single list of test files that
 * bun must not discover. Node must still run them. This module parses that
 * list so package.json, CI, and tests cannot drift from bunfig.
 */

import { type Dirent, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export const BUNFIG_RELATIVE_PATH = "bunfig.toml";
/** Extra node --test inputs that bunfig does not ignore. Globs are expanded to files. */
export const NODE_SUITE_ALWAYS = [
  "scripts/e2e/**/*.test.ts",
  "scripts/quality-gates/bunfigNodeOnlyTests.test.ts",
] as const;
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "artifacts", "dist", "coverage"]);

export function parsePathIgnorePatterns(bunfigText: string): string[] {
  const block = bunfigText.match(/pathIgnorePatterns\s*=\s*\[([\s\S]*?)\]/);
  if (block === null || block[1] === undefined) {
    throw new Error(
      "bunfig.toml is missing [test].pathIgnorePatterns. Subprocess tests would run under bun test or nowhere.",
    );
  }
  const patterns = [...block[1].matchAll(/"([^"]+)"/g)]
    .map((m) => m[1])
    .filter((p): p is string => p !== undefined);
  if (patterns.length === 0) {
    throw new Error("bunfig.toml [test].pathIgnorePatterns is empty.");
  }
  return patterns;
}

function posix(rel: string): string {
  return rel.replace(/\\/g, "/");
}

export function matchPattern(relPath: string, pattern: string): boolean {
  const normalizedPath = posix(relPath);
  const normalizedPattern = posix(pattern).replace(/\/+$/, "");

  // 1. Exact match
  if (normalizedPath === normalizedPattern) {
    return true;
  }

  // 2. Directory prefix match (e.g. pattern is "scripts/e2e")
  if (!normalizedPattern.includes("*")) {
    if (normalizedPath.startsWith(`${normalizedPattern}/`)) {
      return true;
    }
  }

  // 3. Glob matching
  const regexStr = normalizedPattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\/\*\*\//g, ":::SLASH_GLOBSTAR_SLASH:::")
    .replace(/\*\*/g, ":::GLOBSTAR:::")
    .replace(/\*/g, "[^/]*")
    .replace(/:::SLASH_GLOBSTAR_SLASH:::/g, "/(?:.*/)?")
    .replace(/:::GLOBSTAR:::/g, ".*");
  return new RegExp(`^${regexStr}$`).test(normalizedPath);
}

function walkFiles(dir: string, root: string, out: string[]): void {
  let entries: Dirent[] | undefined;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  if (entries === undefined) return;
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, root, out);
    } else if (entry.isFile()) {
      out.push(posix(relative(root, full)));
    }
  }
}

export function expandIgnorePatternsToTestFiles(
  patterns: readonly string[],
  root: string,
): string[] {
  const allFiles: string[] = [];
  walkFiles(root, root, allFiles);
  const matched = allFiles.filter((rel) => {
    if (!/\.(test|spec)\.(ts|js|mjs|tsx|jsx)$/.test(rel)) return false;
    return patterns.some((pattern) => matchPattern(rel, pattern));
  });
  return [...new Set(matched)].sort();
}

export function nodeOnlyTestArgs(bunfigText: string, root: string): string[] {
  const patterns = parsePathIgnorePatterns(bunfigText);
  const fromBunfig = expandIgnorePatternsToTestFiles(patterns, root);
  const extraFiles = expandIgnorePatternsToTestFiles(NODE_SUITE_ALWAYS, root);
  const allTestFiles = [...new Set([...extraFiles, ...fromBunfig])].sort();
  if (allTestFiles.length === 0) {
    throw new Error("node-only test derivation produced an empty file list.");
  }
  for (const path of allTestFiles) {
    if (path.includes("*") || path.endsWith("/")) {
      throw new Error(
        `node --test cannot consume a glob or directory; derivation left ${path} unexpanded.`,
      );
    }
    const full = existsSync(join(root, path)) ? join(root, path) : path;
    if (!existsSync(full)) {
      throw new Error(`node-only test path does not exist: ${path}`);
    }
    if (statSync(full).isDirectory()) {
      throw new Error(
        `node --test cannot consume a directory; derivation left ${path} unexpanded.`,
      );
    }
  }
  return allTestFiles;
}

export function nodeOnlyTestCommand(args: readonly string[]): string {
  return ["node", "--experimental-strip-types", "--test", ...args].join(" ");
}

export const TEST_FILE_EXTENSIONS_REGEX = /\.(test|spec)\.(ts|js|mjs|tsx|jsx)$/;

export function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
}

export const PLAYWRIGHT_STATIC_IMPORT_REGEX =
  /(?:^|\n)\s*(?:import|export)\b[^;]*?\bfrom\s*['"](@?playwright(?:-core|\/test)?|@axe-core\/playwright|chromium)['"]/;

export const PLAYWRIGHT_BARE_IMPORT_REGEX =
  /(?:^|\n)\s*import\s*['"](@?playwright(?:-core|\/test)?|@axe-core\/playwright|chromium)['"]/;

export const PLAYWRIGHT_DYNAMIC_IMPORT_REGEX =
  /\b(?:require|import)\s*\(\s*['"](@?playwright(?:-core|\/test)?|@axe-core\/playwright|chromium)['"]\s*\)/;

export const CHROMIUM_NAMED_IMPORT_REGEX =
  /(?:^|\n)\s*(?:import|export)\b[^;]*?\bchromium\b[^;]*?\bfrom\b/;

export const SUBPROCESS_STATIC_IMPORT_REGEX =
  /(?:^|\n)\s*(?:import|export)\b[^;]*?\bfrom\s*['"](?:node:)?child_process['"]/;

export const SUBPROCESS_BARE_IMPORT_REGEX = /(?:^|\n)\s*import\s*['"](?:node:)?child_process['"]/;

export const SUBPROCESS_DYNAMIC_IMPORT_REGEX =
  /\b(?:require|import)\s*\(\s*['"](?:node:)?child_process['"]\s*\)/;

export const SUBPROCESS_SPAWN_CALL_REGEX =
  /\b(?:spawn|spawnSync|exec|execSync|execFile|execFileSync|fork)\s*\(/;

export interface UnignoredSubprocessTestViolation {
  readonly file: string;
  readonly reason: string;
  readonly lineToAdd: string;
}

export function classifyTestFileContent(rawContent: string): string | null {
  const code = stripComments(rawContent);

  const staticMatch = code.match(PLAYWRIGHT_STATIC_IMPORT_REGEX);
  if (staticMatch?.[1] !== undefined) {
    return `imports "${staticMatch[1]}"`;
  }

  const bareMatch = code.match(PLAYWRIGHT_BARE_IMPORT_REGEX);
  if (bareMatch?.[1] !== undefined) {
    return `imports "${bareMatch[1]}"`;
  }

  const dynamicMatch = code.match(PLAYWRIGHT_DYNAMIC_IMPORT_REGEX);
  if (dynamicMatch?.[1] !== undefined) {
    return `imports "${dynamicMatch[1]}"`;
  }

  if (CHROMIUM_NAMED_IMPORT_REGEX.test(code)) {
    return "imports chromium";
  }

  const hasSubprocessImport =
    SUBPROCESS_STATIC_IMPORT_REGEX.test(code) ||
    SUBPROCESS_BARE_IMPORT_REGEX.test(code) ||
    SUBPROCESS_DYNAMIC_IMPORT_REGEX.test(code);

  if (hasSubprocessImport && SUBPROCESS_SPAWN_CALL_REGEX.test(code) && !code.includes("EBADF")) {
    return "spawns a subprocess without EBADF handling";
  }

  return null;
}

export function formatUnignoredSubprocessTestFailure(
  violations: readonly UnignoredSubprocessTestViolation[],
): string {
  const lines = [
    `Found ${violations.length} test file(s) that import playwright, @axe-core/playwright, or chromium, or spawn a subprocess, but are not matched by bunfig.toml pathIgnorePatterns:`,
    "",
  ];
  for (const v of violations) {
    lines.push(`File: ${v.file}`);
    lines.push(`Reason: ${v.reason}`);
    lines.push("Exact line to add to [test].pathIgnorePatterns in bunfig.toml:");
    lines.push(v.lineToAdd);
    lines.push("");
  }
  lines.push(
    "Subprocess-spawning and browser tests cannot run under bun test on macOS (EBADF posix_spawn failure).",
    "They must be listed in bunfig.toml pathIgnorePatterns so bun test skips them and scripts/run-node-only-tests.ts runs them under node --test.",
  );
  return lines.join("\n");
}

export function findUnignoredSubprocessTests(
  root: string = process.cwd(),
  bunfigText?: string,
  targetDirs: readonly string[] = ["src", "scripts"],
): UnignoredSubprocessTestViolation[] {
  const rawBunfig = bunfigText ?? readFileSync(resolve(root, BUNFIG_RELATIVE_PATH), "utf8");
  const patterns = parsePathIgnorePatterns(rawBunfig);

  const allFiles: string[] = [];
  for (const dir of targetDirs) {
    const fullDir = resolve(root, dir);
    if (existsSync(fullDir)) {
      walkFiles(fullDir, root, allFiles);
    }
  }

  const testFiles = allFiles.filter((rel) => TEST_FILE_EXTENSIONS_REGEX.test(rel));
  const violations: UnignoredSubprocessTestViolation[] = [];

  for (const relPath of testFiles) {
    let content: string;
    try {
      content = readFileSync(resolve(root, relPath), "utf8");
    } catch {
      continue;
    }
    const reason = classifyTestFileContent(content);
    if (reason !== null) {
      const isIgnored = patterns.some((p) => matchPattern(relPath, p));
      if (!isIgnored) {
        violations.push({
          file: relPath,
          reason,
          lineToAdd: `  "${relPath}",`,
        });
      }
    }
  }

  return violations;
}

export function assertNoUnignoredSubprocessTests(
  root: string = process.cwd(),
  bunfigText?: string,
  targetDirs: readonly string[] = ["src", "scripts"],
): void {
  const violations = findUnignoredSubprocessTests(root, bunfigText, targetDirs);
  if (violations.length > 0) {
    throw new Error(formatUnignoredSubprocessTestFailure(violations));
  }
}
