import { describe, expect, test } from "bun:test";
import { measureRodLength, selectSimultaneousEndpoints } from "../physics/reference/events.ts";
import { withinTolerance } from "../units/tolerance.ts";

describe("events.rod: Rod length measurement and simultaneous endpoints (am-ref-events-yvl & am-sr-03-rod-simultaneity-0l5i)", () => {
  test("Valid measurement at beta = 0.6: L0 = 10 ls measured in K gives 8 ls", () => {
    // Select endpoints simultaneous in K at t = 0
    const endpoints = selectSimultaneousEndpoints("k", "K", 0.6, 10, 0, 1.0);
    expect(endpoints.status).toBe("value");
    if (endpoints.status === "value") {
      const e1 = endpoints.value.e1;
      const e2 = endpoints.value.e2;
      expect(e1.t).toBe(0);
      expect(e2.t).toBe(0);
      expect(withinTolerance(e2.x - e1.x, 8.0, { absolute: 1e-12 }).ok).toBe(true);

      const meas = measureRodLength(e1, e2, "K", "k", 0.6, 10, 1.0);
      expect(meas.status).toBe("value");
      expect(meas.isSimultaneous).toBe(true);
      expect(meas.measuredLength).toBe(8.0);
    }
  });

  test("Reciprocal measurement: rod at rest in K measured from k gives 8 ls", () => {
    const endpoints = selectSimultaneousEndpoints("K", "k", 0.6, 10, 0, 1.0);
    expect(endpoints.status).toBe("value");
    if (endpoints.status === "value") {
      const e1 = endpoints.value.e1;
      const e2 = endpoints.value.e2;
      expect(e1.t).toBe(0);
      expect(e2.t).toBe(0);
      expect(withinTolerance(e2.x - e1.x, 8.0, { absolute: 1e-12 }).ok).toBe(true);

      const meas = measureRodLength(e1, e2, "k", "K", 0.6, 10, 1.0);
      expect(meas.status).toBe("value");
      expect(meas.isSimultaneous).toBe(true);
      expect(meas.measuredLength).toBe(8.0);
    }
  });

  test("Non-simultaneous endpoint pair is refused with condition and repair", () => {
    // Two events with dt != 0 in measuring frame K
    const e1 = { t: 0, x: 0, y: 0, z: 0 };
    const e2 = { t: 7.5, x: 12.5, y: 0, z: 0 };
    const meas = measureRodLength(e1, e2, "K", "k", 0.6, 10, 1.0);
    expect(meas.status).toBe("not-applicable");
    expect(meas.isSimultaneous).toBe(false);
    expect(meas.condition).toBe("non-simultaneous-endpoints");
    expect(meas.reason).toContain(
      "these endpoint events are not simultaneous in the measuring frame",
    );
    expect(meas.repairSuggestedPair).toBeDefined();
    if (meas.repairSuggestedPair) {
      expect(meas.repairSuggestedPair.e1.t).toBe(0);
      expect(meas.repairSuggestedPair.e2.t).toBe(0);
      expect(
        withinTolerance(meas.repairSuggestedPair.e2.x - meas.repairSuggestedPair.e1.x, 8.0, {
          absolute: 1e-12,
        }).ok,
      ).toBe(true);
    }
  });
});
