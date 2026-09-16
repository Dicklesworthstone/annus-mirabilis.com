import { describe, expect, test } from "bun:test";
import { createStudioClock, TickScheduler } from "../experiments/scheduler/tickScheduler.ts";
import { appendExtractionLog, newExtractionLogRunId } from "./extractionLogging.ts";

const logRunId = newExtractionLogRunId();

describe("TickScheduler Runtime Extraction", () => {
  test("with an injected clock, dt equals the injected host delta and no fixed dt=1/60 assumption is made", () => {
    const start = performance.now();
    const clock = createStudioClock(0.01); // 100 Hz, not fixed 1/60
    const frame1 = clock.pump(0);
    expect(frame1.dt).toBe(0);

    const frame2 = clock.pump(15); // 15ms delta
    expect(frame2.dt).toBeCloseTo(0.015, 6);

    const frame3 = clock.pump(35); // 20ms delta
    expect(frame3.dt).toBeCloseTo(0.02, 6);

    appendExtractionLog({
      logRunId,
      testId: "tick-scheduler-injected-clock-dt",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "StudioClock respects injected clock delta without fixed dt=1/60 assumption",
    });
  });

  test("a paused clock produces no steps", () => {
    const start = performance.now();
    const scheduler = new TickScheduler(0.016, 0.0, 3);
    let ticksRan = 0;

    // Pump at nowS = 0
    scheduler.pump(0.0, () => {
      ticksRan++;
    });
    expect(ticksRan).toBe(1);

    // Clock paused at nowS = 0.0
    const steppedWhilePaused = scheduler.pump(0.0, () => {
      ticksRan++;
    });
    expect(steppedWhilePaused).toBe(0);
    expect(ticksRan).toBe(1);

    appendExtractionLog({
      logRunId,
      testId: "tick-scheduler-paused-clock",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "Paused clock produces zero simulation steps",
    });
  });

  test("donor-trap: tick drop past maxCatchup: jumping 10 frame intervals re-anchors and delivers at most 3 ticks", () => {
    // Characterization test pinning the donor trap where large time jumps drop ticks past maxCatchup
    // am-rt-worker-scheduler-7tl drives stepping by executed logical steps instead of dropping.
    const start = performance.now();
    const tickS = 0.016; // 16ms
    const maxCatchup = 3;
    const scheduler = new TickScheduler(tickS, 0.0, maxCatchup);

    let ticksRan = 0;
    // Initial pump at 0.0
    scheduler.pump(0.0, () => {
      ticksRan++;
    });
    expect(ticksRan).toBe(1);

    // Clock jumps 10 frame intervals (160ms)
    const jumpedNow = 10 * tickS;
    const ranOnJump = scheduler.pump(jumpedNow, () => {
      ticksRan++;
    });

    // Re-anchors and delivers at most maxCatchup ticks, dropping the remaining 7 backlog frames
    expect(ranOnJump).toBeLessThanOrEqual(maxCatchup);
    expect(scheduler.reanchors).toBeGreaterThan(0);

    appendExtractionLog({
      logRunId,
      testId: "donor-trap-tick-drop-past-maxcatchup",
      outcome: "pass",
      durationMs: performance.now() - start,
      message:
        "donor-trap: tick drop past maxCatchup confirmed; scheduler reanchors and caps delivered ticks",
    });
  });

  test("TickScheduler bounds catch-up backlog under ordinary frame pacing", () => {
    const start = performance.now();
    const scheduler = new TickScheduler(0.016, 0.0, 3);
    let tickCount = 0;

    const run1 = scheduler.pump(0.032, () => {
      tickCount++;
    });
    expect(run1).toBe(3); // 0.0, 0.016, 0.032
    expect(scheduler.ticksRun).toBe(3);

    appendExtractionLog({
      logRunId,
      testId: "tick-scheduler-bounded-catchup",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "TickScheduler steps on regular cadence under normal host pumping",
    });
  });
});
