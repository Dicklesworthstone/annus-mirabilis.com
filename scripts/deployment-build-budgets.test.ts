/**
 * THE RELEASE REFUSES AN OVER-BUDGET CANDIDATE BUILD (am-opd1).
 *
 * The defect: the verified deploy's gate chain runs the unit-test lane at step 5 and the BUILD at
 * step 9, so `runPerfBudgets.test.ts` measured the `out/` the PREVIOUS deploy left behind. 6b9ec998
 * shipped `out/papers/brownian-motion/index.html` at 256,141 bytes gzipped against a 250,000-byte
 * budget, because eaec86a3's tree had passed and the chain was green. The regression surfaced only
 * on the next deploy attempt.
 *
 * This file is in the bun lane and the gate runs in the release path, which is deliberate: AGENTS.md
 * says a gate's own proof must not live only in the lane that gate controls, or it disappears at
 * exactly the moment the gate fails open. Nothing here starts a release, and the two pure functions
 * are what the deploy calls.
 *
 * Both directions are covered, because a verdict function that refused everything would satisfy
 * every negative below and be useless: the positive control drives the REAL runner over the real
 * `out/` and requires a pass with both build-dependent rows measured.
 */

import { describe, expect, test } from "bun:test";
import {
  assertBuildBudgets,
  BuildBudgetError,
  type BuildBudgetVerdict,
  buildBudgetRefusal,
  buildBudgetVerdict,
} from "./deployment-build-budgets.ts";
import {
  BUILD_DEPENDENT_ROWS,
  type RunPerfBudgetsResult,
  runPerformanceBudgets,
} from "./run-perf-budgets.ts";

/** A result shaped like the runner's, with the metrics a case needs. */
function resultWith(
  metrics: Record<
    string,
    {
      status: "pass" | "fail" | "not-available";
      budget?: unknown;
      actual?: unknown;
      notes?: string;
    }
  >,
): RunPerfBudgetsResult {
  return {
    ok: false,
    logRunId: "test",
    toolRunId: "test",
    reportPath: "test",
    failedMetrics: Object.entries(metrics)
      .filter(([, m]) => m.status === "fail")
      .map(([id]) => id),
    report: {
      toolRunId: "test",
      logRunId: "test",
      timestamp: new Date(0).toISOString(),
      conditions: {
        hardware: "test",
        browser: "test",
        browserVersion: "0",
        viewport: { width: 1280, height: 900 },
        networkProfile: "test",
        cacheState: "cold",
        calibrationState: "provisional",
        buildRevision: "test",
      },
      routes: [],
      metrics: Object.fromEntries(
        Object.entries(metrics).map(([id, m]) => [
          id,
          {
            id,
            budget: m.budget ?? 250_000,
            actual: m.actual ?? 0,
            unit: "bytes",
            passed: m.status === "pass",
            status: m.status,
            ...(m.notes === undefined ? {} : { notes: m.notes }),
          },
        ]),
      ),
      outcome: "fail",
    },
  } as RunPerfBudgetsResult;
}

const bothPassing = {
  "initial-route-js": { status: "pass" as const, actual: 100_000, notes: "within budget" },
  "reading-face-html": { status: "pass" as const, actual: 200_000, notes: "within budget" },
};

describe("an over-budget build is refused, and the refusal names the page and its size", () => {
  test("the real 2026-09-23 failure, as the row reports it, refuses and names page and bytes", () => {
    // The notes string is the one readingFaceVerdict actually produces for a failure, so this is
    // the text a releaser would have seen on 6b9ec998 rather than a paraphrase of it.
    const verdict = buildBudgetVerdict(
      resultWith({
        ...bothPassing,
        "reading-face-html": {
          status: "fail",
          actual: 256_141,
          notes:
            "1 of 4 built reading faces fail: papers/brownian-motion/index.html: 256141 bytes gzipped, over the 250000 byte budget and not recorded",
        },
      }),
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.unmeasured).toEqual([]);
    const refusal = buildBudgetRefusal(verdict);
    // The page.
    expect(refusal).toContain("papers/brownian-motion/index.html");
    // Its gzip size, and the budget it broke.
    expect(refusal).toContain("256141");
    expect(refusal).toContain("250000");
    // And which row, so the reader knows what was measured.
    expect(refusal).toContain("reading-face-html");
  });

  test("an unmeasured build row refuses too, and says it is not a pass", () => {
    // The am-7bkr hole: a run whose build rows dropped out reported outcome "pass" on whatever
    // survived. Unmeasured is not met, and a release must not proceed on a budget nobody took.
    const verdict = buildBudgetVerdict(
      resultWith({
        "initial-route-js": { status: "pass", actual: 100_000 },
        "reading-face-html": { status: "not-available", actual: 0 },
      }),
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.unmeasured).toEqual(["reading-face-html"]);
    expect(verdict.failed).toEqual([]);
    const refusal = buildBudgetRefusal(verdict);
    expect(refusal).toContain("not a pass");
    expect(refusal).toContain("reading-face-html");
  });

  test("a row missing from the report entirely is unmeasured, not absent-and-fine", () => {
    const verdict = buildBudgetVerdict(resultWith({ "initial-route-js": { status: "pass" } }));
    expect(verdict.ok).toBe(false);
    expect(verdict.unmeasured).toEqual(["reading-face-html"]);
  });

  test("the initial-route-js row refuses on its own, so the gate is not reading-face only", () => {
    const verdict = buildBudgetVerdict(
      resultWith({
        ...bothPassing,
        "initial-route-js": {
          status: "fail",
          actual: 260_000,
          notes: "/papers/[paper]: 260000 bytes over the 204800 byte budget",
        },
      }),
    );
    expect(verdict.ok).toBe(false);
    expect(buildBudgetRefusal(verdict)).toContain("/papers/[paper]");
  });

  test("every build-dependent row is reported whether it passed or not", () => {
    // The release log should say what was measured, not only what failed. A gate that prints
    // nothing on success is a gate nobody can tell ran.
    const verdict = buildBudgetVerdict(resultWith(bothPassing));
    expect(verdict.ok).toBe(true);
    expect(verdict.measured).toHaveLength(BUILD_DEPENDENT_ROWS.length);
    for (const row of BUILD_DEPENDENT_ROWS) {
      expect(verdict.measured.some((line: string) => line.startsWith(`${row}:`))).toBe(true);
    }
  });
});

describe("the refusal is typed, and the two cases are told apart", () => {
  /** Catches and returns the refusal, so its code and rows can be read rather than just its text. */
  function refusalFrom(result: ReturnType<typeof resultWith>): BuildBudgetError {
    let thrown: unknown;
    try {
      assertBuildBudgets(result);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(BuildBudgetError);
    return thrown as BuildBudgetError;
  }

  test("an over-budget page refuses with build-budget-exceeded, naming the row", () => {
    const refusal = refusalFrom(
      resultWith({
        ...bothPassing,
        "reading-face-html": {
          status: "fail",
          actual: 256_141,
          notes:
            "1 of 4 built reading faces fail: papers/brownian-motion/index.html: 256141 bytes gzipped, over the 250000 byte budget and not recorded",
        },
      }),
    );
    expect(refusal.code).toBe("build-budget-exceeded");
    expect(refusal.rows).toHaveLength(1);
    expect(refusal.rows[0]).toContain("papers/brownian-motion/index.html");
  });

  test("a row with no verdict refuses with build-budget-unmeasured, a DIFFERENT code", () => {
    // The codes are distinct on purpose: one says make the page smaller, the other says the
    // measuring did not happen. One code for both would put them behind one grep.
    const refusal = refusalFrom(
      resultWith({
        "initial-route-js": { status: "pass", actual: 100_000 },
        "reading-face-html": { status: "not-available", actual: 0 },
      }),
    );
    expect(refusal.code).toBe("build-budget-unmeasured");
    expect(refusal.rows).toEqual(["reading-face-html"]);
  });

  test("a failure outranks an unmeasured row, so the actionable code is the one thrown", () => {
    const refusal = refusalFrom(
      resultWith({
        "initial-route-js": { status: "fail", actual: 260_000, notes: "/papers/[paper]: too big" },
        "reading-face-html": { status: "not-available", actual: 0 },
      }),
    );
    expect(refusal.code).toBe("build-budget-exceeded");
  });

  test("and a passing build throws nothing, returning the verdict it measured", () => {
    // The positive control for the thrower itself. Without it, a function that always threw would
    // satisfy all three cases above.
    const verdict = assertBuildBudgets(resultWith(bothPassing));
    expect(verdict.ok).toBe(true);
    expect(verdict.measured).toHaveLength(BUILD_DEPENDENT_ROWS.length);
  });
});

describe("the positive control, against the real build", () => {
  test("the real runner over the real out/ passes both build rows", async () => {
    // Without this, every refusal above would be satisfied by a verdict function that always
    // refuses. This drives the same call the deploy makes, over the tree on disk.
    const run = await runPerformanceBudgets({ silent: true });
    const verdict = buildBudgetVerdict(run);
    console.log(`[build budget gate] ${verdict.measured.join(" | ")}`);
    expect(verdict.unmeasured).toEqual([]);
    expect(verdict.failed).toEqual([]);
    expect(verdict.ok).toBe(true);
  }, 180_000);

  test("and a planted over-budget face in that real run is refused", async () => {
    // The runner's own plant for row 2. This is the end-to-end shape of the bead's second
    // acceptance item: a planted over-budget page in a build makes this gate refuse.
    const run = await runPerformanceBudgets({ silent: true, plantViolationRow: 2 });
    const verdict = buildBudgetVerdict(run);
    expect(verdict.ok).toBe(false);
    expect(verdict.failed.some((f: string) => f.startsWith("reading-face-html:"))).toBe(true);
    const refusal = buildBudgetRefusal(verdict);
    expect(refusal).toContain("Over budget");
    // The plant reports its own gzip size, so the refusal carries a byte count rather than a bare
    // row name; a real face reports its path too, which the first test above pins.
    expect(refusal).toMatch(/\d{6,} bytes gzipped/);
  }, 180_000);
});

export type { BuildBudgetVerdict };
