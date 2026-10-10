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
  /**
   * AN ENTRY WITH NO `interactionId` IS NOT AN INTERACTION, and the fallback that treated one as a
   * discrete interaction was never exercised until a real browser produced such entries.
   *
   * Measured 2026-10-10 on /lab/bm-01/ of the production build: 28 clicks produced 396 event
   * entries, of which 84 carried an interactionId -- exactly three per interaction, pointerdown,
   * pointerup and click -- and 312 carried 0. The 312 are `pointerover` (28), `pointerenter` (97),
   * `mouseover` (28), `mousedown` (28), `mouseup` (28), `pointerout` (26), `pointerleave` (51) and
   * `mouseout` (26): hover and the compatibility mouse events, which the Event Timing API gives no
   * interaction id BECAUSE they are not interactions. Counting each as its own interaction reported
   * 340 where 28 were driven, and across five routes it reported 1,404 interactions from 94 clicks.
   *
   * The catalogued method is "grouped by interactionId, taking each interaction's longest
   * duration". An entry with no interactionId is in no group.
   */
  test("excludes entries with no interactionId: 28 driven interactions are 28, not 340", () => {
    const entries: EventTimingEntry[] = [];
    for (let i = 1; i <= 28; i++) {
      for (const [name, duration] of [
        ["pointerdown", 16],
        ["pointerup", 24],
        ["click", 24 + i],
      ] as const) {
        entries.push({ name, entryType: "event", startTime: i * 50, duration, interactionId: i });
      }
    }
    // The hover and compatibility events, in the proportions the browser produced them.
    for (let i = 0; i < 312; i++) {
      entries.push({
        name: i % 2 === 0 ? "pointerenter" : "mouseover",
        entryType: "event",
        startTime: i * 7,
        duration: 900, // far over budget, so a wrong population is also a wrong verdict
        interactionId: 0,
      });
    }

    const result = evaluateInteractionLatency(entries);
    expect(result.interactionCount).toBe(28);
    expect(result.excludedEntryCount).toBe(312);
    // 28 longest durations are 25..52; nearest rank at p75 of 28 is the 21st, which is 45.
    expect(result.p75LatencyMs).toBe(45);
    expect(result.overBudget).toBe(false);
  });

  test("refuses a run that produced no interaction at all, however many entries", () => {
    const entries: EventTimingEntry[] = Array.from({ length: 300 }, (_, i) => ({
      name: "pointerenter",
      entryType: "event",
      startTime: i * 10,
      duration: 40,
      interactionId: 0,
    }));

    expect(() => evaluateInteractionLatency(entries)).toThrow(
      "at least 20 interaction samples required, got 0",
    );
  });
});
