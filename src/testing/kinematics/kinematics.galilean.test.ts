import { describe, expect, test } from "bun:test";
import {
  galileanMap,
  galileanVelocity,
  gamma,
  intervalSquared,
  Mode1904GuardError,
  rapidity,
  speedOfLightMetresPerSecond,
  withMode1904Guard,
} from "../../physics/reference/kinematics.ts";

describe("galilean", () => {
  test("light trajectories map to c ∓ v", () => {
    const right = galileanMap({ t: 1, x: 1, y: 0, z: 0 }, 0.6);
    const left = galileanMap({ t: 1, x: -1, y: 0, z: 0 }, 0.6);
    expect(right.status).toBe("value");
    expect(left.status).toBe("value");
    if (right.status === "value") expect(right.value.x / right.value.t).toBeCloseTo(0.4, 12);
    if (left.status === "value") expect(Math.abs(left.value.x / left.value.t)).toBeCloseTo(1.6, 12);
  });

  test("1904 mode: -20 m/s slow object, 0.4c and 1.6c light, modern surfaces throw", () => {
    withMode1904Guard(() => {
      const slow = galileanVelocity(10, 30);
      expect(slow.status).toBe("value");
      if (slow.status === "value") expect(slow.value).toBe(-20);
      const right = galileanVelocity(1, 0.6);
      const left = galileanVelocity(-1, 0.6);
      expect(right.status).toBe("value");
      expect(left.status).toBe("value");
      if (right.status === "value") expect(right.value).toBeCloseTo(0.4, 12);
      if (left.status === "value") expect(Math.abs(left.value)).toBeCloseTo(1.6, 12);
      expect(() => gamma(0.1)).toThrow(Mode1904GuardError);
      expect(() => rapidity(0.1)).toThrow(Mode1904GuardError);
      expect(() => intervalSquared({ t: 1, x: 0, y: 0, z: 0 })).toThrow(Mode1904GuardError);
      expect(() => speedOfLightMetresPerSecond()).toThrow(Mode1904GuardError);
    });
  });
});
