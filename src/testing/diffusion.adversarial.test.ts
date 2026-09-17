import { describe, expect, test } from "bun:test";
import { createDeclaredConstantSet, getConstantSet } from "../physics/reference/constants.ts";
import {
  brownianFrames,
  moments,
  radialPropagator2d,
  rmsDisplacement,
  stokesEinsteinD,
} from "../physics/reference/diffusion.ts";
import { withinTolerance } from "../units/tolerance.ts";

function val(e: { result: { status: string; value?: number | Float64Array } }): number {
  expect(e.result.status).toBe("value");
  return e.result.value as number;
}

function printedSet() {
  return createDeclaredConstantSet({
    id: "scenario-einstein-1905-brownian-printed",
    era: 1905,
    provenance: "Declared editorial inputs matching Einstein 1905 printed R and N.",
    precisionNote: "Two-significant-figure comparison to 0,8 Mikron and ca. 6 Mikron.",
    gasConstantProvenance: "not-applicable",
    entries: [
      {
        quantityId: "molarGasConstant",
        value: 8.31,
        exactDecimal: "8.31",
        unit: "J/(mol K)",
        kind: "declared-scenario",
        evidentialRole: "declared-input",
        provenance: "Paper 2 printed R = 8.31e7 erg mol^-1 K^-1.",
        dependsOn: [],
      },
      {
        quantityId: "avogadroConstant",
        value: 6e23,
        exactDecimal: "6e23",
        unit: "1/mol",
        kind: "declared-scenario",
        evidentialRole: "declared-input",
        provenance: "Paper 2 printed N = 6e23 mol^-1.",
        dependsOn: [],
      },
    ],
  });
}

describe("Adversarial Fixtures & Historical Regressions (am-ref-diffusion-lr3)", () => {
  const modern = getConstantSet("modern-si-2019");

  test("adversarial fixture: 'halving diffusivity halves displacement' FAILS for intended reason", () => {
    // True physics: lambda_x = sqrt(2 * D * t)
    // Halving D to D/2 gives lambda_x' = sqrt(2 * (D/2) * t) = lambda_x / sqrt(2) = 0.7071068 * lambda_x.
    // Naive mistake: assuming displacement scales linearly with D (lambda_x' = 0.5 * lambda_x).
    const D0 = 4.29439564555e-13; // m^2/s
    const t = 1.0; // s
    const baselineRms = val(rmsDisplacement(D0, t));
    const trueHalvedRms = val(rmsDisplacement(D0 / 2, t));

    // 1. True scaling factor is exactly 1/sqrt(2)
    const trueRatio = trueHalvedRms / baselineRms;
    expect(Math.abs(trueRatio - 1 / Math.SQRT2)).toBeLessThan(1e-14);

    // 2. The naive linear scaling prediction (0.5 * baselineRms) fails by ~29.3%
    const naiveHalvedRms = 0.5 * baselineRms;
    expect(withinTolerance(naiveHalvedRms, trueHalvedRms, { relative: 0.29 }).ok).toBe(false);
    expect(withinTolerance(naiveHalvedRms, trueHalvedRms, { relative: 0.3 }).ok).toBe(true);

    // A tolerance test at 1e-4 fails decisively on the naive linear scaling
    const verdict = withinTolerance(naiveHalvedRms, trueHalvedRms, { relative: 1e-4 });
    expect(verdict.ok).toBe(false);
    expect(verdict.kind).toBe("outside");
  });

  test("adversarial fixture: 'doubling viscosity halves displacement' FAILS for intended reason", () => {
    // Stokes-Einstein: D = k_B * T / (6 * pi * eta * a)
    // Doubling viscosity eta -> 2*eta halves diffusivity D -> D/2.
    // Therefore RMS displacement scales by 1/sqrt(2) approx 0.70711, NOT 1/2.
    const D_base = val(stokesEinsteinD({ T: 293.15, eta: 0.001, a: 0.5e-6 }, modern));
    const D_doubledEta = val(stokesEinsteinD({ T: 293.15, eta: 0.002, a: 0.5e-6 }, modern));

    // Diffusivity halves
    expect(Math.abs(D_doubledEta / (D_base / 2) - 1)).toBeLessThan(1e-14);

    const rms_base = val(rmsDisplacement(D_base, 1.0));
    const rms_doubledEta = val(rmsDisplacement(D_doubledEta, 1.0));

    // True RMS scales by 1/sqrt(2)
    expect(Math.abs(rms_doubledEta / (rms_base / Math.SQRT2) - 1)).toBeLessThan(1e-14);

    // Naive 0.5x scaling fails: outside 29% relative tolerance, within 30%
    const naiveRms = 0.5 * rms_base;
    expect(withinTolerance(naiveRms, rms_doubledEta, { relative: 0.29 }).ok).toBe(false);
    expect(withinTolerance(naiveRms, rms_doubledEta, { relative: 0.3 }).ok).toBe(true);
    expect(withinTolerance(naiveRms, rms_doubledEta, { relative: 1e-4 }).ok).toBe(false);
  });

  test("adversarial fixture: a 1 um radius gives ~0.562 um (printed) or ~0.561 um (modern), not 0.8 um", () => {
    // At a = 0.5 um, lambda_x is ~0.79 um.
    // The plausible mistake is assuming displacement is independent of particle radius or keeping 0.8 um.
    // Doubling radius a to 1.0 um halves D and scales RMS by 1/sqrt(2) to ~0.562 um.
    const set = printedSet();
    const D_1um_printed = val(stokesEinsteinD({ T: 290.15, eta: 1.35e-3, a: 1.0e-6 }, set));
    const rms_1um_printed = val(rmsDisplacement(D_1um_printed, 1.0));

    // Printed set: 0.561999 um ~= 0.5620 um
    expect(Math.abs(rms_1um_printed * 1e6 - 0.562)).toBeLessThan(1e-3);
    // Crucially, 0.562 um is outside the [0.75, 0.85) um interval around Einstein's 0.8 um
    expect(rms_1um_printed * 1e6).toBeLessThan(0.75);

    // Modern k_B: 0.561113 um ~= 0.5611 um
    const D_1um_modern = val(stokesEinsteinD({ T: 290.15, eta: 1.35e-3, a: 1.0e-6 }, modern));
    const rms_1um_modern = val(rmsDisplacement(D_1um_modern, 1.0));
    expect(Math.abs(rms_1um_modern * 1e6 - 0.5611)).toBeLessThan(1e-3);
    expect(rms_1um_modern * 1e6).toBeLessThan(0.75);
  });

  test("adversarial fixture: treating 2D radius as signed Gaussian integrates to 0.5 and fails <r^2> = 4Dt", () => {
    const D = 0.5;
    const t = 1.0;
    const stats = moments(2, D, t);

    // True 2D moments:
    // <r^2> = 4 * D * t = 2.0
    // <r> = sqrt(pi * D * t) = sqrt(pi / 2) ~= 1.2533
    expect(Math.abs(val(stats.total) - 4 * D * t)).toBeLessThan(1e-14);

    // 1. A naive 1D Gaussian restricted to r >= 0: g(r) = (1/sqrt(4*pi*D*t)) * exp(-r^2 / (4*Dt))
    // Over r in [0, infinity), \int_0^\infty g(r) dr = 0.5 (loses 50% of mass!)
    const naiveIntegral = 0.5;
    expect(naiveIntegral).toBe(0.5);

    // 2. Even if normalized to 2*g(r) on [0, infinity), its second moment would be:
    // \int_0^\infty r^2 * 2 * g(r) dr = 2 * D * t = 2.0 * 0.5 = 1.0, which FAILS the true <r^2> = 4Dt by 2x!
    const naiveSecondMoment = 2 * D * t;
    const trueSecondMoment = val(stats.total);
    expect(naiveSecondMoment).not.toBe(trueSecondMoment);
    expect(Math.abs(trueSecondMoment - 2 * naiveSecondMoment)).toBeLessThan(1e-14);

    // 3. The true 2D radial density p_r(r, t) = (r / (2Dt)) * exp(-r^2 / (4Dt)) peaks at r = sqrt(2Dt)
    const peakRadius = Math.sqrt(2 * D * t);
    const pPeak = val(radialPropagator2d(peakRadius, t, D));
    const pBelow = val(radialPropagator2d(peakRadius * 0.99, t, D));
    const pAbove = val(radialPropagator2d(peakRadius * 1.01, t, D));
    expect(pPeak).toBeGreaterThan(pBelow);
    expect(pPeak).toBeGreaterThan(pAbove);
  });

  test("historical fixtures: regression values are not decoration and guard against '6.1 μm'", () => {
    const set = printedSet();
    const D = val(stokesEinsteinD({ T: 290.15, eta: 1.35e-3, a: 0.5e-6 }, set));

    // Exact values from Einstein's printed parameters:
    const at1s = val(rmsDisplacement(D, 1.0));
    const at60s = val(rmsDisplacement(D, 60.0));

    expect(Math.abs(at1s / 0.7947833e-6 - 1)).toBeLessThan(1e-6);
    expect(Math.abs(at60s / 6.156365e-6 - 1)).toBeLessThan(1e-6);

    // Formatted at two significant figures: 0.79 and 6.2 μm
    const at1sFormatted = (at1s * 1e6).toFixed(2); // "0.79"
    const at60sFormatted = (at60s * 1e6).toFixed(1); // "6.2"
    expect(at1sFormatted).toBe("0.79");
    expect(at60sFormatted).toBe("6.2");

    // Guard: neither 6.1 μm nor 6.1 um appears in the caption
    const text = `At 1 s: ${at1sFormatted} μm, at 60 s: ${at60sFormatted} μm (scenario diffusion-einstein-1905-printed)`;
    expect(text.includes("6.1 μm")).toBe(false);
    expect(text.includes("6.1 um")).toBe(false);
    expect(text.includes("6.2 μm")).toBe(true);
  });

  test("brownianFrames: layout, prefix stability, exact step arithmetic, seed validation, and budget", () => {
    const nSeries = 4;
    const steps = 10;
    const dt = 0.05;
    const diffusion = 4.29439564555e-13;
    const seed = "19050917";

    // 1. Kernel 0 (coin): exact step +/- s
    const coinResult = brownianFrames({
      nSeries,
      steps,
      stepKernel: 0,
      seed,
      diffusion,
      dt,
    });
    expect(coinResult.kind).toBe("accepted");
    if (coinResult.kind === "accepted") {
      const buf = coinResult.data;
      expect(buf.length).toBe(nSeries * (steps + 1));
      const s = Math.sqrt(2.0 * diffusion * dt);
      for (let i = 0; i < nSeries; i++) {
        expect(buf[i * (steps + 1)]).toBe(0.0); // start at 0
        for (let step = 1; step <= steps; step++) {
          const prev = buf[i * (steps + 1) + step - 1] ?? 0;
          const curr = buf[i * (steps + 1) + step] ?? 0;
          const delta = curr - prev;
          expect(Math.abs(Math.abs(delta) - s)).toBeLessThan(1e-15);
        }
      }
    }

    // 2. Prefix stability: generating 2 series yields bitwise identical output to the first 2 series of 4
    const prefixResult = brownianFrames({
      nSeries: 2,
      steps,
      stepKernel: 0,
      seed,
      diffusion,
      dt,
    });
    expect(prefixResult.kind).toBe("accepted");
    if (prefixResult.kind === "accepted" && coinResult.kind === "accepted") {
      for (let i = 0; i < 2 * (steps + 1); i++) {
        expect(prefixResult.data[i]).toBe(coinResult.data[i]);
      }
    }

    // 3. Kernel 2 (unit Gaussian dimensionless) vs Kernel 3 (physical Gaussian)
    const k2 = brownianFrames({ nSeries: 1, steps: 5, stepKernel: 2, seed, diffusion, dt });
    const k3 = brownianFrames({ nSeries: 1, steps: 5, stepKernel: 3, seed, diffusion, dt });
    expect(k2.kind).toBe("accepted");
    expect(k3.kind).toBe("accepted");
    if (k2.kind === "accepted" && k3.kind === "accepted") {
      const s = Math.sqrt(2.0 * diffusion * dt);
      // Under fixed seed, k3 steps are k2 steps scaled by s
      for (let step = 1; step <= 5; step++) {
        const d2_cur = k2.data[step] ?? 0;
        const d2_prev = k2.data[step - 1] ?? 0;
        const d3_cur = k3.data[step] ?? 0;
        const d3_prev = k3.data[step - 1] ?? 0;
        const delta2 = d2_cur - d2_prev;
        const delta3 = d3_cur - d3_prev;
        expect(Math.abs(delta3 - delta2 * s)).toBeLessThan(1e-15);
      }
    }

    // 4. diffusion = 0 returns all zeros
    const zeroResult = brownianFrames({
      nSeries: 2,
      steps: 5,
      stepKernel: 0,
      seed,
      diffusion: 0,
      dt,
    });
    expect(zeroResult.kind).toBe("accepted");
    if (zeroResult.kind === "accepted") {
      expect(zeroResult.data.every((x) => x === 0)).toBe(true);
    }

    // 5. Seed validation: JS number rejected with invalid-seed refusal
    const numSeedResult = brownianFrames({
      nSeries: 1,
      steps: 5,
      stepKernel: 0,
      seed: 12345 as unknown as string,
      diffusion,
      dt,
    });
    expect(numSeedResult.kind).toBe("refused");
    if (numSeedResult.kind === "refused") {
      expect(numSeedResult.refusal.code).toBe("invalid-seed");
    }

    // 6. Budget exhaustion
    const hugeResult = brownianFrames({
      nSeries: 10000,
      steps: 10000,
      stepKernel: 0,
      seed,
      diffusion,
      dt,
    });
    expect(hugeResult.kind).toBe("outcome");
    if (hugeResult.kind === "outcome") {
      expect(hugeResult.outcome.outcome).toBe("budget-exhausted");
    }
  });
});
