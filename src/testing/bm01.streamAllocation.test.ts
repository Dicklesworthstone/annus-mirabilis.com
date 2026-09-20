import { describe, expect, test } from "bun:test";
import { fromTracerDraft, toTracerDraft } from "../experiments/bm01/controls.ts";
import { BM01_DEFAULTS } from "../experiments/bm01/definition.ts";
import { decodeBm01Settings, encodeBm01Settings } from "../experiments/bm01/permalink.ts";
import {
  BM01_ALLOCATION,
  bm01Tile,
  streamAllocationRegistry,
} from "../experiments/streams/allocation.ts";
import { recordTracers, type TracerSetup } from "../physics/reference/diffusion/tracers.ts";
import { createPhiloxStream } from "../physics/reference/philox.ts";
import { compareBitwise } from "../units/tolerance.ts";
import { createBm01Recording, measureBm01 } from "../workers/operations/bm01.ts";

/**
 * Stream Allocation and Tracer Invariant Tests for BM-01 (am-bm-01-tracer-ensemble-hdly):
 * - Allocation ID bm-01.latent.v1 registered with kernel 0x19050001 and tile formula tile=3*i+axis
 * - Regenerating tracer 17's three axes alone reproduces the ensemble's values bitwise
 * - Tracer identities 0..17 match bitwise between M = 18 and M = 400 (prefix stability)
 * - Remeasurement (interval, axis, dimension, statistic) preserves latent positions bitwise with zero new draws
 * - The large seed 9007199254740993 survives permalink URL round trip exactly
 */

describe("bm01.streamAllocation: Stream Allocation & Latent Invariants", () => {
  const baseSetup: TracerSetup = {
    M: 20,
    steps: 10,
    h: 0.02,
    D: 0.315840243e-12,
    seed: "1905",
  };

  test("manifest allocation id is bm-01.latent.v1 and matches stream registry entry", () => {
    expect(BM01_ALLOCATION.allocationId).toBe("bm-01.latent.v1");
    expect(streamAllocationRegistry.hasAllocation("bm-01.latent.v1")).toBe(true);

    const alloc = streamAllocationRegistry.getAllocation("bm-01.latent.v1");
    expect(alloc.streamKernelId).toBe(0x19050001);
    expect(alloc.streamVersion).toBe(1);
    expect(alloc.block).toBe("production");
    expect(alloc.tileFormula).toBe("tile=3*i+axis");
    expect(alloc.computeTile(17, 0)).toBe(51);
    expect(alloc.computeTile(17, 1)).toBe(52);
    expect(alloc.computeTile(17, 2)).toBe(53);
  });

  test("regenerating tracer 17's three axes alone reproduces the ensemble values bitwise", async () => {
    // Generate ensemble containing tracer 17 (M = 20)
    const ensembleComp = await recordTracers(baseSetup, { yieldControl: async () => {} });
    expect(ensembleComp.kind).toBe("accepted");
    if (ensembleComp.kind !== "accepted") return;

    const ensemble = ensembleComp.data;
    const tracerIndex = 17;
    const steps = baseSetup.steps;
    const amplitude = Math.sqrt(2 * baseSetup.D * baseSetup.h);

    // For each of the 3 axes (0 for x, 1 for y, 2 for z), regenerate tracer 17 directly
    for (let axis = 0; axis < 3; axis++) {
      const tile = bm01Tile(tracerIndex, axis);
      expect(tile).toBe(3 * tracerIndex + axis);

      const rng = createPhiloxStream({
        seed: baseSetup.seed,
        kernel: BM01_ALLOCATION.streamKernelId,
        tile,
      });

      const seriesIndex = tracerIndex * 3 + axis;
      const offset = seriesIndex * (steps + 1);

      let expectedPosition = 0;
      for (let step = 1; step <= steps; step++) {
        expectedPosition += rng.nextNormal() * amplitude;
        const actualPosition = ensemble.values[offset + step];

        expect(actualPosition).toBeDefined();
        if (actualPosition === undefined) throw new Error("Missing step position");

        // Must match bitwise via Object.is
        expect(Object.is(actualPosition, expectedPosition)).toBe(true);
      }
    }
  });

  test("tracer identities match bitwise between M = 18 and M = 400 (prefix stability)", async () => {
    const setup18: TracerSetup = { ...baseSetup, M: 18, steps: 5 };
    const setup400: TracerSetup = { ...baseSetup, M: 400, steps: 5 };

    const comp18 = await recordTracers(setup18, { yieldControl: async () => {} });
    const comp400 = await recordTracers(setup400, { yieldControl: async () => {} });

    expect(comp18.kind).toBe("accepted");
    expect(comp400.kind).toBe("accepted");
    if (comp18.kind !== "accepted" || comp400.kind !== "accepted") return;

    const values18 = comp18.data.values;
    const values400 = comp400.data.values;
    const stride = setup18.steps + 1;

    // All 18 tracers (each having 3 series) in M = 18 must be bitwise identical in M = 400
    const seriesCount18 = 18 * 3;
    for (let series = 0; series < seriesCount18; series++) {
      const slice18 = values18.subarray(series * stride, (series + 1) * stride);
      const slice400 = values400.subarray(series * stride, (series + 1) * stride);

      const check = compareBitwise(slice18, slice400);
      expect(check.ok).toBe(true);
      if (!check.ok) {
        throw new Error(`Prefix mismatch at series ${series}: ${check.detail}`);
      }
    }
  });

  test("changing observation interval, axis, or dimension leaves positions bitwise identical", async () => {
    const params = {
      ...BM01_DEFAULTS,
      M: 20,
      H: 0.2,
      h: 0.02,
      interval: 0.02,
    };
    const recordingComp = await createBm01Recording(params, { yieldControl: async () => {} });
    expect(recordingComp.kind).toBe("accepted");
    if (recordingComp.kind !== "accepted") return;

    const recording = recordingComp.data;
    const baselineSnapshot = recording.values.slice();
    const initialDraws = recording.draws;

    // Measurement change 1: interval
    const measured1 = measureBm01(recording, { ...params, interval: 0.04 }, true);
    expect(measured1.kind).toBe("accepted");
    expect(compareBitwise(recording.values, baselineSnapshot).ok).toBe(true);
    expect(recording.draws).toBe(initialDraws);

    // Measurement change 2: dimension & axis
    const measured2 = measureBm01(recording, { ...params, axis: 1, d: 2 }, true);
    expect(measured2.kind).toBe("accepted");
    expect(compareBitwise(recording.values, baselineSnapshot).ok).toBe(true);
    expect(recording.draws).toBe(initialDraws);

    // Estimator change: statistic
    const measured3 = measureBm01(recording, { ...params, statistic: "apparent" }, true);
    expect(measured3.kind).toBe("accepted");
    expect(compareBitwise(recording.values, baselineSnapshot).ok).toBe(true);
    expect(recording.draws).toBe(initialDraws);
  });

  test("the seed 9007199254740993 survives permalink URL round trip and draft conversions", () => {
    const seed = "9007199254740993";
    const params = { ...BM01_DEFAULTS, seed };

    // 1. Controls draft round trip
    const draft = toTracerDraft(params);
    expect(draft.seed).toBe(seed);
    const restored = fromTracerDraft(draft);
    expect(restored.seed).toBe(seed);

    // 2. Permalink query string round trip
    const query = encodeBm01Settings(params);
    expect(query).toContain(`seed=${seed}`);
    const decoded = decodeBm01Settings(query);
    expect(decoded.kind).toBe("settings");
    if (decoded.kind === "settings") {
      expect(decoded.parameters.seed).toBe(seed);
    }
  });
});
