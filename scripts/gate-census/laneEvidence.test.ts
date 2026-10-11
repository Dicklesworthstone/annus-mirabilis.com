/**
 * THE SHARED WRITER EIGHT GATES DEPEND ON, AND THE DEFECT IT SHIPPED WITH (am-uxh9, pcjk.18).
 *
 * `retainLaneRun` is the one writer for a retained run: six browser lanes and two content audits
 * call it, and until this file it had no test at all. That is the wrong shape for a helper whose
 * whole job is to be believed later, and the cost was not hypothetical -- both of the defects
 * asserted below were live, and the first one was found by reading an artifact rather than by any
 * check:
 *
 * 1. `outcome` WAS COMPUTED FROM FAILURES ALONE AND IGNORED VACUITY. `audit-misconceptions.ts
 *    --root <an empty directory>` printed `examined 0 ledger records (minimum 20) VACUOUS` and
 *    exited 1, and wrote `"outcome": "passed"` in the summary beside it, because a corpus with
 *    nothing in it yields no findings. That is am-1hst's proposition ("a result computed over an
 *    empty population is not a clean result") reproduced in the evidence layer after being fixed in
 *    `summarize()`, and it is worse here: these files exist to be re-read when the terminal that
 *    said VACUOUS is gone and only the file remains.
 *
 * 2. THE BUILT IDENTITY WAS RECORDED FOR RUNS THAT NEVER OPENED AN EXPORT. The two audits walk
 *    `content/`, and stamping them `export built from <commit>` is a true statement about the
 *    checkout that invites a false inference about the run. It is keyed on the lane's own `export`
 *    declaration, which is the only thing that knows.
 *
 * IN THE BUN LANE, while the gates it serves are browser and fast steps, which is the lane
 * independence AGENTS.md asks for: a proof of a property of the evidence writer must not live only
 * in a lane whose own evidence that writer produces.
 *
 * EVERY CASE WRITES INTO A FRESH TEMPORARY ROOT, so the repository's own `artifacts/` is never
 * touched by a test and `headCommit` is exercised on a directory with no git -- where "unknown" is
 * the honest answer the helper documents, and asserting it is how that stays true.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { builtIdentity, newToolRunId, retainLaneRun } from "./laneEvidence.ts";

function scratch(): string {
  return mkdtempSync(join(tmpdir(), "am-lane-evidence-"));
}

/** A root carrying a built export that names `commit`, as `out/release.json` does. */
function withExport(commit: string, builtAt?: string): string {
  const root = scratch();
  mkdirSync(join(root, "out"), { recursive: true });
  writeFileSync(
    join(root, "out", "release.json"),
    JSON.stringify({ commit, ...(builtAt === undefined ? {} : { builtAt }) }),
    "utf8",
  );
  return root;
}

function summaryOf(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

describe("a retained run's outcome agrees with its census", () => {
  test("REGRESSION: a vacuous run is failed, even with no findings at all", () => {
    const root = scratch();
    const result = retainLaneRun({
      lane: "probe",
      root,
      examined: 0,
      noun: "ledger records",
      minimum: 20,
      failures: [],
    });
    const summary = summaryOf(result.path);
    // The three that disagreed: the returned flag, the recorded outcome, and the recorded reason.
    expect(result.vacuous).toBe(true);
    expect(summary.vacuous).toBe(true);
    expect(summary.outcome).toBe("failed");
    expect(summary.examined).toBe(0);
    // A reader of the file alone can tell WHY, without the terminal that is gone.
    expect((summary.failures as string[])[0]).toContain("examined 0 ledger records");
    expect((summary.failures as string[])[0]).toContain("minimum of 20");
  });

  test("a vacuous run KEEPS its own failures, with the shortfall added ahead of them", () => {
    const root = scratch();
    const result = retainLaneRun({
      lane: "probe",
      root,
      examined: 1,
      noun: "pages",
      minimum: 50,
      failures: ["/lab/me-02/: two controls share a name"],
    });
    const failures = summaryOf(result.path).failures as string[];
    expect(failures).toHaveLength(2);
    expect(failures[0]).toContain("judged too little to be cited");
    // Replacing them would lose the finding the run actually made, which is the one thing worth
    // keeping from a run that also judged too little.
    expect(failures[1]).toBe("/lab/me-02/: two controls share a name");
  });

  test("a run that met its floor and found nothing is passed, so neither verdict is stuck", () => {
    const root = scratch();
    const result = retainLaneRun({
      lane: "probe",
      root,
      examined: 58,
      noun: "pages",
      minimum: 50,
      failures: [],
    });
    const summary = summaryOf(result.path);
    expect(result.vacuous).toBe(false);
    expect(summary.vacuous).toBe(false);
    expect(summary.outcome).toBe("passed");
    expect(summary.failures).toEqual([]);
  });

  test("a run that met its floor and found something is failed", () => {
    const root = scratch();
    const summary = summaryOf(
      retainLaneRun({
        lane: "probe",
        root,
        examined: 58,
        noun: "pages",
        minimum: 50,
        failures: ["one finding"],
      }).path,
    );
    expect(summary.outcome).toBe("failed");
    expect(summary.vacuous).toBe(false);
  });
});

describe("the built identity is recorded only for a run that opened an export", () => {
  test("a lane that declares its export carries the commit that export was built from", () => {
    const root = withExport("1db44064e7c572ff81e9a7392ae2007109902372", "2026-10-11T16:27:18.146Z");
    const summary = summaryOf(
      retainLaneRun({
        lane: "probe",
        root,
        examined: 4,
        noun: "laboratories",
        minimum: 4,
        failures: [],
        export: join(root, "out"),
      }).path,
    );
    expect(summary.builtCommit).toBe("1db44064e7c572ff81e9a7392ae2007109902372");
    expect(summary.builtAt).toBe("2026-10-11T16:27:18.146Z");
    expect(summary.reads).toBeUndefined();
    // The source commit of a directory with no git is unknown, so the two differ and the run is
    // recorded as drifted. That is the pcjk.18 property: a retained run must not be able to claim a
    // commit it did not test.
    expect(summary.sourceCommit).toBe("unknown");
    expect(summary.builtFromSourceCommit).toBe(false);
  });

  test("an audit that declares no export says so, and claims no built commit", () => {
    // The export exists in this root; what decides is that the run did not say it opened one.
    const root = withExport("1db44064e7c572ff81e9a7392ae2007109902372");
    const summary = summaryOf(
      retainLaneRun({
        lane: "probe",
        root,
        examined: 41,
        noun: "readings-owner files",
        minimum: 30,
        failures: [],
      }).path,
    );
    expect(summary.builtCommit).toBeUndefined();
    expect(summary.builtAt).toBeUndefined();
    expect(summary.builtFromSourceCommit).toBeUndefined();
    expect(summary.reads).toBe("the source tree, not the built export");
  });

  test("builtIdentity answers unknown for a missing export rather than guessing", () => {
    // The defect this guards is the helper's own first version, which stored the SOURCE commit here
    // and so named a commit it had not tested.
    expect(builtIdentity(scratch())).toEqual({ commit: "unknown", builtAt: undefined });
    const noIdentity = scratch();
    mkdirSync(join(noIdentity, "out"), { recursive: true });
    writeFileSync(join(noIdentity, "out", "release.json"), "{}", "utf8");
    expect(builtIdentity(noIdentity)).toEqual({ commit: "unknown", builtAt: undefined });
  });
});

describe("the run id is the form AGENTS.md specifies", () => {
  test("a tool-run-id is a compact timestamp and eight hex digits", () => {
    expect(newToolRunId(new Date("2026-10-11T18:39:21.456Z"))).toMatch(
      /^20261011T183921Z-[0-9a-f]{8}$/,
    );
  });

  test("two ids from the same instant differ, so one run never overwrites another", () => {
    const at = new Date("2026-10-11T18:39:21.456Z");
    expect(newToolRunId(at)).not.toBe(newToolRunId(at));
  });
});
