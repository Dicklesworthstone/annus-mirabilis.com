import { describe, expect, test } from "bun:test";
import {
  classifySimultaneity,
  desynchronizationObserved,
  type LedgerEvent,
  movingRodLegs,
  receptionTime,
  redescribe,
  synchronizationRound,
  synchronizationTransitivity,
} from "./events.ts";
import { withinTolerance } from "../../units/tolerance.ts";

function expectClose(actual: number, expected: number, relativeTolerance = 1e-12): void {
  const verdict = withinTolerance(actual, expected, {
    relative: relativeTolerance,
    absolute: 1e-12,
  });
  if (!verdict.ok) {
    throw new Error(
      `expected ${actual} to be within ${relativeTolerance} relative (or 1e-12 absolute) of ${expected} (diff ${verdict.diff}, allowed ${verdict.allowed})`,
    );
  }
}

describe("receptionTime", () => {
  test("a signal from x=0 at t=0 reaches a receiver 10 ls away at t=10", () => {
    const result = receptionTime(0, 0, 10);
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expectClose(result.value, 10);
  });

  test("reception is always strictly later than emission, in either direction", () => {
    const result = receptionTime(5, 3, -2);
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expectClose(result.value, 10); // 5 + |3 - (-2)|
    expect(result.value).toBeGreaterThan(5);
  });

  test("nonfinite input is refused", () => {
    const result = receptionTime(Number.NaN, 0, 10);
    expect(result.status).toBe("outside-domain");
  });
});

describe("synchronizationRound (acceptance fixtures)", () => {
  test("emission 0 and reception 10 assign 5", () => {
    const result = synchronizationRound({
      emissionTimeA: 0,
      receptionTimeA: 10,
      separationLs: 5,
    });
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expectClose(result.value.assignedRemoteTime, 5);
    expectClose(result.value.criterionOffset, 0);
  });

  test("emission 20 and reception 30 assign 25", () => {
    const result = synchronizationRound({
      emissionTimeA: 20,
      receptionTimeA: 30,
      separationLs: 5,
    });
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expectClose(result.value.assignedRemoteTime, 25);
  });

  test("a round trip over 10 ls gives speed c", () => {
    const result = synchronizationRound({
      emissionTimeA: 0,
      receptionTimeA: 20,
      separationLs: 10,
    });
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expectClose(result.value.roundTripSpeedLsPerS, 1);
    expect(result.value.equalsC).toBe(true);
  });

  test("the criterion offset at the assigned time is always exactly zero: synchronized by definition", () => {
    const result = synchronizationRound({
      emissionTimeA: 7,
      receptionTimeA: 41,
      separationLs: 3,
    });
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expect(result.value.criterionOffset).toBe(0);
  });

  test("a reception at or before emission is refused", () => {
    const result = synchronizationRound({
      emissionTimeA: 10,
      receptionTimeA: 10,
      separationLs: 5,
    });
    expect(result.status).toBe("outside-domain");
  });

  test("a nonpositive separation is refused", () => {
    const result = synchronizationRound({
      emissionTimeA: 0,
      receptionTimeA: 10,
      separationLs: 0,
    });
    expect(result.status).toBe("outside-domain");
  });
});

describe("synchronizationTransitivity", () => {
  test("three mutually resting stations are transitive", () => {
    const result = synchronizationTransitivity([
      { stationA: "A", stationB: "B", relativeVelocityBeta: 0 },
      { stationA: "B", stationB: "C", relativeVelocityBeta: 0 },
      { stationA: "A", stationB: "C", relativeVelocityBeta: 0 },
    ]);
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expect(result.value.status).toBe("transitive");
    if (result.value.status !== "transitive") throw new Error("expected transitive");
    expect([...result.value.stations].sort()).toEqual(["A", "B", "C"]);
  });

  test("a pair in relative motion makes transitivity not-applicable", () => {
    const result = synchronizationTransitivity([
      { stationA: "A", stationB: "B", relativeVelocityBeta: 0 },
      { stationA: "B", stationB: "C", relativeVelocityBeta: 0.5 },
    ]);
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expect(result.value.status).toBe("not-applicable");
  });

  test("a superluminal pairwise velocity is outside-domain, not silently accepted", () => {
    const result = synchronizationTransitivity([
      { stationA: "A", stationB: "B", relativeVelocityBeta: 1 },
    ]);
    expect(result.status).toBe("outside-domain");
  });

  test("an empty pair list is refused", () => {
    expect(synchronizationTransitivity([]).status).toBe("outside-domain");
  });
});

describe("movingRodLegs (acceptance fixture, section 2)", () => {
  test("r_AB = 10 ls and u = 0.6c give legs of 25 s and 6.25 s", () => {
    const result = movingRodLegs({ separationLs: 10, beta: 0.6 });
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expectClose(result.value.outboundLegS, 25);
    expectClose(result.value.returnLegS, 6.25);
    expect(result.value.criterionSatisfiedInStationaryFrame).toBe(false);
  });

  test("at beta = 0 the two legs are equal and the criterion holds", () => {
    const result = movingRodLegs({ separationLs: 10, beta: 0 });
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expectClose(result.value.outboundLegS, 10);
    expectClose(result.value.returnLegS, 10);
    expect(result.value.criterionSatisfiedInStationaryFrame).toBe(true);
  });

  test("|u| >= c is outside-domain", () => {
    expect(movingRodLegs({ separationLs: 10, beta: 1 }).status).toBe("outside-domain");
  });

  test("a nonpositive separation is refused", () => {
    expect(movingRodLegs({ separationLs: -1, beta: 0.5 }).status).toBe("outside-domain");
  });
});

describe("classifySimultaneity", () => {
  test("exactly equal times (deltaT = 0) are simultaneous", () => {
    expect(classifySimultaneity(0)).toBe("simultaneous");
  });

  test("a positive difference outside the tolerance band is ordered-positive", () => {
    expect(classifySimultaneity(2, { absolute: 0.01 })).toBe("ordered-positive");
  });

  test("a negative difference outside the tolerance band is ordered-negative", () => {
    expect(classifySimultaneity(-2, { absolute: 0.01 })).toBe("ordered-negative");
  });

  test("a near-equal pair inside the tolerance band is indeterminate, never coerced to simultaneous", () => {
    expect(classifySimultaneity(0.001, { absolute: 0.01 })).toBe("indeterminate");
  });

  test("with no tolerance given, any nonzero difference is ordered, never indeterminate", () => {
    expect(classifySimultaneity(1e-9)).toBe("ordered-positive");
  });
});

describe("desynchronizationObserved (acceptance fixtures)", () => {
  test("L = 10 ls at 0.6c: 6 s desynchronization, trailing clock ahead", () => {
    const result = desynchronizationObserved({ properSeparationLs: 10, beta: 0.6 });
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expectClose(result.value.desyncMagnitudeS, 6);
    expect(result.value.verdict).toBe("trailing-clock-ahead");
  });

  test("at v = 0 there is no desynchronization", () => {
    const result = desynchronizationObserved({ properSeparationLs: 10, beta: 0 });
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expectClose(result.value.desyncMagnitudeS, 0);
    expect(result.value.verdict).toBe("they-agree");
  });

  test("flipping the sign of v flips the verdict from trailing-ahead to leading-ahead, same magnitude", () => {
    const result = desynchronizationObserved({ properSeparationLs: 10, beta: -0.6 });
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expectClose(result.value.desyncMagnitudeS, 6);
    expect(result.value.verdict).toBe("leading-clock-ahead");
  });

  test("|v| >= c is outside-domain", () => {
    expect(desynchronizationObserved({ properSeparationLs: 10, beta: 1 }).status).toBe(
      "outside-domain",
    );
  });
});

describe("redescribe (observer-change invariance)", () => {
  const events: readonly LedgerEvent[] = Object.freeze([
    Object.freeze({
      id: "e1",
      kind: "emission" as const,
      clockId: "A",
      ownClockReading: 0,
      coordinates: Object.freeze({ t: 0, x: 0, y: 0, z: 0 }),
    }),
    Object.freeze({
      id: "e2",
      kind: "reception" as const,
      clockId: "A",
      ownClockReading: 10,
      coordinates: Object.freeze({ t: 10, x: 0, y: 0, z: 0 }),
    }),
  ]);

  test("ids, kinds, clock ids, and each clock's own reading are unchanged by an observer change", () => {
    const result = redescribe(events, 0.6);
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expect(result.value.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(result.value.map((e) => e.kind)).toEqual(["emission", "reception"]);
    expect(result.value.map((e) => e.clockId)).toEqual(["A", "A"]);
    expect(result.value.map((e) => e.ownClockReading)).toEqual([0, 10]);
  });

  test("coordinates do change under a nonzero observer change", () => {
    const result = redescribe(events, 0.6);
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expect(result.value[1]?.coordinates.t).not.toBe(10);
  });

  test("redescribing to v and back to 0 returns the original coordinates within tolerance", () => {
    const forward = redescribe(events, 0.6);
    expect(forward.status).toBe("value");
    if (forward.status !== "value") throw new Error("expected value");
    const back = redescribe(forward.value, -0.6);
    expect(back.status).toBe("value");
    if (back.status !== "value") throw new Error("expected value");
    for (let i = 0; i < events.length; i++) {
      const original = events[i];
      const roundTripped = back.value[i];
      if (!original || !roundTripped) throw new Error("index out of range");
      expectClose(roundTripped.coordinates.t, original.coordinates.t, 1e-9);
      expectClose(roundTripped.coordinates.x, original.coordinates.x, 1e-9);
    }
  });

  test("redescribe never changes the event count", () => {
    const result = redescribe(events, 0.3);
    expect(result.status).toBe("value");
    if (result.status !== "value") throw new Error("expected value");
    expect(result.value.length).toBe(events.length);
  });

  test("|v| >= c is outside-domain", () => {
    expect(redescribe(events, 1).status).toBe("outside-domain");
  });
});
