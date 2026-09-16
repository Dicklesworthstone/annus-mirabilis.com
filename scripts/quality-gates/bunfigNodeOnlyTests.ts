/**
 * bunfig.toml [test].pathIgnorePatterns is the single list of test files that
 * bun must not discover. Node must still run them. This module parses that
 * list so package.json, CI, and tests cannot drift from bunfig.
 */

import { type Dirent, existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

export const BUNFIG_RELATIVE_PATH = "bunfig.toml";
export const NODE_SUITE_ALWAYS = ["scripts/e2e/**/*.test.ts"] as const;
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "artifacts", "dist", "coverage"]);

export function parsePathIgnorePatterns(bunfigText: string): string[] {
  const block = bunfigText.match(/pathIgnorePatterns\s*=\s*\[([\s\S]*?)\]/);
  if (block === null || block[1] === undefined) {
    throw new Error(
      `bunfig.toml is missing [test].pathIgnorePatterns. Subprocess tests would run under bun test or nowhere.`,
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

function matchGlob(relPath: string, pattern: string): boolean {
  if (!pattern.includes("*")) {
    return relPath === pattern;
  }
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, ":::GLOBSTAR:::")
    .replace(/\*/g, "[^/]*")
    .replace(/:::GLOBSTAR:::/g, ".*");
  return new RegExp(`^${escaped}$`).test(relPath);
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
    return patterns.some((pattern) => matchGlob(rel, pattern));
  });
  return [...new Set(matched)].sort();
}

export function nodeOnlyTestArgs(bunfigText: string, root: string): string[] {
  const patterns = parsePathIgnorePatterns(bunfigText);
  const fromBunfig = expandIgnorePatternsToTestFiles(patterns, root);
  const args = [...NODE_SUITE_ALWAYS];
  for (const file of fromBunfig) {
    if (file === "scripts/e2e" || file.startsWith("scripts/e2e/")) continue;
    args.push(file);
  }
  for (const path of args) {
    if (path.includes("*")) continue;
    if (!existsSync(join(root, path)) && !existsSync(path)) {
      throw new Error(`node-only test path does not exist: ${path}`);
    }
  }
  return args;
}

export function nodeOnlyTestCommand(args: readonly string[]): string {
  return ["node", "--experimental-strip-types", "--test", ...args].join(" ");
}
