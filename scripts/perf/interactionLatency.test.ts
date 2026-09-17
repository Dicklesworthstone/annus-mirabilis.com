import { describe, expect, test } from "bun:test";
import { type EventTimingEntry, evaluateInteractionLatency } from "./interactionLatency.ts";

describe("Interaction Latency Evaluation", () => {
  test("refuses fewer than 20 interaction samples", () => {
    const entries: EventTimingEntry[] = Array.from({ length: 10 }, (_, i) => ({
      name: "pointerdown",
      entryType: "event",
      startTime: i * 100,
      duration: 32,
      interactionId: i + 1,
    }));

    expect(() => evaluateInteractionLatency(entries)).toThrow(
      "at least 20 interaction samples required, got 10",
    );
  });

  test("groups entries by interactionId taking the longest duration per interaction", () => {
    // 20 interactions, each with a pointerdown and click event with differing durations
    const entries: EventTimingEntry[] = [];
    for (let i = 1; i <= 20; i++) {
      entries.push({
        name: "pointerdown",
        entryType: "event",
        startTime: i * 50,
        duration: 10,
        interactionId: i,
      });
      entries.push({
        name: "click",
        entryType: "event",
        startTime: i * 50 + 10,
        duration: i * 8, // from 8 ms to 160 ms
        interactionId: i,
      });
    }

    const result = evaluateInteractionLatency(entries);
    expect(result.interactionCount).toBe(20);
    // 20 sorted durations: 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120, 128, 136, 144, 152, 160
    // 15th sorted value is 15 * 8 = 120 ms
    expect(result.p75LatencyMs).toBe(120);
    expect(result.overBudget).toBe(false);
  });

  test("selects exactly the 15th of 20 sorted values for p75", () => {
    // Generate exactly 20 values 1..20
    const entries: EventTimingEntry[] = Array.from({ length: 20 }, (_, i) => ({
      name: "click",
      entryType: "event",
      startTime: i * 100,
      duration: i + 1, // 1 to 20
      interactionId: i + 1,
    }));

    const result = evaluateInteractionLatency(entries);
    expect(result.p75LatencyMs).toBe(15);
  });

  test("fails on planted over-budget input (> 200 ms)", () => {
    // 20 interactions where the 15th value is 208 ms (> 200 ms budget)
    const entries: EventTimingEntry[] = Array.from({ length: 20 }, (_, i) => ({
      name: "click",
      entryType: "event",
      startTime: i * 100,
      duration: i < 14 ? 50 : 208, // 15th to 20th are 208 ms
      interactionId: i + 1,
    }));

    const result = evaluateInteractionLatency(entries);
    expect(result.p75LatencyMs).toBe(208);
    expect(result.overBudget).toBe(true);
  });
});
