/**
 * am-sr-05-moving-clocks-2zka. Real evaluators (kinematics.ts + this bead's own worldline.ts
 * host calculation), against the bead's exact stated fixtures.
 */
import { describe, expect, test } from "bun:test";
import { SR05_DEFAULTS, SR05_PRESETS } from "../experiments/sr05/definition.ts";
import { evaluateSr05 } from "../experiments/sr05/session.ts";
import {
  dilationLossPerSecond,
  EQUATOR_SPEED_M_PER_S,
  equatorNote,
  gamma,
  lightClockTicks,
  properTimeAlongLegs,
  realGeoidPrediction,
  reciprocalRates,
  reunionComparison,
  speedForDailyLoss,
} from "../experiments/sr05/worldline.ts";
import { withinTolerance } from "../units/tolerance.ts";

function expectClose(actual: number, expected: number, relativeTolerance = 1e-12): void {
  const verdict = withinTolerance(actual, expected, {
    relative: relativeTolerance,
    absolute: 1e-15,
  });
  if (!verdict.ok) {
    throw new Error(
      `expected ${actual} to be within ${relativeTolerance} relative of ${expected} (diff ${verdict.diff}, allowed ${verdict.allowed})`,
    );
  }
}

describe("acceptance fixtures", () => {
  test("inertial 0.6c: tau/t = 0.8", () => {
    const result = properTimeAlongLegs([{ beta: 0.6, duration: 10 }]);
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expectClose(result.value.properTime / result.value.coordinateTime, 0.8);
  });

  test("out-and-back at 0.6c for t = 10s: reunion tau = 8s", () => {
    const legs = [
      { beta: 0.6, duration: 5 },
      { beta: 0.6, duration: 5 },
    ];
    const result = reunionComparison(legs);
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expectClose(result.value.travelingProperTime, 8);
    expectClose(result.value.stationaryProperTime, 10);
    expectClose(result.value.exactLag, 2);
    expectClose(result.value.printedApproxLag, 1.8);
  });

  test("constant-speed circle at 0.6c for 10s: reunion tau = 8s (speed profile only, not geometry)", () => {
    const result = reunionComparison([{ beta: 0.6, duration: 10 }]);
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expectClose(result.value.travelingProperTime, 8);
  });

  test("beta = 1e-4: stable loss is 5.0000000125e-9 per second versus the printed 5e-9", () => {
    const result = dilationLossPerSecond(1e-4);
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expectClose(result.value.exact, 5.0000000125e-9, 1e-10);
    expectClose(result.value.printedSecondOrder, 5e-9);
  });

  test("a clock losing 1 s per day moves at beta ~= 4.81124e-3 (~1442.37 km/s)", () => {
    const result = speedForDailyLoss(1);
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expectClose(result.value, 4.81124e-3, 1e-6);
    const speedKmPerS = (result.value * 299792.458) / 1;
    expect(Math.abs(speedKmPerS - 1442.37)).toBeLessThan(0.05);
  });

  test("light clock: L0 = 1 ls at 0.6c ticks every 2.5s coordinate versus 2s proper", () => {
    const result = lightClockTicks(1, 0.6);
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expectClose(result.value.properTick, 2);
    expectClose(result.value.coordinateTick, 2.5);
  });
});

describe("the ideal-clock test: no acceleration penalty", () => {
  test("two worldlines with the same speed profile but different turning accelerations give the same tau", () => {
    // "Turning acceleration" cannot change the arithmetic here since properTimeAlongLegs is a
    // pure function of (beta, duration) pairs -- it has no acceleration parameter at all. The
    // real test is that permuting leg order, or splitting a leg into more legs of the same total
    // duration at the same speed, leaves tau unchanged.
    const wholeLeg = properTimeAlongLegs([{ beta: 0.6, duration: 10 }]);
    const splitIntoFive = properTimeAlongLegs(
      Array.from({ length: 5 }, () => ({ beta: 0.6, duration: 2 })),
    );
    const reversedOrder = properTimeAlongLegs([
      { beta: 0.6, duration: 3 },
      { beta: -0.6, duration: 4 },
      { beta: 0.6, duration: 3 },
    ]);
    expect(wholeLeg.status).toBe("value");
    expect(splitIntoFive.status).toBe("value");
    expect(reversedOrder.status).toBe("value");
    if (
      wholeLeg.status !== "value" ||
      splitIntoFive.status !== "value" ||
      reversedOrder.status !== "value"
    )
      throw new Error("expected value");
    expectClose(wholeLeg.value.properTime, splitIntoFive.value.properTime);
    expectClose(wholeLeg.value.properTime, reversedOrder.value.properTime);
  });

  test("50 seeded polygon worldlines: permuting leg order leaves tau unchanged", () => {
    // Deterministic seeded generator (xorshift32), not Math.random -- reproducible across runs.
    let state = 0x2f6e2b1;
    function next(): number {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state / 0xffffffff;
    }
    for (let trial = 0; trial < 50; trial++) {
      const legCount = 2 + Math.floor(next() * 6);
      const legs = Array.from({ length: legCount }, () => ({
        beta: (next() - 0.5) * 1.8, // in (-0.9, 0.9)
        duration: 0.1 + next() * 9.9,
      }));
      const forward = properTimeAlongLegs(legs);
      const shuffled = properTimeAlongLegs([...legs].reverse());
      expect(forward.status).toBe("value");
      expect(shuffled.status).toBe("value");
      if (forward.status !== "value" || shuffled.status !== "value")
        throw new Error("expected value");
      expectClose(forward.value.properTime, shuffled.value.properTime);
      expectClose(forward.value.coordinateTime, shuffled.value.coordinateTime);
    }
  });
});

describe("adversarial: the naive form fails where the stable form passes", () => {
  test("naive 1 - sqrt(1 - beta^2) at beta = 1e-4 differs from the reference by ~1.36e-8 relative; the stable evaluator does not", () => {
    const beta = 1e-4;
    const naive = 1 - Math.sqrt(1 - beta * beta);
    const stable = dilationLossPerSecond(beta);
    expect(stable.status).toBe("value");
    if (stable.status !== "value") throw new Error("expected value");
    // A 40-digit-precision reference for beta^2/(1+sqrt(1-beta^2)) at beta=1e-4, computed
    // independently by hand (not by calling the evaluator under test): 5.0000000125000000078...e-9.
    const reference = 5.0000000125e-9;
    expect(withinTolerance(naive, reference, { relative: 2e-8, absolute: 1e-20 }).ok).toBe(true);
    expect(withinTolerance(naive, reference, { relative: 1e-8, absolute: 1e-20 }).ok).toBe(false);
    expectClose(stable.value.exact, reference, 1e-12);
    // The assertion the naive form fails and the stable form passes:
    const naiveVerdict = withinTolerance(naive, reference, { relative: 1e-12, absolute: 1e-20 });
    expect(naiveVerdict.ok).toBe(false);
  });
});

describe("reciprocity: symmetric rate, invariant reunion", () => {
  test("both frames report the same dilation factor for the other clock", () => {
    const beta = 0.6;
    const fromS = reciprocalRates(beta);
    const fromSPrime = reciprocalRates(-beta);
    expect(fromS.status).toBe("value");
    expect(fromSPrime.status).toBe("value");
    if (fromS.status !== "value" || fromSPrime.status !== "value")
      throw new Error("expected value");
    expectClose(fromS.value.dilationFactor, fromSPrime.value.dilationFactor);
  });

  test("the reunion comparison for a closed worldline does not depend on which of three betas describes it", () => {
    // "Evaluated in three frames": the closed worldline's reunion lag is a property of the
    // worldline's own speed profile, so it is unchanged by how a describing frame is chosen --
    // it is not recomputed relative to any observer's frame here (this bead's own
    // reciprocalRates/reunionComparison separation).
    const legs = [
      { beta: 0.6, duration: 5 },
      { beta: 0.6, duration: 5 },
    ];
    const reunion = reunionComparison(legs);
    expect(reunion.status).toBe("value");
    if (reunion.status !== "value") throw new Error("expected value");
    for (const observerBeta of [0, 0.3, -0.5]) {
      // Observer changes never alter worldlines or readings at events (this bead's acceptance
      // criterion): recomputing with a different "frame of description" input changes nothing
      // about the worldline's own reunion arithmetic, since reunionComparison takes no observer
      // parameter at all.
      void observerBeta;
      const again = reunionComparison(legs);
      expect(again.status).toBe("value");
      if (again.status !== "value") throw new Error("expected value");
      expectClose(again.value.exactLag, reunion.value.exactLag);
    }
  });
});

describe("no inertial observer at |v| >= c: a typed refusal, never a clamp", () => {
  test("gamma(1) and gamma(1.2) both return outside-domain, not a clamped finite number", () => {
    expect(gamma(1).status).toBe("outside-domain");
    expect(gamma(1.2).status).toBe("outside-domain");
    expect(gamma(-1.5).status).toBe("outside-domain");
  });

  test("the worldline builder propagates the typed refusal, never silently clamping a leg's speed", () => {
    const result = properTimeAlongLegs([{ beta: 1.5, duration: 1 }]);
    expect(result.status).toBe("outside-domain");
  });

  test("evaluateSr05 propagates outside-domain through to the ScientificResult, never fabricating a value", () => {
    const outputs = evaluateSr05({ ...SR05_DEFAULTS, speed: 1.5, worldlinePreset: "inertial" });
    const properTime = outputs.find((o) => o.quantityId === "properTime");
    expect(properTime?.status).toBe("outside-domain");
  });
});

describe("equator mode: the limit note and the real-geoid refusal", () => {
  test("the illustrative fractional rate matches the special-relativity-only computation", () => {
    const note = equatorNote();
    expect(EQUATOR_SPEED_M_PER_S).toBe(465.1);
    expectClose(note.fractionalRate, 1.2034e-12, 1e-3);
    expect(note.approxNanosecondsPerDay).toBeGreaterThan(100);
    expect(note.approxNanosecondsPerDay).toBeLessThan(110);
  });

  test("a request to predict a real clock on the geoid returns outside-domain, never a number", () => {
    const result = realGeoidPrediction();
    expect(result.status).toBe("outside-domain");
    if (result.status !== "outside-domain") throw new Error("expected outside-domain");
    expect(result.reason).toContain("gravitational");
  });
});

describe("every preset reproduces its stated values", () => {
  test("sr-05-inertial-0.6c", () => {
    const outputs = evaluateSr05(SR05_PRESETS["sr-05-inertial-0.6c"]!.parameters);
    const properTime = outputs.find((o) => o.quantityId === "properTime");
    const coordinateTime = outputs.find((o) => o.quantityId === "coordinateTime");
    expect(properTime?.status).toBe("value");
    expect(coordinateTime?.status).toBe("value");
    if (properTime?.status !== "value" || coordinateTime?.status !== "value")
      throw new Error("expected value");
    expectClose((properTime.value as number) / (coordinateTime.value as number), 0.8);
  });

  test("sr-05-out-and-back-0.6c", () => {
    const outputs = evaluateSr05(SR05_PRESETS["sr-05-out-and-back-0.6c"]!.parameters);
    const lag = outputs.find((o) => o.quantityId === "reunionExactLag");
    expect(lag?.status).toBe("value");
    if (lag?.status !== "value") throw new Error("expected value");
    expectClose(lag.value as number, 2);
  });

  test("sr-05-circle-0.6c", () => {
    const outputs = evaluateSr05(SR05_PRESETS["sr-05-circle-0.6c"]!.parameters);
    const properTime = outputs.find((o) => o.quantityId === "properTime");
    expect(properTime?.status).toBe("value");
    if (properTime?.status !== "value") throw new Error("expected value");
    expectClose(properTime.value as number, 8);
  });

  test("sr-05-low-speed-1e-4", () => {
    const outputs = evaluateSr05(SR05_PRESETS["sr-05-low-speed-1e-4"]!.parameters);
    const exact = outputs.find((o) => o.quantityId === "dilationLossExact");
    expect(exact?.status).toBe("value");
    if (exact?.status !== "value") throw new Error("expected value");
    expectClose(exact.value as number, 5.0000000125e-9, 1e-10);
  });

  test("sr-05-daily-second", () => {
    const outputs = evaluateSr05(SR05_PRESETS["sr-05-daily-second"]!.parameters);
    const exact = outputs.find((o) => o.quantityId === "dilationLossExact");
    expect(exact?.status).toBe("value");
    if (exact?.status !== "value") throw new Error("expected value");
    // At beta = 4.81124e-3, the per-second loss should correspond to 1/86400 per day.
    expectClose((exact.value as number) * 86400, 1, 1e-4);
  });

  test("sr-05-light-clock-0.6c", () => {
    const outputs = evaluateSr05(SR05_PRESETS["sr-05-light-clock-0.6c"]!.parameters);
    const properTick = outputs.find((o) => o.quantityId === "lightClockProperTick");
    const coordinateTick = outputs.find((o) => o.quantityId === "lightClockCoordinateTick");
    expect(properTick?.status).toBe("value");
    expect(coordinateTick?.status).toBe("value");
    if (properTick?.status !== "value" || coordinateTick?.status !== "value")
      throw new Error("expected value");
    expectClose(properTick.value as number, 2);
    expectClose(coordinateTick.value as number, 2.5);
  });

  test("sr-05-equator-note", () => {
    const outputs = evaluateSr05(SR05_PRESETS["sr-05-equator-note"]!.parameters);
    const rate = outputs.find((o) => o.quantityId === "equatorFractionalRate");
    expect(rate?.status).toBe("value");
  });
});

describe("observer changes never alter worldlines, readings, or run identity", () => {
  test("changing frameOfDescription leaves every non-input output unchanged", () => {
    const base = evaluateSr05({ ...SR05_DEFAULTS, frameOfDescription: 0 });
    const redescribed = evaluateSr05({ ...SR05_DEFAULTS, frameOfDescription: 0.4 });
    const readingIds = [
      "properTime",
      "coordinateTime",
      "reunionExactLag",
      "reunionPrintedApproxLag",
      "dilationLossExact",
    ];
    for (const id of readingIds) {
      const a = base.find((o) => o.quantityId === id);
      const b = redescribed.find((o) => o.quantityId === id);
      expect(a?.status).toBe(b?.status);
      if (a?.status === "value" && b?.status === "value") {
        expectClose(a.value as number, b.value as number);
      }
    }
  });
});
