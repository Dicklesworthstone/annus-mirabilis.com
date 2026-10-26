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
import { TestLogger } from "../src/testing/log/logger.ts";
import { checkOutFreshness, type OutFreshnessResult } from "../src/testing/outFreshness.ts";
import {
  BUNFIG_RELATIVE_PATH,
  nodeOnlyTestArgs,
  nodeOnlyTestCommand,
} from "./quality-gates/bunfigNodeOnlyTests.ts";
import { partitionByOutDependence } from "./quality-gates/outDependence.ts";

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

/** Named, not counted: "3 static sources dirty" is unusable to the person who has to act on it. */
const NAMED_DIRTY_LIMIT = 30;

/**
 * The report half of the 2026-09-21 split (am-6v4k). Static sources dirty in the working tree are
 * a fact about a peer's in-flight work, not a verdict on out/, so they are printed and the lane
 * runs. Three things this text must keep doing, because a warning nobody reads is how the outage
 * recurs: name the files, appear in the FINAL output as well as the first, and say in the same
 * breath what it means for the result beside it.
 */
export function formatDirtyStaticSourcesNotice(files: readonly string[]): string {
  const named = files.slice(0, NAMED_DIRTY_LIMIT);
  const lines: string[] = [
    "",
    `⚠ ${files.length} static source file(s) are modified in the working tree and are NOT in out/:`,
  ];
  for (const file of named) {
    lines.push(`    ${file}`);
  }
  if (files.length > NAMED_DIRTY_LIMIT) {
    lines.push(
      `    (+${files.length - NAMED_DIRTY_LIMIT} more; the full list is`,
      "     git diff --name-only HEAD -- src/app src/components content)",
    );
  }
  lines.push(
    "",
    "  WHAT THIS MEANS FOR THE RESULT: this run describes out/ AS BUILT. A green says the built",
    "  artefact passes, not that the working tree passes. The files above are not in it, so it is",
    "  not a verdict on them; rebuild and rerun if you need one.",
    "",
    "  Not a failure, deliberately. Four agents always have uncommitted work, so refusing here was",
    "  permanently true: it switched this lane OFF for 49 commits and 48 test files while reading",
    "  like diligence (am-6v4k).",
    "",
  );
  return lines.join("\n");
}

/**
 * Seams for the lane's own test. The real defaults are the real behaviour; the test injects a
 * freshness result and a fake runner so the ORDER of the output can be asserted without spawning
 * node. The lane's test cannot live in the lane it gates, so it sits in the bun lane.
 */
export interface LaneDeps {
  readonly freshness?: OutFreshnessResult;
  readonly runTests?: (
    args: readonly string[],
    root: string,
  ) => { status: number | null; error?: Error | undefined };
  readonly write?: (line: string) => void;
  /**
   * One structured row per decision this lane makes (am-uxh9). Optional, so every existing caller
   * and the in-process tests are unaffected; `isMain` wires it to a TestLogger.
   *
   * WHY IT EXISTS. `node-content-lane` is a registered gate, required in CI and in all three
   * profiles, and `gatesPersistEvidence` found it leaving no artifact at all: the lane printed a
   * perfectly convincing report and exited, and once the terminal scrolled nothing recorded WHICH
   * of its four endings had happened. The four are not interchangeable -- a stale-out/ refusal, a
   * failure to spawn node, generated-content corruption, and ordinary test failures all return 1 --
   * and the first and third are not failures of any test. That is the same defect `typecheck-lane`
   * records one level further in: an exit code cannot say which half broke.
   *
   * NOT A CENSUS LINE. This lane's population is already declared in `scripts/gate-census/records.ts`
   * and read from node:test's OWN `pass N` summary, deliberately, because the runner is third-party.
   * Printing a second count here would be a competing source of truth for the same number, which
   * that file's docblock forbids in as many words.
   */
  readonly record?: (row: Readonly<{ testId: string; outcome: string; message: string }>) => void;
}

export function runNodeOnlyTests(
  root: string = process.cwd(),
  deps: LaneDeps = {},
  options: Readonly<{ outIndependentOnly?: boolean }> = {},
): number {
  const write = deps.write ?? ((line: string) => console.log(line));
  const record = deps.record ?? (() => {});
  const bunfigText = readFileSync(resolve(root, BUNFIG_RELATIVE_PATH), "utf8");
  const allArgs = nodeOnlyTestArgs(bunfigText, root);
  /*
   * THE out/-INDEPENDENT SUBSET, WHICH RUNS WHETHER OR NOT THE BUILD IS FRESH (am-hcx5's reach).
   *
   * The lane's freshness refusal below is lane-WIDE, and the lane holds tests that never read the
   * build: anything whose population is `git ls-files` has to run under node, because bun cannot
   * spawn git here. Measured 2026-10-20 with out/ stale: 37 of the 107 files reference nothing under
   * out/ even through their local imports and drive no browser, and all 37 passed in that state,
   * 223 tests, 0 fail, 39 seconds. The most important of them is the parser differential, whose
   * whole job is to catch a record this project's parser mis-reads -- and a content edit, which is
   * the only thing that can introduce one, is also what makes out/ stale.
   *
   * `outDependence.ts` derives the subset and says which direction its scan fails in.
   */
  const partition = partitionByOutDependence(allArgs, root);
  const args = options.outIndependentOnly ? partition.outIndependent : allArgs;
  const command = nodeOnlyTestCommand(args);
  if (options.outIndependentOnly) {
    write(
      `[lane] out/-independent subset: ${partition.outIndependent.length} of ${allArgs.length} ` +
        "node-lane files. The rest read the build or drive a browser and need bun run build.",
    );
  }
  write(`▶ ${command}`);
  record({
    testId: "lane-selection",
    outcome: args.length > 0 ? "passed" : "failed",
    message: options.outIndependentOnly
      ? `out/-independent subset: ${args.length} of ${allArgs.length} node-lane file(s) selected`
      : `full node lane: ${args.length} file(s) selected`,
  });

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
  //
  // WHAT IT REFUSES ON, after the 2026-09-21 split: out/ stale against the commit and the content
  // build it was made from. That is real, it is fixed by rebuilding, and it is therefore a
  // condition that can be false. What it no longer refuses on is a dirty working tree, which in a
  // four-pane shared tree never is.
  const freshness = deps.freshness ?? checkOutFreshness("out", root);
  if (!options.outIndependentOnly && freshness.present && !freshness.fresh) {
    write(
      [
        "",
        "✖ out/ is stale, run bun run build",
        `  ${freshness.reason ?? "no reason recorded"}`,
        "",
        "  Refusing to start the node lane. Seven browser and E2E tests would each rediscover",
        "  this one fact. This lane never rebuilds out/ for you, on purpose.",
        "",
        // A refusal that names no way forward trains people to treat it as noise, and the lane
        // holds 37 files that do not read the build at all -- the parser differential among them.
        `  ${partition.outIndependent.length} of these ${allArgs.length} files read neither out/ nor a`,
        "  browser. To run those now, without a build:",
        "",
        "      bun run test:node:content",
        "",
      ].join("\n"),
    );
    record({
      testId: "out-freshness",
      outcome: "failed",
      message: `REFUSED before spawning anything: ${freshness.reason ?? "no reason recorded"}`,
    });
    return 1;
  }
  record({
    testId: "out-freshness",
    outcome: "passed",
    message: freshness.present
      ? `out/ present and fresh (build commit ${freshness.buildCommit ?? "unrecorded"})`
      : "out/ absent, which this lane does not treat as a failure: the tests that need it skip",
  });

  const dirty = freshness.dirtyStaticSources ?? [];
  const dirtyNotice = dirty.length > 0 ? formatDirtyStaticSourcesNotice(dirty) : "";
  if (dirtyNotice) {
    write(dirtyNotice);
  }

  const beforeSnapshot = snapshotGeneratedContent(root);

  const runTests =
    deps.runTests ??
    ((testArgs: readonly string[], cwd: string) => {
      const spawned = spawnSync("node", ["--experimental-strip-types", "--test", ...testArgs], {
        cwd,
        env: process.env,
        stdio: "inherit",
      });
      return {
        status: spawned.status ?? (spawned.signal ? 1 : 0),
        error: spawned.error,
      };
    });
  const result = runTests(args, root);

  const afterSnapshot = snapshotGeneratedContent(root);
  const diff = diffGeneratedContent(beforeSnapshot, afterSnapshot);
  const hasCorruption =
    diff.modified.length > 0 || diff.added.length > 0 || diff.deleted.length > 0;

  if (hasCorruption) {
    write(formatCorruptionReport(diff));
  }
  record({
    testId: "generated-content-integrity",
    outcome: hasCorruption ? "failed" : "passed",
    message: hasCorruption
      ? `generated/content changed while the lane ran: ${diff.modified.length} modified, ${diff.added.length} added, ${diff.deleted.length} deleted`
      : `generated/content unchanged across ${beforeSnapshot.fileHashes.size} hashed file(s)`,
  });

  if (result.error) {
    write(`Failed to spawn node --test: ${result.error.message}`);
    if (dirtyNotice) {
      write(dirtyNotice);
    }
    record({
      testId: "node-test-spawn",
      outcome: "failed",
      message: `node --test could not be spawned: ${result.error.message}`,
    });
    return 1;
  }

  // Requirement 2 of the ruling: the notice goes in the FINAL output, not only the first. Whatever
  // prints last is what a person scrolling to the verdict, and a log reader tailing the file,
  // actually see. A notice four thousand lines above the result is invisible.
  if (dirtyNotice) {
    write(dirtyNotice);
  }

  const testExitCode = result.status ?? 0;
  record({
    testId: "node-test",
    outcome: testExitCode === 0 ? "passed" : "failed",
    message: `node --test over ${args.length} file(s) exited ${testExitCode}`,
  });
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
  const outIndependentOnly = process.argv.includes("--out-independent-only");
  // PERSISTED (am-uxh9). See LaneDeps.record for why: this is a registered, CI-required gate that
  // left no artifact, so its four distinguishable endings were indistinguishable afterwards.
  const logger = new TestLogger("node-lane");
  const status = runNodeOnlyTests(
    process.cwd(),
    { record: (row) => void logger.log(row) },
    { outIndependentOnly },
  );
  logger.log({
    testId: "node-lane-summary",
    outcome: status === 0 ? "passed" : "failed",
    message: `${outIndependentOnly ? "out/-independent subset" : "full node lane"} exited ${status}`,
  });
  await logger.flush();
  console.log(`Structured log: ${logger.filePath}`);
  process.exit(status);
}
