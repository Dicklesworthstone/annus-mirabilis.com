import { describe, expect, test } from "bun:test";
import {
  aggregateInstrumentFeedback,
  evaluateInstrumentFeedback,
  type PerformanceMarkRecord,
  type RouteFeedback,
} from "./instrumentFeedback.ts";

describe("Instrument Feedback Mark Matching", () => {
  test("matches am:input, am:accepted, and am:painted by instanceId, actionIndex, and snapshotVersion", () => {
    const marks: PerformanceMarkRecord[] = [
      {
        name: "am:input",
        startTime: 100,
        detail: { instanceId: "inst-1", actionIndex: 1 },
      },
      {
        name: "am:accepted",
        startTime: 140,
        detail: { instanceId: "inst-1", actionIndex: 1, snapshotVersion: 3 },
      },
      {
        name: "am:painted",
        startTime: 175,
        detail: { instanceId: "inst-1", actionIndex: 1, snapshotVersion: 3 },
      },
    ];

    const result = evaluateInstrumentFeedback(marks);
    expect(result.actions).toHaveLength(1);
    const [action] = result.actions;
    expect(action).toBeDefined();
    if (!action) throw new Error("Expected action to be defined");
    expect(action.inputToAcceptedMs).toBe(40);
    expect(action.acceptedToPaintedMs).toBe(35);
    expect(action.totalFeedbackMs).toBe(75);
    expect(action.overBudget).toBe(false);
  });

  test("ignores pending-state paints and matches only the accepted snapshotVersion", () => {
    const marks: PerformanceMarkRecord[] = [
      {
        name: "am:input",
        startTime: 200,
        detail: { instanceId: "inst-1", actionIndex: 2 },
      },
      // Intermediate pending paint emitted while worker solves: MUST NOT COUNT
      {
        name: "am:painted",
        startTime: 210,
        detail: { instanceId: "inst-1", actionIndex: 2, status: "pending", snapshotVersion: 4 },
      },
      // Another mismatched version paint: MUST NOT COUNT
      {
        name: "am:painted",
        startTime: 220,
        detail: { instanceId: "inst-1", actionIndex: 2, snapshotVersion: 3 },
      },
      {
        name: "am:accepted",
        startTime: 250,
        detail: { instanceId: "inst-1", actionIndex: 2, snapshotVersion: 5 },
      },
      // Real accepted paint
      {
        name: "am:painted",
        startTime: 270,
        detail: { instanceId: "inst-1", actionIndex: 2, snapshotVersion: 5 },
      },
    ];

    const result = evaluateInstrumentFeedback(marks);
    expect(result.actions).toHaveLength(1);
    const [action] = result.actions;
    expect(action).toBeDefined();
    if (!action) throw new Error("Expected action to be defined");
    expect(action.acceptedSnapshotVersion).toBe(5);
    expect(action.paintedStartTime).toBe(270);
    expect(action.totalFeedbackMs).toBe(70);
  });

  test("excludes superseded actions with recorded reason", () => {
    const marks: PerformanceMarkRecord[] = [
      {
        name: "am:input",
        startTime: 300,
        detail: { instanceId: "inst-1", actionIndex: 3 },
      },
      {
        name: "am:accepted",
        startTime: 320,
        detail: {
          instanceId: "inst-1",
          actionIndex: 3,
          status: "superseded",
          reason: "action 4 superseded action 3 before solver finished",
        },
      },
    ];

    const result = evaluateInstrumentFeedback(marks);
    expect(result.actions).toHaveLength(0);
    expect(result.supersededExclusions).toHaveLength(1);
    const [exclusion] = result.supersededExclusions;
    expect(exclusion).toBeDefined();
    if (!exclusion) throw new Error("Expected exclusion to be defined");
    expect(exclusion.reason).toContain("superseded action 3");
  });

  test("fails on planted over-budget latency (> 100 ms)", () => {
    const marks: PerformanceMarkRecord[] = [
      {
        name: "am:input",
        startTime: 400,
        detail: { instanceId: "inst-1", actionIndex: 4 },
      },
      {
        name: "am:accepted",
        startTime: 480,
        detail: { instanceId: "inst-1", actionIndex: 4, snapshotVersion: 6 },
      },
      {
        name: "am:painted",
        startTime: 510, // 510 - 400 = 110 ms (> 100 ms budget)
        detail: { instanceId: "inst-1", actionIndex: 4, snapshotVersion: 6 },
      },
    ];

    const result = evaluateInstrumentFeedback(marks);
    const [action] = result.actions;
    expect(action).toBeDefined();
    if (!action) throw new Error("Expected action to be defined");
    expect(action.totalFeedbackMs).toBe(110);
    expect(result.overBudget).toBe(true);
  });
});

/**
 * THE FOLD THE BROWSER DRIVER USES, tested without a browser (am-snn0).
 *
 * `scripts/perf/measure-browser-budgets.mjs` cannot run on this machine -- Playwright's browsers
 * live on a volume that no longer holds them -- so the arithmetic was moved out of the driver's
 * Playwright loop and into `aggregateInstrumentFeedback`, leaving only the page driving untested.
 * The rule these cases exist for is the `null`: a fold that returned a row of zeros would publish
 * "0 ms, within a 100 ms budget", which is exactly what a real run produced for as long as
 * `markPainted` had no caller, and which reads like the best possible outcome.
 */
describe("aggregateInstrumentFeedback", () => {
  /** An evaluation carrying `n` actions, the worst of them `maxMs`. */
  function evaluation(n: number, maxMs: number, superseded = 0): RouteFeedback["evaluation"] {
    return {
      actions: Array.from({ length: n }, (_, i) => ({
        instanceId: `inst-${i}`,
        actionIndex: i,
        acceptedSnapshotVersion: i + 1,
        inputStartTime: 0,
        acceptedStartTime: maxMs / 2,
        paintedStartTime: maxMs,
        inputToAcceptedMs: maxMs / 2,
        acceptedToPaintedMs: maxMs / 2,
        totalFeedbackMs: maxMs,
        overBudget: maxMs > 100,
      })),
      supersededExclusions: Array.from({ length: superseded }, (_, i) => ({
        instanceId: `inst-${i}`,
        actionIndex: i,
        reason: "superseded by newer action",
      })),
      overBudget: n > 0 && maxMs > 100,
      maxFeedbackMs: n > 0 ? maxMs : 0,
      budgetMs: 100,
    };
  }

  test("returns null when no laboratory measured an action, rather than a row of zeros", () => {
    const perRoute: RouteFeedback[] = [
      { route: "/lab/bm-01/", evaluation: evaluation(0, 0) },
      { route: "/lab/lq-03/", evaluation: evaluation(0, 0) },
    ];
    expect(aggregateInstrumentFeedback(perRoute)).toBeNull();
  });

  test("returns null on an empty list, because a run that drove nothing measured nothing", () => {
    expect(aggregateInstrumentFeedback([])).toBeNull();
  });

  test("keeps the worst action and names the laboratory it came from", () => {
    const row = aggregateInstrumentFeedback([
      { route: "/lab/bm-01/", evaluation: evaluation(2, 40) },
      { route: "/lab/lq-03/", evaluation: evaluation(3, 88) },
      { route: "/lab/sr-01/", evaluation: evaluation(1, 12) },
    ]);
    expect(row?.maxFeedbackMs).toBe(88);
    expect(row?.worstRoute).toBe("/lab/lq-03/");
    expect(row?.actionsMeasured).toBe(6);
    expect(row?.instrumentsOperated).toBe(3);
    expect(row?.overBudget).toBe(false);
    expect(row?.budgetMs).toBe(100);
  });

  test("a laboratory that measured nothing is not counted as operated, while the others still are", () => {
    // The control for the opposite error: dropping silent laboratories entirely would make
    // `instrumentsOperated` equal the number driven and hide four refusals behind one answer.
    const row = aggregateInstrumentFeedback([
      { route: "/lab/bm-01/", evaluation: evaluation(2, 40) },
      { route: "/lab/lq-03/", evaluation: evaluation(0, 0) },
      { route: "/lab/sr-01/", evaluation: evaluation(0, 0) },
    ]);
    expect(row?.instrumentsOperated).toBe(1);
    expect(row?.actionsMeasured).toBe(2);
    expect(row?.worstRoute).toBe("/lab/bm-01/");
  });

  test("one laboratory over budget puts the whole row over budget", () => {
    const row = aggregateInstrumentFeedback([
      { route: "/lab/bm-01/", evaluation: evaluation(2, 40) },
      { route: "/lab/me-01/", evaluation: evaluation(1, 310) },
    ]);
    expect(row?.overBudget).toBe(true);
    expect(row?.maxFeedbackMs).toBe(310);
    expect(row?.worstRoute).toBe("/lab/me-01/");
  });

  test("superseded actions are counted across every laboratory, including silent ones", () => {
    // A superseded action is a coalesced burst, not a failure, and it is reported so that a small
    // action count beside a large exclusion count reads as coalescing rather than as refusal.
    const row = aggregateInstrumentFeedback([
      { route: "/lab/bm-01/", evaluation: evaluation(1, 20, 3) },
      { route: "/lab/lq-03/", evaluation: evaluation(0, 0, 4) },
    ]);
    expect(row?.supersededExcluded).toBe(7);
    expect(row?.actionsMeasured).toBe(1);
  });

  test("the budget travels from the evaluator, not from this fold", () => {
    const strict = { ...evaluation(1, 20), budgetMs: 50 };
    const row = aggregateInstrumentFeedback([{ route: "/lab/bm-01/", evaluation: strict }]);
    expect(row?.budgetMs).toBe(50);
  });
});
