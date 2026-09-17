import { describe, expect, test } from "bun:test";
import { evaluateInstrumentFeedback, type PerformanceMarkRecord } from "./instrumentFeedback.ts";

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
