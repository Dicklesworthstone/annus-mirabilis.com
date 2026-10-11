/**
 * ONE WRITER FOR A LANE'S RETAINED RUN (am-rc1001-bridge-plan-pcjk.18 criteria 2 and 3: "the lanes
 * ran against the restored line, and each retained run names its commit" and "one retained run of
 * each, with the commit, is cited in a comment").
 *
 * THE SILENCE THIS FILLS. That bead's finding, re-measured by the owner on 2026-10-09: five lane
 * scripts have "0 each" of writeFileSync / mkdirSync / appendFileSync, so "their only evidence is
 * commit messages; for example `e514e106` claims 'all 84 steps hold'". A run that cannot say which
 * commit it examined is the same kind of claim, written by a script instead of by a person.
 * journeys-in-lanes was given a summary on 2026-10-11; the other four printed a verdict to stdout
 * and kept nothing, so re-reading yesterday's result meant re-running yesterday's browser.
 *
 * IT IS A HELPER RATHER THAN FOUR COPIES because there are now five uses, which is this
 * repository's stated bar for a shared abstraction ("Extracting them into one helper waits on a
 * third use"). The sharper reason is drift: four hand-written summaries would disagree about field
 * names within a month, and a reader comparing two lanes' evidence could not tell a different
 * schema from a different result. The same argument retired the duplicated readings loader earlier
 * today.
 *
 * IT PRINTS THE CENSUS TOO, through `reportPopulation`, so a lane cannot retain a run and forget to
 * say what it examined -- the two obligations in criterion 1 and criterion 2 are discharged in one
 * call and cannot come apart. The caller gets back whether the population was vacuous and folds
 * that into its own exit code, because only the caller knows what else failed.
 *
 * `artifacts/` IS GITIGNORED (.gitignore:49), so a retained run is local to the machine that made
 * it. That is why `commit` is stored rather than only a timestamp, and why a citation of one of
 * these in a bead comment must quote the contents rather than only the path: a bare path is a
 * citation nobody else can open.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { reportPopulation } from "./population.ts";

/** The commit this run measured, so a retained run names its line rather than a wall-clock time. */
export function headCommit(root: string): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    // A worktree without git is a legitimate way to run a lane, and "unknown" is an honest answer
    // that a reader can act on. Throwing here would turn a missing convenience into a failed lane.
    return "unknown";
  }
}

/** The timestamp-plus-hex form AGENTS.md specifies for a `<tool-run-id>`. */
export function newToolRunId(now: Date = new Date()): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  return `${stamp}-${randomBytes(4).toString("hex")}`;
}

export type LaneRunInput = Readonly<{
  /** The registry step id, which is also the directory under artifacts/. */
  lane: string;
  root: string;
  /** How many of the thing the lane looked at, counted as it looked rather than declared. */
  examined: number;
  /** The thing, as a plural noun phrase: "laboratories opened with WebGL denied". */
  noun: string;
  /** The smallest count that is not vacuous, as the lane itself declares it. */
  minimum: number;
  failures: readonly string[];
  baseUrl?: string | undefined;
  export?: string | undefined;
  /** Anything this lane alone knows: its lane names, its journeys, its per-row record. */
  extra?: Readonly<Record<string, unknown>> | undefined;
}>;

export type LaneRunResult = Readonly<{
  runId: string;
  commit: string;
  path: string;
  /** True when the lane examined fewer than it declared it must. The caller folds this into exit. */
  vacuous: boolean;
}>;

export function retainLaneRun(input: LaneRunInput): LaneRunResult {
  const runId = newToolRunId();
  const runDir = join(input.root, "artifacts", input.lane, runId);
  mkdirSync(runDir, { recursive: true });
  const commit = headCommit(input.root);
  const summary = {
    schemaVersion: 1,
    toolRunId: runId,
    lane: input.lane,
    commit,
    ...(input.export === undefined ? {} : { export: input.export }),
    ...(input.baseUrl === undefined ? {} : { baseUrl: input.baseUrl }),
    examined: input.examined,
    noun: input.noun,
    minimum: input.minimum,
    outcome: input.failures.length === 0 ? "passed" : "failed",
    failures: input.failures,
    ...(input.extra ?? {}),
  };
  const path = join(runDir, "summary.json");
  writeFileSync(path, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  const vacuous = reportPopulation({
    gate: input.lane,
    examined: input.examined,
    noun: input.noun,
    minimum: input.minimum,
  });
  console.log(`Retained run: ${path} (commit ${commit.slice(0, 9)})`);
  return { runId, commit, path, vacuous };
}
