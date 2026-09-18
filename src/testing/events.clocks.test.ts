import { describe, expect, test } from "bun:test";
import { logEvent, logEventFailure } from "../physics/reference/events.log.ts";
import {
  type ConstantSpeedCircleWorldline,
  equatorPoleComparison,
  lightClock,
  type PiecewiseInertialWorldline,
  type PrescribedSmoothWorldline,
  properTime,
  reciprocalRates,
  reunionComparison,
} from "../physics/reference/events.ts";
import { withinTolerance } from "../units/tolerance.ts";

function expectClose(
  actual: number,
  expected: number,
  relativeTolerance = 1e-12,
  absoluteTolerance = 1e-12,
): void {
  const verdict = withinTolerance(actual, expected, {
    relative: relativeTolerance,
    absolute: absoluteTolerance,
  });
  if (!verdict.ok) {
    throw new Error(
      `expected ${actual} to be within ${relativeTolerance} relative (${absoluteTolerance} absolute) of ${expected} (diff ${verdict.diff}, allowed ${verdict.allowed})`,
    );
  }
}

describe("events.clocks: Proper time, worldlines, and light clock (am-ref-events-yvl & am-sr-05-moving-clocks-2zka)", () => {
  test("Inertial motion at beta = 0.6: tau/t = 0.8, tau = 8 s for t = 10 s", () => {
    const t0 = performance.now();
    const worldline: PiecewiseInertialWorldline = {
      kind: "piecewise-inertial",
      segments: [{ t0: 0, t1: 10, vx: 0.6, vy: 0, vz: 0 }],
    };
    const res = properTime(worldline, 0, 10);
    const durationMs = performance.now() - t0;

    expect(res.status).toBe("value");
    if (res.status === "value") {
      expectClose(res.value.properTimeS, 8.0);
      expectClose(res.value.coordinateTimeS, 10.0);
      expectClose(res.value.timeLossS, 2.0);
      expectClose(res.value.ratio, 0.8);
      expect(res.value.method).toBe("piecewise-exact");

      logEvent({
        testId: "events.clocks.inertial-0.6c",
        beta: 0.6,
        resultStatus: res.status,
        expected: 8.0,
        actual: res.value.properTimeS,
        outcome: "passed",
        durationMs,
        message: "Inertial motion at 0.6c gives tau=8s for t=10s",
      });
    } else {
      logEventFailure("events.clocks.inertial-0.6c", res);
    }
  });

  test("Out-and-back piecewise inertial worldline at 0.6c: tau = 8 s for total t = 10 s", () => {
    const t0 = performance.now();
    const worldline: PiecewiseInertialWorldline = {
      kind: "piecewise-inertial",
      segments: [
        { t0: 0, t1: 5, vx: 0.6, vy: 0, vz: 0 },
        { t0: 5, t1: 10, vx: -0.6, vy: 0, vz: 0 },
      ],
    };
    const res = properTime(worldline, 0, 10);
    const durationMs = performance.now() - t0;

    expect(res.status).toBe("value");
    if (res.status === "value") {
      expectClose(res.value.properTimeS, 8.0);
      expectClose(res.value.timeLossS, 2.0);
      expectClose(res.value.ratio, 0.8);

      logEvent({
        testId: "events.clocks.out-and-back-0.6c",
        beta: 0.6,
        resultStatus: res.status,
        expected: 8.0,
        actual: res.value.properTimeS,
        outcome: "passed",
        durationMs,
        message: "Out-and-back at 0.6c gives tau=8s for t=10s",
      });
    } else {
      logEventFailure("events.clocks.out-and-back-0.6c", res);
    }
  });

  test("Constant-speed circle at 0.6c for 10 s gives tau = 8 s", () => {
    const t0 = performance.now();
    const worldline: ConstantSpeedCircleWorldline = {
      kind: "constant-speed-circle",
      radiusLs: 5.0,
      speedBeta: 0.6,
    };
    const res = properTime(worldline, 0, 10);
    const durationMs = performance.now() - t0;

    expect(res.status).toBe("value");
    if (res.status === "value") {
      expectClose(res.value.properTimeS, 8.0);
      expectClose(res.value.timeLossS, 2.0);
      expectClose(res.value.ratio, 0.8);
      expect(res.value.method).toBe("analytic-closed-form");

      logEvent({
        testId: "events.clocks.circle-0.6c",
        beta: 0.6,
        resultStatus: res.status,
        expected: 8.0,
        actual: res.value.properTimeS,
        outcome: "passed",
        durationMs,
        message: "Constant-speed circle at 0.6c gives tau=8s for t=10s",
      });
    } else {
      logEventFailure("events.clocks.circle-0.6c", res);
    }
  });

  test("Stable loss at beta = 10^-4 matches high-precision reference 5.0000000125e-9 within 10^-12 relative", () => {
    const t0 = performance.now();
    const beta = 1e-4;
    const worldline: PiecewiseInertialWorldline = {
      kind: "piecewise-inertial",
      segments: [{ t0: 0, t1: 1, vx: beta }],
    };
    const res = properTime(worldline, 0, 1);
    const durationMs = performance.now() - t0;

    expect(res.status).toBe("value");
    if (res.status === "value") {
      // High-precision reference: loss per second = 5.0000000125e-9
      const referenceLossPerSecond = 5.0000000125e-9;
      expectClose(res.value.timeLossS, referenceLossPerSecond, 1e-12);

      // Demonstrate that naive subtraction (1 - sqrt(1 - beta^2)) loses digits
      const naiveLoss = 1 - Math.sqrt(1 - beta * beta);
      const naiveRelDiff = Math.abs(naiveLoss - referenceLossPerSecond) / referenceLossPerSecond;
      // Naive error is ~5.7e-9, failing 1e-12 tolerance
      expect(naiveRelDiff).toBeGreaterThan(1e-9);

      logEvent({
        testId: "events.clocks.stable-loss-1e-4",
        beta,
        resultStatus: res.status,
        expected: referenceLossPerSecond,
        actual: res.value.timeLossS,
        outcome: "passed",
        durationMs,
        message: "Cancellation-free loss matches 5.0000000125e-9 within 10^-12 relative",
      });
    } else {
      logEventFailure("events.clocks.stable-loss-1e-4", res);
    }
  });

  test("Prescribed smooth path: numerical quadrature matches declared error bound", () => {
    const t0 = performance.now();
    // Smooth harmonic velocity: vx(t) = 0.6 * sin(pi * t / 10)
    const worldline: PrescribedSmoothWorldline = {
      kind: "prescribed-smooth",
      velocity: (t: number) => ({
        vx: 0.6 * Math.sin((Math.PI * t) / 10),
      }),
      declaredError: 1e-6,
    };
    const res = properTime(worldline, 0, 10);
    const durationMs = performance.now() - t0;

    expect(res.status).toBe("value");
    if (res.status === "value") {
      expect(res.value.method).toBe("numerical-quadrature");
      expect(res.value.estimatedError).toBeDefined();
      const estErr = res.value.estimatedError ?? 1;
      expect(estErr).toBeLessThanOrEqual(1e-6);
      // Since |v| <= 0.6, proper time should be between 8s and 10s
      expect(res.value.properTimeS).toBeGreaterThan(8.0);
      expect(res.value.properTimeS).toBeLessThan(10.0);

      logEvent({
        testId: "events.clocks.smooth-quadrature",
        resultStatus: res.status,
        actual: res.value.properTimeS,
        outcome: "passed",
        durationMs,
        message: "Smooth path numerical quadrature with declared error estimate",
      });
    } else {
      logEventFailure("events.clocks.smooth-quadrature", res);
    }
  });

  test("Reunion comparison between inertial twin and out-and-back twin is frame-independent", () => {
    const t0 = performance.now();
    // Twin 1: stays at rest at origin, t in [0, 10]
    const w1: PiecewiseInertialWorldline = {
      kind: "piecewise-inertial",
      segments: [{ t0: 0, t1: 10, vx: 0 }],
    };
    // Twin 2: moves out at 0.6c for 5s (reaches x=3), returns at -0.6c for 5s (reaches x=0 at t=10)
    const w2: PiecewiseInertialWorldline = {
      kind: "piecewise-inertial",
      segments: [
        { t0: 0, t1: 5, vx: 0.6 },
        { t0: 5, t1: 10, vx: -0.6 },
      ],
    };

    const comp = reunionComparison(w1, w2, 0, 10);
    const durationMs = performance.now() - t0;

    expect(comp.status).toBe("value");
    if (comp.status === "value") {
      expectClose(comp.value.clock1ProperTimeS, 10.0);
      expectClose(comp.value.clock2ProperTimeS, 8.0);
      expectClose(comp.value.properTimeDifferenceS, 2.0);
      expect(comp.value.laggingClock).toBe("clock2");
      expect(comp.value.isFrameIndependent).toBe(true);
      expect(comp.value.explanation).toContain("frame-independent");
      expect(comp.value.explanation).not.toContain("acceleration penalty");

      logEvent({
        testId: "events.clocks.reunion-comparison",
        resultStatus: comp.status,
        expected: 2.0,
        actual: comp.value.properTimeDifferenceS,
        outcome: "passed",
        durationMs,
        message: "Twin reunion comparison: 10s vs 8s, lagging clock2, frame-independent",
      });
    } else {
      logEventFailure("events.clocks.reunion-comparison", comp);
    }
  });

  test("Reciprocal rates: symmetric time dilation between inertial frames", () => {
    const t0 = performance.now();
    // Clock 1 at rest in K (v1 = 0), Clock 2 moving at v2 = 0.6c
    const res = reciprocalRates(0, 0.6);
    const durationMs = performance.now() - t0;

    expect(res.status).toBe("value");
    if (res.status === "value") {
      expectClose(res.value.clock1RateInFrame, 1.0);
      expectClose(res.value.clock2RateInFrame, 0.8);
      expectClose(res.value.clock2RateAccordingToClock1, 0.8);
      expectClose(res.value.clock1RateAccordingToClock2, 0.8);
      expect(res.value.explanation).toContain("reciprocal time dilation");

      logEvent({
        testId: "events.clocks.reciprocal-rates",
        resultStatus: res.status,
        expected: 0.8,
        actual: res.value.clock2RateAccordingToClock1,
        outcome: "passed",
        durationMs,
        message: "Symmetric reciprocal rates 0.8 between relative inertial clocks",
      });
    } else {
      logEventFailure("events.clocks.reciprocal-rates", res);
    }
  });

  test("Equator-versus-pole terrestrial comparison is outside domain in special relativity", () => {
    const res = equatorPoleComparison();
    expect(res.status).toBe("outside-domain");
    if (res.status === "outside-domain") {
      expect(res.reason).toContain("general relativity");
      expect(res.reason).toContain("geoid");
    }
  });

  test("Light clock construction: L0 = 1 ls at 0.6c ticks every 2.5 s coordinate vs 2 s proper", () => {
    const t0 = performance.now();
    const res = lightClock(1.0, 0.6);
    const durationMs = performance.now() - t0;

    expect(res.status).toBe("value");
    if (res.status === "value") {
      expectClose(res.value.properTickPeriodS, 2.0);
      expectClose(res.value.coordinateTickPeriodS, 2.5);
      expectClose(res.value.roundTripPathLengthLs, 2.5);
      expectClose(res.value.transverseLegLs, 1.0);
      expectClose(res.value.longitudinalDistanceMovedLs, 1.5);
      expectClose(res.value.oneWayLightPathLs, 1.25);
      expectClose(res.value.gamma, 1.25);
      expect(res.value.pedagogicalRole).toContain("later pedagogical construction");

      logEvent({
        testId: "events.clocks.light-clock-0.6c",
        beta: 0.6,
        resultStatus: res.status,
        expected: 2.5,
        actual: res.value.coordinateTickPeriodS,
        outcome: "passed",
        durationMs,
        message: "Light clock ticks every 2.5s coordinate vs 2s proper",
      });
    } else {
      logEventFailure("events.clocks.light-clock-0.6c", res);
    }
  });

  test("Superluminal speeds or nonfinite inputs are refused with outside-domain", () => {
    expect(
      properTime({ kind: "constant-speed-circle", radiusLs: 1, speedBeta: 1.0 }, 0, 10).status,
    ).toBe("outside-domain");
    expect(
      properTime(
        {
          kind: "piecewise-inertial",
          segments: [{ t0: 0, t1: 10, vx: 1.2 }],
        },
        0,
        10,
      ).status,
    ).toBe("outside-domain");
    expect(reciprocalRates(0, 1.0).status).toBe("outside-domain");
    expect(lightClock(1.0, 1.0).status).toBe("outside-domain");
    expect(lightClock(-1.0, 0.5).status).toBe("outside-domain");
  });
});
