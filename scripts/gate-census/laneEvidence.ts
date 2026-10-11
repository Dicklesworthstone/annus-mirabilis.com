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
 *
 * IT RECORDS THE COMMIT THAT WAS BUILT, NOT ONLY THE ONE IT WAS LAUNCHED FROM, and that correction
 * came from this helper being wrong on the day it was written. Every browser lane tests the static
 * export in `out/`, which is a build artifact: gitignored, not rebuilt by these lanes, and often
 * older than HEAD. The first version stored `headCommit()` alone, so a retained run NAMED A COMMIT
 * IT HAD NOT TESTED. Measured 2026-10-11: `out/release.json` said `edbfd7556` while HEAD was
 * `7fd4e5919`, with 21 commits touching `src/` in between -- four of them changing lab components
 * the lanes open -- and five lane runs had already been recorded against the source commit.
 *
 * So the summary carries `sourceCommit` and `builtCommit` separately, with `builtAt`, and says
 * plainly when they differ. A reader of the evidence can then tell "this lane passed on HEAD" from
 * "this lane passed on an export built eight hours before HEAD", which are different claims and
 * were indistinguishable before.
 *
 * IT LABELS RATHER THAN REFUSES, deliberately. A lane run against a stale export is still TRUE
 * about the artifact it opened; it is only false about the commit. Refusing here would turn five
 * registered gates red for a condition they do not own, and `bun run test:node` already carries the
 * staleness refusal ("out/ is stale, run bun run build") for the lanes that must have a fresh one.
 * This is evidence labelling, and the label is what was missing.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

/** What `out/release.json` says was built, or unknown when there is no export to ask. */
export function builtIdentity(
  root: string,
  exportDir = "out",
): Readonly<{ commit: string; builtAt: string | undefined }> {
  try {
    const raw = JSON.parse(readFileSync(join(root, exportDir, "release.json"), "utf8")) as {
      commit?: unknown;
      builtAt?: unknown;
    };
    return {
      commit: typeof raw.commit === "string" ? raw.commit : "unknown",
      builtAt: typeof raw.builtAt === "string" ? raw.builtAt : undefined,
    };
  } catch {
    // No export, or one without an identity: "unknown" is the honest answer and is recorded as such
    // rather than silently falling back to the source commit, which is the error this exists to fix.
    return { commit: "unknown", builtAt: undefined };
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
  /*
   * THE BUILT IDENTITY IS RECORDED ONLY FOR A RUN THAT SAYS WHICH EXPORT IT OPENED, because the
   * whole value of those fields is attributing a result to the artifact that produced it. Two
   * content audits now share this writer and neither reads `out/` at all: stamping them with the
   * export's commit is a true statement about the checkout that invites a false inference about the
   * run, and "export built from 9f1aed5ea" under a gate that walked `content/` is exactly the kind
   * of well-formed line this repository has recorded believing. `export` is the lane's own
   * declaration of what it opened, so it is the right thing to key on; all six browser lanes pass
   * it and the two audits do not.
   */
  const built = input.export === undefined ? undefined : builtIdentity(input.root);
  const drifted = built !== undefined && built.commit !== "unknown" && built.commit !== commit;
  /*
   * THE CENSUS IS TAKEN BEFORE THE SUMMARY IS WRITTEN, because `outcome` has to account for it.
   *
   * It did not, and the artifact disagreed with the terminal. `audit-misconceptions.ts --root <an
   * empty directory>` printed `examined 0 ledger records (minimum 20) VACUOUS` and exited 1, and
   * the summary beside it recorded `"outcome": "passed"` -- because a corpus with nothing in it
   * yields no findings, so `failures` was empty, so the run read as clean. That is am-1hst's defect
   * exactly ("a result computed over an empty population is not a clean result"), reproduced in the
   * evidence layer after being fixed in `summarize()`, and it was worse here than there: the whole
   * reason these summaries exist is to be re-read later, when the terminal that said VACUOUS is
   * gone and only the file that said "passed" remains.
   */
  const vacuous = reportPopulation({
    gate: input.lane,
    examined: input.examined,
    noun: input.noun,
    minimum: input.minimum,
  });
  const summary = {
    schemaVersion: 1,
    toolRunId: runId,
    lane: input.lane,
    // `commit` is kept as the SOURCE commit so existing readers do not change meaning, and the two
    // fields below are what make the claim attributable.
    commit,
    sourceCommit: commit,
    ...(built === undefined
      ? { reads: "the source tree, not the built export" }
      : {
          builtCommit: built.commit,
          builtAt: built.builtAt,
          builtFromSourceCommit: !drifted,
        }),
    ...(input.export === undefined ? {} : { export: input.export }),
    ...(input.baseUrl === undefined ? {} : { baseUrl: input.baseUrl }),
    examined: input.examined,
    noun: input.noun,
    minimum: input.minimum,
    vacuous,
    outcome: input.failures.length === 0 && !vacuous ? "passed" : "failed",
    failures: vacuous
      ? [
          `examined ${input.examined} ${input.noun}, fewer than the minimum of ${input.minimum} this lane declares, so the run judged too little to be cited`,
          ...input.failures,
        ]
      : input.failures,
    ...(input.extra ?? {}),
  };
  const path = join(runDir, "summary.json");
  writeFileSync(path, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(
    `Retained run: ${path} (source ${commit.slice(0, 9)}` +
      (built === undefined
        ? ", read from the source tree)"
        : `, export built from ${built.commit === "unknown" ? "an export with no recorded identity" : built.commit.slice(0, 9)}` +
          `${built.builtAt ? ` at ${built.builtAt}` : ""})`),
  );
  if (drifted)
    console.log(
      `  NOTE: this lane opened an export built from ${built?.commit.slice(0, 9)}, not from HEAD ` +
        `${commit.slice(0, 9)}. The result is true about that export and says nothing about HEAD. ` +
        `Run bun run build to make the two agree.`,
    );
  return { runId, commit, path, vacuous };
}
