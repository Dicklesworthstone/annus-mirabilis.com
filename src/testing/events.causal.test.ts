import { describe, expect, test } from "bun:test";
import { causalOrder } from "../physics/reference/events.ts";
import { alignedBoost, transformEvent } from "../physics/reference/kinematics.ts";
import { withinTolerance } from "../units/tolerance.ts";

describe("events.causal: Invariant causal order classification and Lorentz transformation (am-ref-events-yvl & am-sr-03-rod-simultaneity-0l5i)", () => {
  test("Signature spacelike pair: dt = 0, dx = 10 -> s^2 = +100, spacelike", () => {
    const e1 = { t: 0, x: 0, y: 0, z: 0 };
    const e2 = { t: 0, x: 10, y: 0, z: 0 };
    const res = causalOrder(e1, e2, 1.0);
    expect(res.status).toBe("value");
    if (res.status === "value") {
      expect(res.value.s2).toBe(100);
      expect(res.value.classification).toBe("spacelike");
      expect(res.value.description).toContain(
        "No signal travelling at or below the speed of light reaches",
      );
    }

    // Transform under boost beta = 0.6
    const boost06 = alignedBoost(0.6, 1.0);
    expect(boost06.status).toBe("value");
    if (boost06.status === "value") {
      const e1p = transformEvent(e1, boost06.value);
      const e2p = transformEvent(e2, boost06.value);
      expect(e1p.status).toBe("value");
      expect(e2p.status).toBe("value");
      if (e1p.status === "value" && e2p.status === "value") {
        const dtPrime = e2p.value.t - e1p.value.t;
        const dxPrime = e2p.value.x - e1p.value.x;
        expect(withinTolerance(dtPrime, -7.5, { absolute: 1e-12 }).ok).toBe(true);
        expect(withinTolerance(dxPrime, 12.5, { absolute: 1e-12 }).ok).toBe(true);
        // Transformed squared interval invariant
        const resTransformed = causalOrder(e1p.value, e2p.value, 1.0);
        expect(resTransformed.status).toBe("value");
        if (resTransformed.status === "value") {
          expect(withinTolerance(resTransformed.value.s2, 100, { absolute: 1e-12 }).ok).toBe(true);
          expect(resTransformed.value.classification).toBe("spacelike");
        }
      }
    }

    // Transform under boost beta = 0.95 and -0.95
    const boost095 = alignedBoost(0.95, 1.0);
    const boostNeg095 = alignedBoost(-0.95, 1.0);
    if (boost095.status === "value" && boostNeg095.status === "value") {
      const e2pPos = transformEvent(e2, boost095.value);
      const e2pNeg = transformEvent(e2, boostNeg095.value);
      if (e2pPos.status === "value" && e2pNeg.status === "value") {
        expect(withinTolerance(e2pPos.value.t, -30.42434922, { relative: 1e-6 }).ok).toBe(true);
        expect(withinTolerance(e2pNeg.value.t, 30.42434922, { relative: 1e-6 }).ok).toBe(true);
      }
    }
  });

  test("Timelike pair: dt = 10, dx = 5 -> s^2 = -75, timelike, order invariant across all boosts", () => {
    const e1 = { t: 0, x: 0, y: 0, z: 0 };
    const e2 = { t: 10, x: 5, y: 0, z: 0 };
    const res = causalOrder(e1, e2, 1.0);
    expect(res.status).toBe("value");
    if (res.status === "value") {
      expect(res.value.s2).toBe(-75);
      expect(res.value.classification).toBe("timelike");
      expect(res.value.description).toContain(
        "A signal could travel from the first of these events to the second",
      );
    }

    // Boost beta = 0.6 -> dt' = 8.75 s
    const b06 = alignedBoost(0.6, 1.0);
    if (b06.status === "value") {
      const e2p = transformEvent(e2, b06.value);
      if (e2p.status === "value") {
        expect(withinTolerance(e2p.value.t, 8.75, { absolute: 1e-12 }).ok).toBe(true);
      }
    }

    // Boost beta = -0.95 -> dt' = 47.2378054 s, beta = 0.95 -> dt' = 16.8134561 s
    const bNeg = alignedBoost(-0.95, 1.0);
    const bPos = alignedBoost(0.95, 1.0);
    if (bNeg.status === "value" && bPos.status === "value") {
      const eNeg = transformEvent(e2, bNeg.value);
      const ePos = transformEvent(e2, bPos.value);
      if (eNeg.status === "value" && ePos.status === "value") {
        expect(withinTolerance(eNeg.value.t, 47.2378054, { relative: 1e-6 }).ok).toBe(true);
        expect(withinTolerance(ePos.value.t, 16.8134561, { relative: 1e-6 }).ok).toBe(true);
      }
    }
  });

  test("Lightlike pair: dt = 10, dx = 10 -> s^2 = 0, lightlike, order invariant", () => {
    const e1 = { t: 0, x: 0, y: 0, z: 0 };
    const e2 = { t: 10, x: 10, y: 0, z: 0 };
    const res = causalOrder(e1, e2, 1.0);
    expect(res.status).toBe("value");
    if (res.status === "value") {
      expect(res.value.s2).toBe(0);
      expect(res.value.classification).toBe("lightlike");
    }

    // Boost beta = 0.6 -> dt' = 5.0 s
    const b06 = alignedBoost(0.6, 1.0);
    if (b06.status === "value") {
      const e2p = transformEvent(e2, b06.value);
      if (e2p.status === "value") {
        expect(withinTolerance(e2p.value.t, 5.0, { absolute: 1e-12 }).ok).toBe(true);
      }
    }
  });

  test("Near-threshold pair: dt = 2, dx = 10 -> s^2 = +96, spacelike with reversal at beta = 0.2", () => {
    const e1 = { t: 0, x: 0, y: 0, z: 0 };
    const e2 = { t: 2, x: 10, y: 0, z: 0 };
    const res = causalOrder(e1, e2, 1.0);
    expect(res.status).toBe("value");
    if (res.status === "value") {
      expect(res.value.s2).toBe(96);
      expect(res.value.classification).toBe("spacelike");
    }

    // Boost at beta = 0.2 -> dt' = 0
    const b02 = alignedBoost(0.2, 1.0);
    if (b02.status === "value") {
      const e2p = transformEvent(e2, b02.value);
      if (e2p.status === "value") {
        expect(withinTolerance(e2p.value.t, 0.0, { absolute: 1e-12 }).ok).toBe(true);
      }
    }

    // Boost at beta = 0.3 -> dt' = -1.0482848 s
    const b03 = alignedBoost(0.3, 1.0);
    if (b03.status === "value") {
      const e2p = transformEvent(e2, b03.value);
      if (e2p.status === "value") {
        expect(withinTolerance(e2p.value.t, -1.0482848, { relative: 1e-6 }).ok).toBe(true);
      }
    }
  });
});
