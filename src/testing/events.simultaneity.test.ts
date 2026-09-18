import { describe, expect, test } from "bun:test";
import { classifySimultaneity } from "../physics/reference/events.ts";
import { withinTolerance } from "../units/tolerance.ts";

describe("events.simultaneity: Simultaneity classification (am-ref-events-yvl)", () => {
  test("Classifies exact zero as simultaneous", () => {
    expect(classifySimultaneity(0)).toBe("simultaneous");
  });

  test("Classifies positive deltaT as ordered-positive and negative deltaT as ordered-negative", () => {
    expect(classifySimultaneity(2.5)).toBe("ordered-positive");
    expect(classifySimultaneity(-7.5)).toBe("ordered-negative");
  });

  test("Classifies near-cancellation deltaT within tolerance band as indeterminate", () => {
    expect(classifySimultaneity(1e-13, { absolute: 1e-12 })).toBe("indeterminate");
    expect(classifySimultaneity(-1e-13, { absolute: 1e-12 })).toBe("indeterminate");
  });

  test("Fixture at beta = 0.6: events 10 ls apart, simultaneous in unprimed frame, have deltaT' = -7.5 s and deltaX' = 12.5 ls", () => {
    const e1 = { t: 0, x: 0, y: 0, z: 0 };
    const e2 = { t: 0, x: 10, y: 0, z: 0 };

    const res = classifySimultaneity(e1, e2, 0.6);
    expect(res.status).toBe("value");
    if (res.status === "value") {
      expect(withinTolerance(res.value.deltaTPrime, -7.5, { absolute: 1e-12 }).ok).toBe(true);
      expect(withinTolerance(res.value.deltaXPrime, 12.5, { absolute: 1e-12 }).ok).toBe(true);
      expect(res.value.order).toBe("ordered-negative");
    }
  });

  test("Identity at v = 0: events remain simultaneous and separation invariant", () => {
    const e1 = { t: 0, x: 0, y: 0, z: 0 };
    const e2 = { t: 0, x: 10, y: 0, z: 0 };

    const resZero = classifySimultaneity(e1, e2, 0);
    expect(resZero.status).toBe("value");
    if (resZero.status === "value") {
      expect(resZero.value.deltaTPrime).toBe(0);
      expect(resZero.value.deltaXPrime).toBe(10);
      expect(resZero.value.order).toBe("simultaneous");
    }
  });

  test("Reversed boost at beta = -0.6 flips temporal order to ordered-positive", () => {
    const e1 = { t: 0, x: 0, y: 0, z: 0 };
    const e2 = { t: 0, x: 10, y: 0, z: 0 };

    const resRev = classifySimultaneity(e1, e2, -0.6);
    expect(resRev.status).toBe("value");
    if (resRev.status === "value") {
      expect(withinTolerance(resRev.value.deltaTPrime, 7.5, { absolute: 1e-12 }).ok).toBe(true);
      expect(withinTolerance(resRev.value.deltaXPrime, 12.5, { absolute: 1e-12 }).ok).toBe(true);
      expect(resRev.value.order).toBe("ordered-positive");
    }
  });

  test("Two-time overload classifies before, after, simultaneous, and indeterminate", () => {
    const sim = classifySimultaneity(5, 5);
    expect(sim.status).toBe("value");
    if (sim.status === "value") expect(sim.value).toBe("simultaneous");

    const after = classifySimultaneity(10, 5);
    expect(after.status).toBe("value");
    if (after.status === "value") expect(after.value).toBe("after");

    const before = classifySimultaneity(5, 10);
    expect(before.status).toBe("value");
    if (before.status === "value") expect(before.value).toBe("before");

    const indet = classifySimultaneity(5.0001, 5, 0.01);
    expect(indet.status).toBe("value");
    if (indet.status === "value") expect(indet.value).toBe("indeterminate");
  });

  test("Superluminal speed or nonfinite event coordinates are refused with outside-domain", () => {
    const e1 = { t: 0, x: 0, y: 0, z: 0 };
    const e2 = { t: 0, x: 10, y: 0, z: 0 };

    const resSuper = classifySimultaneity(e1, e2, 1.0);
    expect(resSuper.status).toBe("outside-domain");

    const resNonfinite = classifySimultaneity({ t: Number.NaN, x: 0, y: 0, z: 0 }, e2, 0.6);
    expect(resNonfinite.status).toBe("outside-domain");
  });
});

