#!/usr/bin/env node
/**
 * Runs every test file bunfig.toml excludes from `bun test`, plus the
 * scripts/e2e suite, under node --experimental-strip-types --test.
 *
 * Lane-level guard (am-xl9b):
 * Hashes generated/content before and after running the node lane.
 * If any test mutates generated/content, the lane fails and prints
 * the changed files and recovery instructions (bun run prepare:content).
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkOutFreshness } from "../src/testing/outFreshness.ts";
import {
  BUNFIG_RELATIVE_PATH,
  nodeOnlyTestArgs,
  nodeOnlyTestCommand,
} from "./quality-gates/bunfigNodeOnlyTests.ts";

export interface GeneratedContentSnapshot {
  readonly fileHashes: ReadonlyMap<string, string>;
}

export interface ContentDiff {
  readonly modified: readonly string[];
  readonly added: readonly string[];
  readonly deleted: readonly string[];
}

export function snapshotGeneratedContent(root: string = process.cwd()): GeneratedContentSnapshot {
  const targetDir = resolve(root, "generated/content");
  const fileHashes = new Map<string, string>();

  if (!existsSync(targetDir)) {
    return { fileHashes };
  }

  function walk(dir: string): void {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const relPath = relative(targetDir, fullPath).split("\\").join("/");
        const content = readFileSync(fullPath);
        const hash = createHash("sha256").update(content).digest("hex");
        fileHashes.set(relPath, hash);
      }
    }
  }

  walk(targetDir);
  return { fileHashes };
}

export function diffGeneratedContent(
  before: GeneratedContentSnapshot,
  after: GeneratedContentSnapshot,
): ContentDiff {
  const modified: string[] = [];
  const added: string[] = [];
  const deleted: string[] = [];

  for (const [path, beforeHash] of before.fileHashes.entries()) {
    const afterHash = after.fileHashes.get(path);
    if (afterHash === undefined) {
      deleted.push(path);
    } else if (beforeHash !== afterHash) {
      modified.push(path);
    }
  }

  for (const path of after.fileHashes.keys()) {
    if (!before.fileHashes.has(path)) {
      added.push(path);
    }
  }

  return { modified, added, deleted };
}

export function formatCorruptionReport(diff: ContentDiff): string {
  const lines: string[] = [
    "\n❌ FATAL: Node lane mutated generated/content!",
    "A test in the node lane wrote into or corrupted the compiled corpus during its run.",
    "",
    "Mutations detected under generated/content/:",
  ];

  for (const file of diff.modified) {
    lines.push(`  - modified: generated/content/${file}`);
  }
  for (const file of diff.added) {
    lines.push(`  - added:    generated/content/${file}`);
  }
  for (const file of diff.deleted) {
    lines.push(`  - deleted:  generated/content/${file}`);
  }

  lines.push(
    "",
    "RECOVERY:",
    "  Run `bun run prepare:content` to rebuild the canonical content corpus.",
    "  Then find and isolate the test that emitted to generated/content.",
    "",
  );

  return lines.join("\n");
}

export function runNodeOnlyTests(root: string = process.cwd()): number {
  const bunfigText = readFileSync(resolve(root, BUNFIG_RELATIVE_PATH), "utf8");
  const args = nodeOnlyTestArgs(bunfigText, root);
  const command = nodeOnlyTestCommand(args);
  console.log(`▶ ${command}`);

  // am-6v4k. The node lane went red roughly hourly with 7 to 9 failures, always the same cause:
  // out/ stale against HEAD. checkOutFreshness already diagnosed it correctly, but only from
  // inside foundCalculus.e2e, foundCalculus.browser and accessibleNamesBrowser, so the answer
  // arrived seven times, after each expensive browser or E2E test had paid to rediscover it.
  // Asking once, before anything spawns, costs a stat and a git call.
  //
  // This lane deliberately does NOT rebuild. A test lane that silently mutates out/ hides the
  // staleness it exists to expose, and makes every later result depend on whether it rebuilt
  // first. An absent out/ is NOT a failure either: the tests that need it skip when it is
  // missing, and failing here would break any clean checkout that has not built yet.
  const freshness = checkOutFreshness("out", root);
  if (freshness.present && !freshness.fresh) {
    console.error(
      [
        "",
        "✖ out/ is stale, run bun run build",
        `  ${freshness.reason ?? "no reason recorded"}`,
        "",
        "  Refusing to start the node lane. Seven browser and E2E tests would each rediscover",
        "  this one fact. This lane never rebuilds out/ for you, on purpose.",
        "",
      ].join("\n"),
    );
    return 1;
  }

  const beforeSnapshot = snapshotGeneratedContent(root);

  const result = spawnSync("node", ["--experimental-strip-types", "--test", ...args], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });

  const afterSnapshot = snapshotGeneratedContent(root);
  const diff = diffGeneratedContent(beforeSnapshot, afterSnapshot);
  const hasCorruption =
    diff.modified.length > 0 || diff.added.length > 0 || diff.deleted.length > 0;

  if (hasCorruption) {
    console.error(formatCorruptionReport(diff));
  }

  if (result.error) {
    console.error(`Failed to spawn node --test: ${result.error.message}`);
    return 1;
  }

  const testExitCode = result.status ?? (result.signal ? 1 : 0);
  if (hasCorruption) {
    return 1;
  }
  return testExitCode;
}

const isMain =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("run-node-only-tests.ts") ||
    pathToFileURL(process.argv[1]).href === import.meta.url);

if (isMain) {
  process.exit(runNodeOnlyTests());
}
