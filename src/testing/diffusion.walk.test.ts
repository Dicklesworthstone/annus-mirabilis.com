import { describe, expect, test } from "bun:test";
import {
  BM01_ALLOCATION,
  BM05_ALLOCATION,
  bm01Tile,
  bm05Tile,
} from "../experiments/streams/allocation.ts";
import { brownianFrames } from "../physics/reference/diffusion.ts";
import { createPhiloxStream } from "../physics/reference/philox.ts";
import { withinTolerance } from "../units/tolerance.ts";
import { assertGaussianVariance } from "./stats/assertions.ts";

describe("brownianFrames reference walk generator (am-ref-diffusion-lr3 AC 15)", () => {
  const defaultParams = {
    nSeries: 4,
    steps: 10,
    stepKernel: 3,
    seed: "1905",
    diffusion: 0.5,
    dt: 0.1,
  };

  test("layout: length is nSeries * (steps + 1), row-major, every series starts at 0.0", () => {
    const res = brownianFrames(defaultParams);
    expect(res.kind).toBe("accepted");
    if (res.kind === "accepted") {
      expect(res.data.length).toBe(4 * (10 + 1));
      for (let s = 0; s < 4; s++) {
        expect(res.data[s * 11]).toBe(0.0);
      }
    }
  });

  test("prefix stability: series 0..M-1 are identical when generating larger ensembles", () => {
    const resSmall = brownianFrames({ ...defaultParams, nSeries: 3 });
    const resLarge = brownianFrames({ ...defaultParams, nSeries: 7 });
    expect(resSmall.kind).toBe("accepted");
    expect(resLarge.kind).toBe("accepted");
    if (resSmall.kind === "accepted" && resLarge.kind === "accepted") {
      const stride = defaultParams.steps + 1;
      for (let i = 0; i < 3 * stride; i++) {
        expect(resSmall.data[i]).toBe(resLarge.data[i]);
      }
    }
  });

  test("single-series regeneration: each series matches whether generated in ensemble or individually", () => {
    const ensemble = brownianFrames({ ...defaultParams, nSeries: 5 });
    expect(ensemble.kind).toBe("accepted");
    if (ensemble.kind === "accepted") {
      const stride = defaultParams.steps + 1;
      for (let seriesIdx = 0; seriesIdx < 5; seriesIdx++) {
        // Individual generation using Philox stream directly at the same tile
        const streamKernel = BM05_ALLOCATION.streamKernelId;
        const rng = createPhiloxStream({
          seed: defaultParams.seed,
          kernel: streamKernel,
          tile: seriesIdx,
        });
        const s = Math.sqrt(2 * defaultParams.diffusion * defaultParams.dt);
        let x = 0;
        expect(ensemble.data[seriesIdx * stride]).toBe(0);
        for (let step = 1; step <= defaultParams.steps; step++) {
          x += rng.nextNormal() * s;
          expect(ensemble.data[seriesIdx * stride + step]).toBe(x);
        }
      }
    }
  });

  test("allocation-driven tiles route BM-01 and BM-05 correctly", () => {
    // BM-01 allocation
    const bm01Run = brownianFrames({
      ...defaultParams,
      nSeries: 6,
      allocationId: BM01_ALLOCATION.allocationId,
      streamKernelId: BM01_ALLOCATION.streamKernelId,
    });
    expect(bm01Run.kind).toBe("accepted");
    if (bm01Run.kind === "accepted") {
      const s = Math.sqrt(2 * defaultParams.diffusion * defaultParams.dt);
      for (let series = 0; series < 6; series++) {
        const tracer = Math.floor(series / 3);
        const axis = series % 3;
        const tile = bm01Tile(tracer, axis);
        const rng = createPhiloxStream({
          seed: defaultParams.seed,
          kernel: BM01_ALLOCATION.streamKernelId,
          tile,
        });
        let x = 0;
        for (let step = 1; step <= defaultParams.steps; step++) {
          x += rng.nextNormal() * s;
          expect(bm01Run.data[series * 11 + step]).toBe(x);
        }
      }
    }

    // BM-05 allocation
    const bm05Run = brownianFrames({
      ...defaultParams,
      nSeries: 4,
      allocationId: BM05_ALLOCATION.allocationId,
      streamKernelId: BM05_ALLOCATION.streamKernelId,
    });
    expect(bm05Run.kind).toBe("accepted");
    if (bm05Run.kind === "accepted") {
      const s = Math.sqrt(2 * defaultParams.diffusion * defaultParams.dt);
      for (let series = 0; series < 4; series++) {
        const tile = bm05Tile(series);
        const rng = createPhiloxStream({
          seed: defaultParams.seed,
          kernel: BM05_ALLOCATION.streamKernelId,
          tile,
        });
        let x = 0;
        for (let step = 1; step <= defaultParams.steps; step++) {
          x += rng.nextNormal() * s;
          expect(bm05Run.data[series * 11 + step]).toBe(x);
        }
      }
    }
  });

  test("exact step arithmetic: bit-for-bit match for all 4 kernels", () => {
    const seed = "1905";
    const diffusion = 0.42;
    const dt = 0.05;
    const s = Math.sqrt(2 * diffusion * dt);
    const h = Math.sqrt(6 * diffusion * dt);

    for (const k of [0, 1, 2, 3] as const) {
      const frames = brownianFrames({ nSeries: 1, steps: 5, stepKernel: k, seed, diffusion, dt });
      expect(frames.kind).toBe("accepted");
      if (frames.kind === "accepted") {
        const rng = createPhiloxStream({ seed, kernel: BM05_ALLOCATION.streamKernelId, tile: 0 });
        let x = 0;
        for (let step = 1; step <= 5; step++) {
          let inc = 0;
          if (k === 0) inc = rng.nextU64() >> 63n ? s : -s;
          else if (k === 1) inc = (2 * rng.nextF64() - 1) * h;
          else if (k === 2) inc = rng.nextNormal();
          else if (k === 3) inc = rng.nextNormal() * s;
          x += inc;
          expect(frames.data[step]).toBe(x);
        }
      }
    }
  });

  test("kernel 2 vs 3 decision: kernel 2 is dimensionless unit-variance, kernel 3 scales by sqrt(2*D*dt)", () => {
    const seed = "777";
    const diffusion = 0.01; // small D so s != 1
    const dt = 0.01;
    const s = Math.sqrt(2 * diffusion * dt); // 0.01414... != 1.0

    const k2 = brownianFrames({ nSeries: 1, steps: 3, stepKernel: 2, seed, diffusion, dt });
    const k3 = brownianFrames({ nSeries: 1, steps: 3, stepKernel: 3, seed, diffusion, dt });
    expect(k2.kind).toBe("accepted");
    expect(k3.kind).toBe("accepted");
    if (k2.kind === "accepted" && k3.kind === "accepted") {
      // k2 and k3 are not silently identical
      expect(k2.data[1]!).not.toBe(k3.data[1]!);
      // k3 is exactly k2 * s
      expect(k3.data[1]!).toBeCloseTo(k2.data[1]! * s, 12);
    }
  });

  test("draw consumption: draw indices advance by documented amounts", () => {
    const rng = createPhiloxStream({ seed: "42", kernel: 1, tile: 0 });
    expect(rng.index).toBe(0n);
    rng.nextU64();
    expect(rng.index).toBe(1n);
    rng.nextF64();
    expect(rng.index).toBe(2n);
    rng.nextNormal();
    expect(rng.index).toBe(4n);
  });

  test("boundary seeds accepted as strings or bigint and numeric seed rejected", () => {
    const validSeeds = [
      "0",
      "9007199254740992",
      "9007199254740993",
      "18446744073709551615",
      0n,
      18446744073709551615n,
    ];
    for (const seed of validSeeds) {
      const res = brownianFrames({ ...defaultParams, nSeries: 1, steps: 2, seed });
      expect(res.kind).toBe("accepted");
    }

    // Number rejected
    // @ts-expect-error test invalid type
    const numRes = brownianFrames({ ...defaultParams, nSeries: 1, steps: 2, seed: 12345 });
    expect(numRes.kind).toBe("refused");
    if (numRes.kind === "refused") {
      expect(numRes.refusal.code).toBe("invalid-seed");
    }

    // Invalid string rejected
    const badStr = brownianFrames({ ...defaultParams, nSeries: 1, steps: 2, seed: "not-a-number" });
    expect(badStr.kind).toBe("refused");
    if (badStr.kind === "refused") {
      expect(badStr.refusal.code).toBe("invalid-seed");
    }

    // Adjacent large seeds produce distinct realizations
    const r1 = brownianFrames({ ...defaultParams, nSeries: 1, steps: 5, seed: "9007199254740992" });
    const r2 = brownianFrames({ ...defaultParams, nSeries: 1, steps: 5, seed: "9007199254740993" });
    expect(r1.kind).toBe("accepted");
    expect(r2.kind).toBe("accepted");
    if (r1.kind === "accepted" && r2.kind === "accepted") {
      let diff = false;
      for (let i = 1; i <= 5; i++) {
        if (r1.data[i] !== r2.data[i]) diff = true;
      }
      expect(diff).toBe(true);
    }
  });

  test("diffusion = 0 returns all zeros", () => {
    const res = brownianFrames({ ...defaultParams, diffusion: 0 });
    expect(res.kind).toBe("accepted");
    if (res.kind === "accepted") {
      expect(res.data.every((v) => v === 0)).toBe(true);
    }
  });

  test("domain refusals for invalid parameters", () => {
    const invalids = [
      { ...defaultParams, stepKernel: -1 },
      { ...defaultParams, stepKernel: 4 },
      { ...defaultParams, diffusion: -0.1 },
      { ...defaultParams, diffusion: NaN },
      { ...defaultParams, dt: 0 },
      { ...defaultParams, dt: -1 },
      { ...defaultParams, steps: 0 },
      { ...defaultParams, nSeries: 0 },
    ];
    for (const params of invalids) {
      const res = brownianFrames(params);
      expect(res.kind).toBe("refused");
    }
  });

  test("statistical policy: per-kernel step variance for N=10,000 series within chi-square bounds", () => {
    const D = 0.5;
    const dt = 0.05;
    const expectedVar = 2 * D * dt; // 0.05
    const nSeries = 10000;

    const run = brownianFrames({
      nSeries,
      steps: 1,
      stepKernel: 3,
      seed: "1905",
      diffusion: D,
      dt,
    });
    expect(run.kind).toBe("accepted");
    if (run.kind === "accepted") {
      const steps: number[] = [];
      for (let i = 0; i < nSeries; i++) {
        steps.push(run.data[i * 2 + 1]!);
      }
      const statRes = assertGaussianVariance({
        samples: steps,
        expectedVariance: expectedVar,
        mean: 0,
        testId: "walk-kernel3-step-variance-10k",
        alpha: 1e-4,
      });
      expect(statRes.passed).toBe(true);
    }
  });

  test("kernel 3 <x^2> at s in {1, 10, 100} scales linearly with step count", () => {
    const D = 0.5;
    const dt = 0.02;
    const nSeries = 5000;

    const run = brownianFrames({
      nSeries,
      steps: 100,
      stepKernel: 3,
      seed: "2026",
      diffusion: D,
      dt,
    });
    expect(run.kind).toBe("accepted");
    if (run.kind === "accepted") {
      for (const s of [1, 10, 100]) {
        let m2 = 0;
        for (let i = 0; i < nSeries; i++) {
          const x = run.data[i * 101 + s]!;
          m2 += x * x;
        }
        m2 /= nSeries;
        const expected = 2 * D * s * dt;
        expect(withinTolerance(m2, expected, { relative: 0.06 }).ok).toBe(true);
      }
    }
  });
});
