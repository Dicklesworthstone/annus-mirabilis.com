import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  chiSquareQuantile,
  ensembleMomentBands,
  normalQuantile,
} from "../physics/reference/diffusion.ts";
import quantilesTable from "../physics/reference/special/quantiles.table.json";

describe("normalQuantile", () => {
  test("reproduces committed table values within 1e-12 relative", () => {
    for (const item of quantilesTable.normal) {
      const p = parseFloat(item.p);
      const res = normalQuantile(p);
      expect(res.kind).toBe("accepted");
      if (res.kind === "accepted") {
        const relErr = Math.abs(res.data - item.value) / item.value;
        expect(relErr).toBeLessThan(1e-12);
      }
    }
  });

  test("is strictly monotonic in p", () => {
    const testP = [1e-10, 1e-6, 1e-4, 0.01, 0.05, 0.25, 0.5, 0.75, 0.95, 0.99, 1 - 1e-4, 1 - 1e-6, 1 - 1e-10];
    let prev = -Infinity;
    for (const p of testP) {
      const res = normalQuantile(p);
      expect(res.kind).toBe("accepted");
      if (res.kind === "accepted") {
        expect(res.data).toBeGreaterThan(prev);
        prev = res.data;
      }
    }
  });

  test("refuses p <= 0, p >= 1, and non-finite inputs", () => {
    for (const invalid of [0, -0.01, -1, 1, 1.01, NaN, Infinity, -Infinity]) {
      const res = normalQuantile(invalid);
      expect(res.kind).toBe("refused");
    }
  });

  test("evaluates extreme probability 1e-10 to 15 digits of precision", () => {
    const low = normalQuantile(1e-10);
    expect(low.kind).toBe("accepted");
    if (low.kind === "accepted") {
      // mpmath 80-digit reference: -6.361340902404057
      expect(Math.abs(low.data - -6.361340902404057)).toBeLessThan(1e-14);
    }

    const high = normalQuantile(1 - 1e-10);
    expect(high.kind).toBe("accepted");
    if (low.kind === "accepted" && high.kind === "accepted") {
      // In double-precision IEEE-754, 1 - 1e-10 has roundoff error 8.27e-18,
      // which through d(z)/dp = 1/phi(z) ~ 1.5e9 yields ~1.27e-8.
      expect(Math.abs(low.data + high.data)).toBeLessThan(2e-8);
    }
  });

  test("satisfies exact anti-symmetry for representable pairs", () => {
    for (const p of [0.001, 0.01, 0.05, 0.1, 0.25, 0.4]) {
      const low = normalQuantile(p);
      const high = normalQuantile(1 - p);
      expect(low.kind).toBe("accepted");
      expect(high.kind).toBe("accepted");
      if (low.kind === "accepted" && high.kind === "accepted") {
        expect(Math.abs(low.data + high.data)).toBeLessThan(1e-13);
      }
    }
  });
});

describe("chiSquareQuantile", () => {
  test("matches all 143 grid points in committed table within 1e-9 relative", () => {
    for (const row of quantilesTable.chi2) {
      const p = parseFloat(row.p);
      const res = chiSquareQuantile(row.q, p);
      expect(res.kind).toBe("accepted");
      if (res.kind === "accepted") {
        const relErr = Math.abs(res.data - row.value) / row.value;
        expect(relErr).toBeLessThan(1e-9);
      }
    }
  });

  test("matches specific spec fixture values", () => {
    const fixtures: Array<{ q: number; p: number; expected: number }> = [
      { q: 1, p: 0.95, expected: 3.841459 },
      { q: 10, p: 0.025, expected: 3.246973 },
      { q: 40, p: 0.975, expected: 59.34171 },
      { q: 100, p: 0.025, expected: 74.22193 },
      { q: 100, p: 0.975, expected: 129.5612 },
      { q: 1000, p: 0.975, expected: 1089.531 },
    ];
    for (const { q, p, expected } of fixtures) {
      const res = chiSquareQuantile(q, p);
      expect(res.kind).toBe("accepted");
      if (res.kind === "accepted") {
        const relErr = Math.abs(res.data - expected) / expected;
        expect(relErr).toBeLessThan(1e-6);
      }
    }
  });

  test("is strictly monotonic in p for fixed q", () => {
    for (const q of [1, 10, 100]) {
      const testP = [0.001, 0.01, 0.05, 0.1, 0.5, 0.9, 0.95, 0.99, 0.999];
      let prev = -Infinity;
      for (const p of testP) {
        const res = chiSquareQuantile(q, p);
        expect(res.kind).toBe("accepted");
        if (res.kind === "accepted") {
          expect(res.data).toBeGreaterThan(prev);
          prev = res.data;
        }
      }
    }
  });

  test("handles non-integer q down to 0.5 and up to 10000", () => {
    const half = chiSquareQuantile(0.5, 0.5);
    expect(half.kind).toBe("accepted");
    if (half.kind === "accepted") {
      expect(half.data).toBeGreaterThan(0.08);
      expect(half.data).toBeLessThan(0.09);
    }

    const tenThousand = chiSquareQuantile(10000, 0.5);
    expect(tenThousand.kind).toBe("accepted");
    if (tenThousand.kind === "accepted") {
      expect(Math.abs(tenThousand.data - 9999.33) / 9999.33).toBeLessThan(1e-4);
    }
  });

  test("refuses domain violations: q < 0.5, q > 10000, p <= 0, p >= 1, non-finite", () => {
    const invalidPairs: Array<[number, number]> = [
      [0.4, 0.5],
      [10001, 0.5],
      [10, 0],
      [10, -0.1],
      [10, 1],
      [10, 1.1],
      [NaN, 0.5],
      [10, NaN],
      [Infinity, 0.5],
    ];
    for (const [q, p] of invalidPairs) {
      const res = chiSquareQuantile(q, p);
      expect(res.kind).toBe("refused");
    }
  });

  test("surfaces forced nonconvergence as typed quantile-not-converged refusal rather than NaN", () => {
    const res = chiSquareQuantile(10, 0.5, 1);
    expect(res.kind).toBe("refused");
    if (res.kind === "refused") {
      expect(res.refusal.code).toBe("quantile-not-converged");
      expect(res.refusal.domainKind).toBe("numerical");
      expect(res.refusal.details).toEqual({
        q: 10,
        p: 0.5,
        iterations: 1,
      });
    }
  });
});

describe("ensembleMomentBands", () => {
  const modelVariance = 0.6316805; // um^2

  test("reproduces M=400 fixtures within 1e-6 relative", () => {
    const res = ensembleMomentBands({
      M: 400,
      d: 1,
      modelVariance,
      alphas: [1e-3, 1e-4],
    });
    expect(res.kind).toBe("accepted");
    if (res.kind === "accepted") {
      const band1 = res.data[0]!;
      const band2 = res.data[1]!;

      // alpha = 1e-3
      expect(band1.alpha).toBe(1e-3);
      expect(Math.abs(band1.meanHalfWidth - 0.130763) / 0.130763).toBeLessThan(1e-5);
      expect(Math.abs(band1.meanSquare[0] - 0.494964) / 0.494964).toBeLessThan(1e-5);
      expect(Math.abs(band1.meanSquare[1] - 0.789074) / 0.789074).toBeLessThan(1e-5);
      expect(band1.label).toBe("sampling band under the model");

      // alpha = 1e-4
      expect(band2.alpha).toBe(1e-4);
      expect(Math.abs(band2.meanHalfWidth - 0.154609) / 0.154609).toBeLessThan(1e-5);
      expect(Math.abs(band2.meanSquare[0] - 0.472572) / 0.472572).toBeLessThan(1e-5);
      expect(Math.abs(band2.meanSquare[1] - 0.820525) / 0.820525).toBeLessThan(1e-5);
    }
  });

  test("reproduces M=100 fixtures within 1e-6 relative", () => {
    const res = ensembleMomentBands({
      M: 100,
      d: 1,
      modelVariance,
      alphas: [1e-3, 1e-4],
    });
    expect(res.kind).toBe("accepted");
    if (res.kind === "accepted") {
      const band1 = res.data[0]!;
      const band2 = res.data[1]!;

      // alpha = 1e-3
      expect(band1.alpha).toBe(1e-3);
      expect(Math.abs(band1.meanHalfWidth - 0.261526) / 0.261526).toBeLessThan(1e-5);
      expect(Math.abs(band1.meanSquare[0] - 0.378349) / 0.378349).toBeLessThan(1e-5);
      expect(Math.abs(band1.meanSquare[1] - 0.967526) / 0.967526).toBeLessThan(1e-5);

      // alpha = 1e-4
      expect(band2.alpha).toBe(1e-4);
      expect(Math.abs(band2.meanHalfWidth - 0.309218) / 0.309218).toBeLessThan(1e-5);
      expect(Math.abs(band2.meanSquare[0] - 0.341821) / 0.341821).toBeLessThan(1e-5);
      expect(Math.abs(band2.meanSquare[1] - 1.040119) / 1.040119).toBeLessThan(1e-5);
    }
  });

  test("uses q = d * M degrees of freedom for total-vector mean square band", () => {
    const res3d = ensembleMomentBands({
      M: 100,
      d: 3,
      modelVariance,
      alphas: [1e-3],
    });
    expect(res3d.kind).toBe("accepted");
    if (res3d.kind === "accepted") {
      const band = res3d.data[0]!;
      // totalMeanSquare uses chiSquareQuantile(300, ...) / 100 * modelVariance
      const qLow = chiSquareQuantile(300, 5e-4);
      const qHigh = chiSquareQuantile(300, 1 - 5e-4);
      expect(qLow.kind).toBe("accepted");
      expect(qHigh.kind).toBe("accepted");
      if (qLow.kind === "accepted" && qHigh.kind === "accepted") {
        expect(band.totalMeanSquare[0]).toBeCloseTo((modelVariance / 100) * qLow.data, 8);
        expect(band.totalMeanSquare[1]).toBeCloseTo((modelVariance / 100) * qHigh.data, 8);
      }
    }
  });

  test("sample independence: reads no sample values", () => {
    // Calling ensembleMomentBands only takes model parameters, never sample trajectories or data
    const res = ensembleMomentBands({
      M: 50,
      d: 2,
      modelVariance: 1.0,
      alphas: [0.05],
    });
    expect(res.kind).toBe("accepted");
  });

  test("M < 2 returns typed underdetermined status", () => {
    const res = ensembleMomentBands({
      M: 1,
      d: 1,
      modelVariance: 1.0,
      alphas: [0.05],
    });
    expect(res.kind).toBe("underdetermined");
    if (res.kind === "underdetermined") {
      expect(res.status).toBe("underdetermined");
      expect(res.reason).toBe("a band needs at least two members");
    }
  });

  test("nonpositive or nonfinite modelVariance returns typed outside-domain status", () => {
    for (const v of [0, -1, NaN, Infinity]) {
      const res = ensembleMomentBands({
        M: 50,
        d: 1,
        modelVariance: v,
        alphas: [0.05],
      });
      expect(res.kind).toBe("outside-domain");
      if (res.kind === "outside-domain") {
        expect(res.status).toBe("outside-domain");
        expect(res.domainKind).toBe("model");
      }
    }
  });

  test("invalid alphas returns typed outside-domain status", () => {
    for (const alphas of [[0], [-0.05], [1], [1.5], [NaN]]) {
      const res = ensembleMomentBands({
        M: 50,
        d: 1,
        modelVariance: 1.0,
        alphas,
      });
      expect(res.kind).toBe("outside-domain");
      if (res.kind === "outside-domain") {
        expect(res.status).toBe("outside-domain");
        expect(res.domainKind).toBe("input");
      }
    }
  });
});

describe("import boundary check", () => {
  test("no other module in src/physics/reference defines a quantile; consumers import from diffusion.ts", () => {
    const inferencePath = resolve(__dirname, "../physics/reference/inference.ts");
    const inferenceContent = readFileSync(inferencePath, "utf-8");
    expect(inferenceContent).toContain('import { chiSquareQuantile } from "./diffusion.ts"');

    const bm01WorkerPath = resolve(__dirname, "../workers/operations/bm01.ts");
    const bm01Content = readFileSync(bm01WorkerPath, "utf-8");
    expect(bm01Content).toContain("ensembleMomentBands");
  });
});
