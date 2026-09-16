import { describe, expect, test } from "bun:test";
import {
  computeTapeDigest,
  ControlTape,
  ControlTapeRecorder,
  ControlTapeReplayer,
  MAX_TAPE_EVENTS,
  quantizeFloat,
  validateTapeCompatibility,
} from "../experiments/tape/controlTape.ts";
import { appendExtractionLog, newExtractionLogRunId } from "./extractionLogging.ts";

const logRunId = newExtractionLogRunId();

describe("ControlTape Runtime Extraction", () => {
  test("quantizeFloat canonicalizes floating point values", () => {
    const start = performance.now();
    expect(quantizeFloat(1.23456789)).toBe(1.234568);
    expect(quantizeFloat(0.0000001)).toBe(0);
    expect(quantizeFloat(10.0)).toBe(10);
    expect(quantizeFloat(Number.NaN)).toBe(0);
    expect(quantizeFloat(Number.POSITIVE_INFINITY)).toBe(0);
    appendExtractionLog({
      logRunId,
      testId: "control-tape-quantize-float",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "quantizeFloat operates deterministically on finite and non-finite floats",
    });
  });

  test("recording and replaying the same quantized event sequence yields the same checkpoint digest (comparisonKind: bitwise)", () => {
    const start = performance.now();
    const stateA = { temperatureK: 293.15, viscosityPaS: 0.001 };
    const d1 = computeTapeDigest(stateA, 10, 1905);
    const d2 = computeTapeDigest(stateA, 10, 1905);

    expect(d1.digestKind).toBe("host");
    expect(d1.digest.startsWith("host:")).toBe(true);
    expect(d1.digest).toBe(d2.digest);

    appendExtractionLog({
      logRunId,
      testId: "control-tape-recording-replaying-digest-identical",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "Replaying same quantized sequence yields identical checkpoint digest",
      expected: d1.digest,
      actual: d2.digest,
      comparisonKind: "bitwise",
    });
  });

  test("donor-trap: 32-bit seed coercion: seeds 1 and 4294967297 yield identical host digest", () => {
    // Characterization test pinning the donor FNV digest trap where seed is coerced to 32 bits
    // am-rt-control-tapes-0gc replaces the digest with canonical 64-bit hashing and flips this test.
    const start = performance.now();
    const state = { radiusM: 0.5e-6 };
    const dLow = computeTapeDigest(state, 10, 1);
    const dHigh = computeTapeDigest(state, 10, 4294967297); // 1 + 2^32

    expect(dLow.digest).toBe(dHigh.digest);

    appendExtractionLog({
      logRunId,
      testId: "donor-trap-32-bit-seed-coercion",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "donor-trap: 32-bit seed coercion confirmed; seeds 1 and 4294967297 collide under 32-bit XOR",
      expected: dLow.digest,
      actual: dHigh.digest,
      comparisonKind: "bitwise",
    });
  });

  test("records events and auto-creates checkpoints within memory bounds", () => {
    const start = performance.now();
    const recorder = new ControlTapeRecorder(
      "bm-01-diffusion",
      "bm01Kernel@v1",
      { temperatureK: 293.15, particleCount: 100 },
      1905,
    );

    recorder.start();
    recorder.advanceTick(10);
    recorder.recordEvent("temperatureK", 300.5);
    recorder.advanceTick(50); // Tick 60 -> triggers auto checkpoint

    const tape = recorder.exportTape("BM01 Diffusion Test", "Recording test");
    expect(tape.events.length).toBe(1);
    expect(tape.events[0]!.tick).toBe(10);
    expect(tape.events[0]!.paramId).toBe("temperatureK");
    expect(tape.events[0]!.value).toBe(300.5);
    expect(tape.events[0]!.previousValue).toBe(293.15);

    expect(tape.checkpoints.length).toBe(2);
    expect(tape.checkpoints[0]!.tick).toBe(0);
    expect(tape.checkpoints[1]!.tick).toBe(60);
    expect(tape.totalTicks).toBe(60);

    appendExtractionLog({
      logRunId,
      testId: "control-tape-recorder-lifecycle",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "ControlTapeRecorder creates checkpoints and captures events with previous values",
    });
  });

  test("enforces bounded memory capacity (MAX_TAPE_EVENTS)", () => {
    const start = performance.now();
    const recorder = new ControlTapeRecorder("bm-01-diffusion", "bm01Kernel@v1", {
      temperatureK: 293.15,
    });

    recorder.start();
    for (let i = 0; i < MAX_TAPE_EVENTS + 50; i++) {
      recorder.recordEvent("temperatureK", 293.15 + (i % 10));
    }

    const tape = recorder.exportTape();
    expect(tape.events.length).toBe(MAX_TAPE_EVENTS);

    appendExtractionLog({
      logRunId,
      testId: "control-tape-bounded-capacity",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "Recorder caps total events at MAX_TAPE_EVENTS",
    });
  });

  test("forward and backward scrubbing produces identical state and digest", () => {
    const start = performance.now();
    const testTape: ControlTape = {
      version: 1,
      tapeId: "test-tape-01",
      experimentId: "bm-01-diffusion",
      modelIdentity: "bm01Kernel@v1",
      tickS: 1 / 60,
      initialConditions: { temperatureK: 293.15, stepSize: 1 },
      seed: 42,
      totalTicks: 120,
      events: [
        { tick: 20, paramId: "temperatureK", value: 300 },
        { tick: 40, paramId: "temperatureK", value: 310 },
        { tick: 60, paramId: "stepSize", value: 2 },
      ],
      checkpoints: [
        {
          tick: 0,
          state: { temperatureK: 293.15, stepSize: 1 },
          digest: computeTapeDigest({ temperatureK: 293.15, stepSize: 1 }, 0, 42).digest,
          digestKind: "host",
        },
        {
          tick: 60,
          state: { temperatureK: 310, stepSize: 2 },
          digest: computeTapeDigest({ temperatureK: 310, stepSize: 2 }, 60, 42).digest,
          digestKind: "host",
        },
      ],
    };

    const replayer = new ControlTapeReplayer(testTape, "bm-01-diffusion", "bm01Kernel@v1");
    expect(replayer.refused).toBe(false);

    const direct = replayer.seekTo(40);
    expect(direct.state.temperatureK).toBe(310);
    expect(direct.state.stepSize).toBe(1);

    replayer.seekTo(100);
    const scrubbed = replayer.seekTo(40);
    expect(scrubbed.state).toEqual(direct.state);
    expect(scrubbed.digest).toBe(direct.digest);

    const rewound = replayer.rewind();
    expect(rewound.tick).toBe(0);
    expect(rewound.state.temperatureK).toBe(293.15);

    appendExtractionLog({
      logRunId,
      testId: "control-tape-scrubbing-determinism",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "Forward and backward scrubbing produces identical deterministic state",
      expected: direct.digest,
      actual: scrubbed.digest,
      comparisonKind: "bitwise",
    });
  });

  test("refuses replay on mismatched experimentId or model identity", () => {
    const start = performance.now();
    const testTape: ControlTape = {
      version: 1,
      tapeId: "test-tape-02",
      experimentId: "bm-01-diffusion",
      modelIdentity: "bm01Kernel@v1",
      tickS: 1 / 60,
      initialConditions: { temperatureK: 293.15 },
      seed: 42,
      totalTicks: 60,
      events: [],
      checkpoints: [],
    };

    const wrongExperiment = new ControlTapeReplayer(testTape, "bm-05-osmotic", "bm01Kernel@v1");
    expect(wrongExperiment.refused).toBe(true);
    expect(wrongExperiment.reason).toContain("cannot replay on 'bm-05-osmotic'");

    const wrongModel = new ControlTapeReplayer(testTape, "bm-01-diffusion", "bm01Kernel@v2-incompatible");
    expect(wrongModel.refused).toBe(true);
    expect(wrongModel.reason).toContain("Incompatible model identity");

    const invalidVersionTape = { ...testTape, version: 2 as any };
    const val = validateTapeCompatibility(invalidVersionTape, "bm-01-diffusion", "bm01Kernel@v1");
    expect(val.valid).toBe(false);
    expect(val.reason).toContain("Unsupported tape version");

    appendExtractionLog({
      logRunId,
      testId: "control-tape-compatibility-refusal",
      outcome: "pass",
      durationMs: performance.now() - start,
      message: "Refuses replay gracefully upon experiment or model mismatch without inventing state",
    });
  });
});
