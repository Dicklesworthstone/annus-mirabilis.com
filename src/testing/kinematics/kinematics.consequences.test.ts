import { describe, expect, test } from "bun:test";
import {
  contractedLength,
  desynchronization,
  dilatedInterval,
  ellipsoidAxes,
  gamma,
} from "../../physics/reference/kinematics.ts";

describe("consequences", () => {
  test("10 ls rod at 0.6c measures 8 ls", () => {
    const L = contractedLength(10, 0.6);
    expect(L.status).toBe("value");
    if (L.status === "value") expect(L.value).toBeCloseTo(8, 12);
  });

  test("ellipsoid axes 0.8, 1, 1", () => {
    const a = ellipsoidAxes(1, 0.6);
    expect(a.status).toBe("value");
    if (a.status === "value") {
      expect(a.value.longitudinal).toBeCloseTo(0.8, 12);
      expect(a.value.transverseY).toBe(1);
      expect(a.value.transverseZ).toBe(1);
    }
  });

  test("dilation and trailing clock ahead by 6 s", () => {
    const g = gamma(0.6);
    expect(g.status).toBe("value");
    if (g.status === "value") {
      const dt = dilatedInterval(1, 0.6);
      expect(dt.status).toBe("value");
      if (dt.status === "value") expect(dt.value).toBeCloseTo(g.value, 12);
    }
    const d = desynchronization(10, 0.6, 1);
    expect(d.status).toBe("value");
    if (d.status === "value") {
      expect(d.value).toBeCloseTo(6, 12);
      expect(d.value).toBeGreaterThan(0);
    }
  });
});
