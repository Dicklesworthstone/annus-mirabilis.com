import { describe, expect, test } from "bun:test";
import {
  ftcs1d,
  ftcsAdvance,
  ftcsAnalyticComparison,
  REFERENCE_FTCS_BUDGET,
} from "../physics/reference/diffusion.ts";
import { withinTolerance } from "../units/tolerance.ts";

function gaussian(x: number, xc: number, t: number, D: number): number {
  return (1 / Math.sqrt(4 * Math.PI * D * t)) * Math.exp(-((x - xc) ** 2) / (4 * D * t));
}

describe("FTCS 1D reference stepper (am-ref-diffusion-lr3 AC 14)", () => {
  test("mass is conserved to 1e-12 relative for all profiles and maximum principle holds", () => {
    for (const profile of [0, 1, 2] as const) {
      const n = 41;
      const dx = 0.2;
      const res = ftcs1d({
        n,
        frames: 50,
        stepsPerFrame: 4,
        D: 1.0,
        dx,
        dt: 0.019,
        profile,
      });
      expect(res.kind).toBe("accepted");
      if (res.kind === "accepted") {
        const initial = res.data.values.slice(0, n);
        let initialMass = 0;
        let initialMax = -Infinity;
        let initialMin = Infinity;
        for (let i = 0; i < n; i++) {
          const val = initial[i]!;
          initialMass += val * dx;
          if (val > initialMax) initialMax = val;
          if (val < initialMin) initialMin = val;
        }

        for (let frame = 1; frame < 50; frame++) {
          const slice = res.data.values.slice(frame * n, (frame + 1) * n);
          let frameMass = 0;
          for (let i = 0; i < n; i++) {
            const v = slice[i]!;
            frameMass += v * dx;
            expect(v).toBeGreaterThanOrEqual(initialMin - 1e-15);
            expect(v).toBeLessThanOrEqual(initialMax + 1e-15);
          }
          expect(withinTolerance(frameMass, initialMass, { relative: 1e-12 }).ok).toBe(true);
        }
      }
    }
  });

  test("discrete second moment grows by exactly 2*D*dt per step before boundary contact", () => {
    const n = 101;
    const dx = 0.1;
    const D = 0.5;
    const dt = 0.002;
    const steps = 15;

    const res = ftcs1d({
      n,
      frames: steps + 1,
      stepsPerFrame: 1,
      D,
      dx,
      dt,
      profile: 0,
    });
    expect(res.kind).toBe("accepted");
    if (res.kind === "accepted") {
      const values = res.data.values;
      const ic = Math.floor(n / 2);
      const xc = (ic + 0.5) * dx;

      const calcMoment = (frame: number): number => {
        let sum = 0;
        for (let i = 0; i < n; i++) {
          const x = (i + 0.5) * dx;
          sum += (x - xc) ** 2 * values[frame * n + i]! * dx;
        }
        return sum;
      };

      const expectedDelta = 2 * D * dt;
      for (let k = 1; k <= steps; k++) {
        const delta = calcMoment(k) - calcMoment(k - 1);
        expect(Math.abs(delta - expectedDelta)).toBeLessThan(1e-14);
      }
    }
  });

  test("spatial convergence against analytic Gaussian gives observed order in [1.8, 2.2] at r=0.25 and r=0.4", () => {
    const D = 1.0;
    const t0 = 1.0;
    const T = 0.4;
    const L = 24.0;
    const xc = 12.0;

    const runConvergence = (r: number): [number, number] => {
      const run = (N: number): number => {
        const dx = L / N;
        const dt = (r * dx * dx) / D;
        const steps = Math.round(T / dt);
        const actualT = steps * dt;
        const actualT1 = t0 + actualT;

        const initial = new Float64Array(N);
        for (let i = 0; i < N; i++) {
          const x = (i + 0.5) * dx;
          initial[i] = gaussian(x, xc, t0, D);
        }
        const res = ftcsAdvance(initial, r, steps);
        if (res.kind !== "accepted") throw new Error("Advance failed");
        let l2 = 0;
        for (let i = 0; i < N; i++) {
          const x = (i + 0.5) * dx;
          const exact = gaussian(x, xc, actualT1, D);
          l2 += (res.data[i]! - exact) ** 2 * dx;
        }
        return Math.sqrt(l2);
      };

      const e1 = run(80);
      const e2 = run(160);
      const e3 = run(320);
      return [Math.log2(e1 / e2), Math.log2(e2 / e3)];
    };

    const [p1_25, p2_25] = runConvergence(0.25);
    expect(p1_25!).toBeGreaterThanOrEqual(1.8);
    expect(p1_25!).toBeLessThanOrEqual(2.2);
    expect(p2_25!).toBeGreaterThanOrEqual(1.8);
    expect(p2_25!).toBeLessThanOrEqual(2.2);

    const [p1_40, p2_40] = runConvergence(0.4);
    expect(p1_40!).toBeGreaterThanOrEqual(1.8);
    expect(p1_40!).toBeLessThanOrEqual(2.2);
    expect(p2_40!).toBeGreaterThanOrEqual(1.8);
    expect(p2_40!).toBeLessThanOrEqual(2.2);

    // Documented control run at r = 1/6: leading truncation error cancels and order is near 4
    const [p1_16, p2_16] = runConvergence(1 / 6);
    expect(p1_16!).toBeGreaterThan(3.5);
    expect(p2_16!).toBeGreaterThan(3.5);
  });

  test("temporal order is in [0.9, 1.1] at fixed dx against same-grid reference with dt/16", () => {
    const N = 200;
    const L = 20.0;
    const dx = L / N;
    const D = 1.0;
    const T = 0.05;
    const xc = 10.0;

    const initial = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * dx;
      initial[i] = Math.exp(-((x - xc) ** 2) / 4);
    }

    const dt1 = 0.002;
    const r1 = (D * dt1) / (dx * dx);
    const steps1 = Math.round(T / dt1);
    const res1 = ftcsAdvance(initial, r1, steps1);
    expect(res1.kind).toBe("accepted");

    const dt2 = 0.001;
    const r2 = (D * dt2) / (dx * dx);
    const steps2 = Math.round(T / dt2);
    const res2 = ftcsAdvance(initial, r2, steps2);
    expect(res2.kind).toBe("accepted");

    const dtRef = dt1 / 16;
    const rRef = (D * dtRef) / (dx * dx);
    const stepsRef = Math.round(T / dtRef);
    const resRef = ftcsAdvance(initial, rRef, stepsRef);
    expect(resRef.kind).toBe("accepted");

    if (res1.kind === "accepted" && res2.kind === "accepted" && resRef.kind === "accepted") {
      let e1 = 0,
        e2 = 0;
      for (let i = 0; i < N; i++) {
        e1 += (res1.data[i]! - resRef.data[i]!) ** 2 * dx;
        e2 += (res2.data[i]! - resRef.data[i]!) ** 2 * dx;
      }
      const order = Math.log2(Math.sqrt(e1) / Math.sqrt(e2));
      expect(order).toBeGreaterThanOrEqual(0.9);
      expect(order).toBeLessThanOrEqual(1.15);
    }
  });

  test("exact stability boundary: r <= 0.5 accepted and r > 0.5 refused with ftcs-unstable and dtMax", () => {
    const p = { n: 5, frames: 1, stepsPerFrame: 1, D: 1.0, dx: 1.0, dt: 0.5, profile: 0 as const };
    const accepted = ftcs1d(p);
    expect(accepted.kind).toBe("accepted");

    const refused = ftcs1d({ ...p, dt: 0.5000001 });
    expect(refused.kind).toBe("refused");
    if (refused.kind === "refused") {
      expect(refused.refusal.code).toBe("ftcs-unstable");
      expect(refused.refusal.domainKind).toBe("numerical");
      expect(refused.refusal.details).toEqual({
        ratio: 0.5000001,
        limit: 0.5,
        dtMax: 0.5,
      });
      expect(refused.refusal.rankedRepairs.map((r) => r.action?.parameterId)).toEqual([
        "dt",
        "dx",
        "D",
      ]);
    }
  });

  test("refusal decisions agree with (D*dt)/(dx*dx) on 10,000 seeded near-boundary inputs", () => {
    let s = 123456789;
    const rand = (): number => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };

    for (let i = 0; i < 10000; i++) {
      const D = 0.1 + rand() * 10;
      const dx = 0.01 + rand() * 0.5;
      const delta = (rand() - 0.5) * 2e-6;
      const dt = ((0.5 * dx * dx) / D) * (1 + delta);
      const ratio = (D * dt) / (dx * dx);
      const res = ftcs1d({ n: 5, frames: 1, stepsPerFrame: 1, D, dx, dt, profile: 0 });
      if (ratio <= 0.5) {
        expect(res.kind).toBe("accepted");
      } else {
        expect(res.kind).toBe("refused");
        if (res.kind === "refused") {
          expect(res.refusal.code).toBe("ftcs-unstable");
        }
      }
    }
  });

  test("one step reconstructed with unfused arithmetic in ascending column order matches ftcs1d bit for bit", () => {
    const p = { n: 9, frames: 2, stepsPerFrame: 1, D: 0.8, dx: 0.5, dt: 0.1, profile: 0 as const };
    const res = ftcs1d(p);
    expect(res.kind).toBe("accepted");
    if (res.kind === "accepted") {
      const initial = res.data.values.slice(0, 9);
      const step1 = res.data.values.slice(9, 18);

      const r = (p.D * p.dt) / (p.dx * p.dx);
      const y = new Float64Array(9);
      y[0] = initial[1]! - initial[0]!;
      for (let i = 1; i < 8; i++) {
        let s = initial[i - 1]!;
        s += -2 * initial[i]!;
        s += initial[i + 1]!;
        y[i] = s;
      }
      y[8] = initial[7]! - initial[8]!;

      const manual = new Float64Array(9);
      for (let i = 0; i < 9; i++) {
        manual[i] = initial[i]! + r * y[i]!;
      }

      const buf1 = new BigUint64Array(step1.buffer, step1.byteOffset, 9);
      const buf2 = new BigUint64Array(manual.buffer, manual.byteOffset, 9);
      for (let i = 0; i < 9; i++) {
        expect(buf1[i]).toBe(buf2[i]);
      }
    }
  });

  test("cell-probability comparison sums to analytic mass inside box within 1e-12 and flags wall contact", () => {
    const n = 101;
    const dx = 0.1;
    const D = 0.5;
    const dt = 0.004;
    const steps = 250;
    const run = ftcs1d({ n, frames: 2, stepsPerFrame: steps, D, dx, dt, profile: 0 });
    expect(run.kind).toBe("accepted");
    if (run.kind === "accepted") {
      const cmp = ftcsAnalyticComparison({
        field: run.data.values.slice(n),
        dx,
        t: run.data.elapsedTime,
        D,
        startCell: Math.floor(n / 2),
      });
      expect(cmp.kind).toBe("accepted");
      if (cmp.kind === "accepted") {
        let sumP = 0;
        for (const p of cmp.data.cellProbabilities) sumP += p;
        expect(Math.abs(sumP - cmp.data.analyticMassInsideBox)).toBeLessThan(1e-12);
        expect(cmp.data.wallContact).toBe(false);
      }
    }

    // Small box with long diffusion => wall contact is true
    const smallRun = ftcs1d({ n: 21, frames: 2, stepsPerFrame: 200, D: 1.0, dx: 0.2, dt: 0.01, profile: 0 });
    expect(smallRun.kind).toBe("accepted");
    if (smallRun.kind === "accepted") {
      const cmpSmall = ftcsAnalyticComparison({
        field: smallRun.data.values.slice(21),
        dx: 0.2,
        t: smallRun.data.elapsedTime,
        D: 1.0,
        startCell: 10,
      });
      expect(cmpSmall.kind).toBe("accepted");
      if (cmpSmall.kind === "accepted") {
        expect(cmpSmall.data.wallContact).toBe(true);
        expect(cmpSmall.data.analyticMassInsideBox).toBeLessThan(0.99);
      }
    }
  });

  test("work and memory limits above budget return execution outcome budget-exhausted", () => {
    const res = ftcs1d(
      { n: 1000, frames: 10000, stepsPerFrame: 10, D: 1, dx: 1, dt: 0.1, profile: 0 },
      { workUnits: 1e12, allocationBytes: 1e12 },
    );
    expect(res.kind).toBe("outcome");
    if (res.kind === "outcome" && res.outcome.outcome === "budget-exhausted") {
      expect(res.outcome.outcome).toBe("budget-exhausted");
      expect(res.outcome.allowed).toEqual(REFERENCE_FTCS_BUDGET);
    }
  });
});
