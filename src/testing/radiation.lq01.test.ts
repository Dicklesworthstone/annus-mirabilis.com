import { describe, expect, test } from "bun:test";
import {
  fringeSpacingSmallAngle,
  fringeVisibility,
  inverseSquareIntensity,
  planeWave,
  pointSourceField,
  shellPowerIdentity,
  twoSourceIntensity,
} from "../physics/reference/radiation/waves.ts";
import { withinTolerance } from "../units/tolerance.ts";

describe("radiation.lq01: LQ-01 classical wave description and energy spreading reference physics", () => {
  test("equal amplitudes produce center intensity ratio 4 at delta=0 and 0 at delta=pi", () => {
    const resZero = twoSourceIntensity({
      A1: 1,
      A2: 1,
      r1: 1,
      r2: 1,
      wavelength: 1,
      delta: 0,
      readout: "time-average",
    });
    expect(resZero.status).toBe("value");
    if (resZero.status === "value") {
      expect(resZero.value).toBe(4);
    }

    const resPi = twoSourceIntensity({
      A1: 1,
      A2: 1,
      r1: 1,
      r2: 1,
      wavelength: 1,
      delta: Math.PI,
      readout: "time-average",
    });
    expect(resPi.status).toBe("value");
    if (resPi.status === "value") {
      expect(Math.abs(resPi.value)).toBeLessThan(1e-14);
    }

    const resPiHalf = twoSourceIntensity({
      A1: 1,
      A2: 1,
      r1: 1,
      r2: 1,
      wavelength: 1,
      delta: Math.PI / 2,
      readout: "time-average",
    });
    expect(resPiHalf.status).toBe("value");
    if (resPiHalf.status === "value") {
      expect(withinTolerance(resPiHalf.value, 2, { absolute: 1e-14 }).ok).toBe(true);
    }
  });

  test("fringe visibility for A1 = 1, A2 = 0.5 equals exactly 0.8", () => {
    const vis = fringeVisibility(1, 0.5);
    expect(withinTolerance(vis, 0.8, { absolute: 1e-14 }).ok).toBe(true);
  });

  test("small-angle fringe spacing for lambda = 500 nm, d = 0.5 mm, D = 1 m equals 1.000 mm", () => {
    const lambda = 500e-9;
    const d = 0.5e-3;
    const D = 1.0;
    const spacing = fringeSpacingSmallAngle(lambda, d, D);
    expect(withinTolerance(spacing, 1.0e-3, { relative: 1e-6 }).ok).toBe(true);
  });

  test("inverse-square intensity at 1 m and 2 m from 1 W source", () => {
    const P = 1.0;
    const res1m = inverseSquareIntensity(P, 1.0);
    const res2m = inverseSquareIntensity(P, 2.0);

    expect(res1m.status).toBe("value");
    expect(res2m.status).toBe("value");

    if (res1m.status === "value" && res2m.status === "value") {
      const expected1 = 1 / (4 * Math.PI); // ~ 0.07957747
      const expected2 = 1 / (16 * Math.PI); // ~ 0.019894367
      expect(withinTolerance(res1m.value, expected1, { relative: 1e-9 }).ok).toBe(true);
      expect(withinTolerance(res2m.value, expected2, { relative: 1e-9 }).ok).toBe(true);
      expect(withinTolerance(res1m.value / res2m.value, 4.0, { relative: 1e-9 }).ok).toBe(true);
    }
  });

  test("numerical Gauss-Legendre shell integration equals source power P to 10^-12 relative", () => {
    const P = 1.0;
    const r = 2.5;
    const shellRes = shellPowerIdentity({ P, r, order: 16 });
    expect(shellRes.status).toBe("value");
    if (shellRes.status === "value") {
      expect(withinTolerance(shellRes.value, P, { relative: 1e-12 }).ok).toBe(true);
    }
  });

  test("plane wave time average over full period equals kappa * A^2 / 2", () => {
    const A = 1.5;
    const lambda = 500e-9;
    const c = 299792458;
    const period = lambda / c;

    // Sample instantaneous field squared over N steps
    const N = 1000;
    let sumSq = 0;
    for (let i = 0; i < N; i++) {
      const t = (i / N) * period;
      const wave = planeWave({ amplitude: A, wavelength: lambda }, 0, t);
      expect(wave.status).toBe("value");
      if (wave.status === "value") {
        sumSq += wave.value * wave.value;
      }
    }
    const avgSq = sumSq / N;
    const expectedAvg = (A * A) / 2;
    expect(withinTolerance(avgSq, expectedAvg, { relative: 1e-3 }).ok).toBe(true);
  });

  test("out of domain: r <= 0 returns outside-domain with nonpositive-radius condition", () => {
    const resZero = inverseSquareIntensity(1.0, 0);
    expect(resZero.status).toBe("outside-domain");
    if (resZero.status === "outside-domain") {
      expect(resZero.condition).toBe("nonpositive-radius");
      expect(resZero.reason).toContain("Radius r must be strictly positive");
    }

    const resNeg = pointSourceField({ amplitude: 1, wavelength: 1 }, -0.5, 0);
    expect(resNeg.status).toBe("outside-domain");
    if (resNeg.status === "outside-domain") {
      expect(resNeg.condition).toBe("nonpositive-radius");
    }
  });

  test("refuses invalid wave parameters (negative amplitude, nonpositive wavelength)", () => {
    const resNegAmp = planeWave({ amplitude: -1, wavelength: 1 }, 0, 0);
    expect(resNegAmp.status).toBe("outside-domain");

    const resNegWl = planeWave({ amplitude: 1, wavelength: 0 }, 0, 0);
    expect(resNegWl.status).toBe("outside-domain");
  });
});
