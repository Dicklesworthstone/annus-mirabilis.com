import { describe, expect, test } from "bun:test";
import { checkClockSynchronization, movingRodLightLegs } from "../physics/reference/events.ts";
import { withinTolerance } from "../units/tolerance.ts";

describe("events.sync: Clock synchronization and moving rod light propagation (am-ref-events-yvl)", () => {
  test("Einstein midpoint synchronization condition t_B = (t_A + t'_A) / 2 at t_A = 0, t'_A = 10 s", () => {
    const res = checkClockSynchronization(0, 5, 10);
    expect(res.status).toBe("value");
    if (res.status === "value") {
      expect(res.value.synchronized).toBe(true);
      expect(res.value.expectedTB).toBe(5);
      expect(res.value.discrepancy).toBe(0);
    }

    const resUnsync = checkClockSynchronization(0, 6, 10);
    expect(resUnsync.status).toBe("value");
    if (resUnsync.status === "value") {
      expect(resUnsync.value.synchronized).toBe(false);
      expect(resUnsync.value.expectedTB).toBe(5);
      expect(resUnsync.value.discrepancy).toBe(1);
    }
  });

  test("Moving rod propagation legs: L = 10 ls, v = 0.6c (c = 1 ls/s)", () => {
    // Forward leg: t1 = 10 / (1 - 0.6) = 25 s
    // Return leg: t2 = 10 / (1 + 0.6) = 6.25 s
    // Round trip: t_round = 25 + 6.25 = 31.25 s
    // Desynchronization: v*L/c^2 = 0.6 * 10 = 6 s
    const res = movingRodLightLegs(10, 0.6, 1.0);
    expect(res.status).toBe("value");
    if (res.status === "value") {
      expect(withinTolerance(res.value.t1Forward, 25.0, { absolute: 1e-12 }).ok).toBe(true);
      expect(withinTolerance(res.value.t2Return, 6.25, { absolute: 1e-12 }).ok).toBe(true);
      expect(withinTolerance(res.value.tRoundTrip, 31.25, { absolute: 1e-12 }).ok).toBe(true);
      expect(withinTolerance(res.value.tRoundTripRest, 20.0, { absolute: 1e-12 }).ok).toBe(true);
      expect(withinTolerance(res.value.desynchronization, 6.0, { absolute: 1e-12 }).ok).toBe(true);
    }
  });

  test("No desynchronization when relative speed v = 0", () => {
    const res = movingRodLightLegs(10, 0, 1.0);
    expect(res.status).toBe("value");
    if (res.status === "value") {
      expect(res.value.desynchronization).toBe(0);
      expect(res.value.t1Forward).toBe(10);
      expect(res.value.t2Return).toBe(10);
      expect(res.value.tRoundTrip).toBe(20);
    }
  });

  test("Refuses superluminal or invalid parameters", () => {
    const resSuper = movingRodLightLegs(10, 1.0, 1.0);
    expect(resSuper.status).toBe("outside-domain");

    const resNegL = movingRodLightLegs(-5, 0.5, 1.0);
    expect(resNegL.status).toBe("outside-domain");
  });
});
