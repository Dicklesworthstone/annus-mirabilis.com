/**
 * bunfig.toml [test].pathIgnorePatterns is the single list of test files that
 * bun must not discover. Node must still run them. This module parses that
 * list so package.json, CI, and tests cannot drift from bunfig.
 */

import { type Dirent, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

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
