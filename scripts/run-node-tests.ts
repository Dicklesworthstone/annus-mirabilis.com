#!/usr/bin/env bun
/**
 * Runs every bun-ignored spawn test under node --test.
 * The ignore list in scripts/subprocess-test-ignore.json is the single source:
 * bunfig.toml and package.json "test" --path-ignore-patterns must match it.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export type SubprocessTestIgnore = Readonly<{
  bunPathIgnorePatterns: readonly string[];
  nodeTestRoots: readonly string[];
}>;

export function loadSubprocessTestIgnore(
  root: string = process.cwd(),
): SubprocessTestIgnore {
  const raw = JSON.parse(
    readFileSync(join(root, "scripts/subprocess-test-ignore.json"), "utf8"),
  ) as SubprocessTestIgnore;
  if (!Array.isArray(raw.bunPathIgnorePatterns) || raw.bunPathIgnorePatterns.length === 0) {
    throw new Error("scripts/subprocess-test-ignore.json is missing bunPathIgnorePatterns.");
  }
  if (!Array.isArray(raw.nodeTestRoots) || raw.nodeTestRoots.length === 0) {
    throw new Error("scripts/subprocess-test-ignore.json is missing nodeTestRoots.");
  }
  return raw;
}

function globStarE2e(root: string): string[] {
  const found: string[] = [];
  const skip = new Set(["node_modules", ".git", ".next", "artifacts", "dist", "coverage"]);
  function walk(dir: string): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (skip.has(entry.name) || entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".e2e.test.ts")) {
        found.push(relative(root, full).split("\\").join("/"));
      }
    }
  }
  walk(root);
  return found.sort();
}

/** Paths passed to `node --experimental-strip-types --test`. */
export function nodeTestPaths(root: string = process.cwd()): readonly string[] {
  const spec = loadSubprocessTestIgnore(root);
  const paths = new Set<string>(spec.nodeTestRoots);
  for (const pattern of spec.bunPathIgnorePatterns) {
    if (pattern === "**/*.e2e.test.ts") {
      for (const file of globStarE2e(root)) paths.add(file);
      continue;
    }
    if (pattern.includes("*")) {
      throw new Error(`Unsupported ignore glob in subprocess-test-ignore.json: ${pattern}`);
    }
    if (!statSync(join(root, pattern)).isFile()) {
      throw new Error(`Ignored spawn test is missing: ${pattern}`);
    }
    paths.add(pattern);
  }
  return [...paths].sort();
}

export function bunTestIgnoreArgs(root: string = process.cwd()): readonly string[] {
  return loadSubprocessTestIgnore(root).bunPathIgnorePatterns.flatMap((pattern) => [
    "--path-ignore-patterns",
    pattern,
  ]);
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].endsWith("run-node-tests.ts");

if (isMain) {
  const paths = nodeTestPaths();
  console.log(`node --experimental-strip-types --test ${paths.join(" ")}`);
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--test", ...paths],
    { cwd: process.cwd(), stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}
