import { describe, expect, test } from "bun:test";
import {
  composePrinted,
  transformLightDirection,
  transformVelocity,
} from "../../physics/reference/kinematics.ts";
import { withinTolerance } from "../../units/tolerance.ts";

describe("the printed velocity magnitude at cancellation and light-speed limits", () => {
  test("opposing 0.6c velocities admit rest instead of a negative expanded radicand", () => {
    const signed = composePrinted(0.6, -0.6, 0, 1);
    expect(signed.status).toBe("value");
    if (signed.status === "value") expect(signed.value).toBe(0);
    const angled = composePrinted(0.6, 0.6, Math.PI, 1);
    expect(angled.status).toBe("value");
    if (angled.status === "value") expect(Math.abs(angled.value)).toBeLessThan(2e-15);
  });

  test("a small uncancelled speed survives beside opposing order-one inputs", () => {
    const v = 0.6;
    const w = -0.6 + 1e-9;
    const result = composePrinted(v, w, 0, 1);
    expect(result.status).toBe("value");
    if (result.status !== "value") return;
    const collinear = Math.abs((v + w) / (1 + v * w));
    expect(result.value).toBeGreaterThan(0);
    expect(withinTolerance(result.value, collinear, { relative: 2e-15 }).ok).toBe(true);
  });

  test("normalizing before squaring preserves a change of speed units", () => {
    for (const c of [1e-180, 1, 299_792_458, 1e180]) {
      const result = composePrinted(0.6 * c, 0.6 * c, 0, c);
      expect(result.status).toBe("value");
      if (result.status === "value") {
        expect(Number.isFinite(result.value)).toBe(true);
        expect(withinTolerance(result.value / c, 15 / 17, { relative: 3e-15 }).ok).toBe(true);
      }
    }
  });

  test("the printed formula itself admits w = c at every angle", () => {
    for (const v of [-0.99, -0.6, 0, 0.6, 0.99]) {
      for (const degrees of [0, 37, 90, 135, 180, 270, 359]) {
        const result = composePrinted(v, 1, (degrees * Math.PI) / 180, 1);
        expect(result.status).toBe("value");
        if (result.status === "value") expect(result.value).toBe(1);
      }
    }
  });

  test("a light-speed point does not admit a light-speed observer or a faster point", () => {
    expect(composePrinted(1, 0.5, 0, 1)).toMatchObject({
      status: "outside-domain",
      condition: "superluminal-observer",
    });
    expect(composePrinted(0.6, 1 + Number.EPSILON, 0, 1)).toMatchObject({
      status: "outside-domain",
      condition: "superluminal-particle",
    });
  });
});

describe("declared null directions, without relaxing particle-speed admission", () => {
  test("a 2:-3:6 direction has the independent rational aberration -11:-12:24 at beta=3/5", () => {
    for (const scale of [1e-250, 1, 1e250]) {
      const result = transformLightDirection({ x: 2 * scale, y: -3 * scale, z: 6 * scale }, 0.6, 1);
      expect(result.status).toBe("value");
      if (result.status !== "value") continue;
      expect(result.value.ux).toBeCloseTo(-11 / 29, 14);
      expect(result.value.uy).toBeCloseTo(-12 / 29, 14);
      expect(result.value.uz).toBeCloseTo(24 / 29, 14);
    }
  });

  test("oblique light directions retain speed and survive the inverse frame change", () => {
    for (const beta of [-0.99, -0.6, 0, 0.6, 0.99]) {
      for (const direction of [
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 2, y: -3, z: 6 },
        { x: Math.cos(2.3), y: Math.sin(2.3), z: 0 },
      ]) {
        const c = 299_792_458;
        const transformed = transformLightDirection(direction, beta, c);
        expect(transformed.status).toBe("value");
        if (transformed.status !== "value") continue;
        const { ux, uy, uz } = transformed.value;
        expect(withinTolerance(Math.hypot(ux, uy, uz), c, { relative: 5e-15 }).ok).toBe(true);
        const restored = transformLightDirection({ x: ux, y: uy, z: uz }, -beta, c);
        expect(restored.status).toBe("value");
        if (restored.status !== "value") continue;
        const norm = Math.hypot(direction.x, direction.y, direction.z);
        expect(Math.abs(restored.value.ux / c - direction.x / norm)).toBeLessThan(2e-12);
        expect(Math.abs(restored.value.uy / c - direction.y / norm)).toBeLessThan(2e-12);
        expect(Math.abs(restored.value.uz / c - direction.z / norm)).toBeLessThan(2e-12);
      }
    }
  });

  test("a zero or nonfinite direction and a superluminal raw particle are still refused", () => {
    expect(transformLightDirection({ x: 0, y: 0, z: 0 }, 0.6, 1)).toMatchObject({
      status: "outside-domain",
      condition: "invalid-direction",
    });
    expect(
      transformLightDirection({ x: Number.POSITIVE_INFINITY, y: 0, z: 0 }, 0.6, 1),
    ).toMatchObject({
      status: "outside-domain",
      condition: "nonfinite-input",
    });
    expect(transformLightDirection({ x: 1, y: 0, z: 0 }, 1, 1)).toMatchObject({
      status: "outside-domain",
      condition: "superluminal-observer",
    });
    expect(transformVelocity({ ux: 1 + Number.EPSILON, uy: 0, uz: 0 }, 0.6, 1)).toMatchObject({
      status: "outside-domain",
      condition: "superluminal-particle",
    });
  });
});
