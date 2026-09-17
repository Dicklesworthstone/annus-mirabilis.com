import { describe, expect, test } from "bun:test";
import {
  galileanRelativisticVelocityDifference,
  speedOfLightMetresPerSecond,
  transformVelocity,
} from "../../physics/reference/kinematics.ts";
import { classifyWithTolerance, withinTolerance } from "../../units/tolerance.ts";

const c = speedOfLightMetresPerSecond();

describe("velocity", () => {
  test("transverse light ray (0, c) maps to (-v, c/gamma) at speed c", () => {
    const v = 0.6 * c;
    const out = transformVelocity({ ux: 0, uy: c, uz: 0 }, 0.6, c);
    expect(out.status).toBe("value");
    if (out.status !== "value") return;
    expect(out.value.ux).toBeCloseTo(-v, 6);
    const speed = Math.hypot(out.value.ux, out.value.uy, out.value.uz);
    expect(withinTolerance(speed, c, { relative: 1e-12 }).ok).toBe(true);
  });

  test("null stays null; subluminal stays subluminal", () => {
    const nullV = transformVelocity({ ux: c / Math.sqrt(2), uy: c / Math.sqrt(2), uz: 0 }, 0.4, c);
    expect(nullV.status).toBe("value");
    if (nullV.status === "value") {
      const s = Math.hypot(nullV.value.ux, nullV.value.uy, nullV.value.uz);
      const cls = classifyWithTolerance(s - c, { relative: 1e-12, scale: c });
      expect(cls.sign === "zero" || cls.sign === "indeterminate").toBe(true);
    }
    const sub = transformVelocity({ ux: 0.2 * c, uy: 0.1 * c, uz: 0 }, 0.5, c);
    expect(sub.status).toBe("value");
    if (sub.status === "value") {
      expect(Math.hypot(sub.value.ux, sub.value.uy, sub.value.uz)).toBeLessThan(c);
    }
  });

  test("superluminal particle is outside-domain", () => {
    const r = transformVelocity({ ux: 1.1 * c, uy: 0, uz: 0 }, 0.2, c);
    expect(r.status).toBe("outside-domain");
  });

  test("slow-object difference -6.675900e-14 m/s; naive subtraction misses", () => {
    const d = galileanRelativisticVelocityDifference(10, 30, c);
    expect(d.status).toBe("value");
    if (d.status !== "value") return;
    expect(withinTolerance(d.value.difference, -6.6759e-14, { relative: 1e-5 }).ok).toBe(true);
    expect(withinTolerance(d.value.relativeSize, 3.33795e-15, { relative: 1e-5 }).ok).toBe(true);
    const g = 1 / Math.sqrt(1 - (30 / c) ** 2);
    const composed = (10 - 30) / (1 - (10 * 30) / (c * c));
    const galilean = 10 - 30;
    const naiveSize = Math.abs(composed - galilean) / Math.abs(galilean);
    expect(withinTolerance(naiveSize, 3.375e-15, { absolute: 2e-16 }).ok).toBe(true);
    expect(withinTolerance(naiveSize, d.value.relativeSize, { relative: 0.005 }).ok).toBe(false);
    void g;
  });
});
