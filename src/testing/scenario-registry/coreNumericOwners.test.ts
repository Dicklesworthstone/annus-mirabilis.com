import { describe, expect, test } from "bun:test";
import { CORE_NUMERIC_OWNERS, DIFFUSION_RMS_OWNER, num } from "./coreNumericOwners.ts";
import { getOwner } from "./owners.ts";

describe("content-phase scenario adapters", () => {
  test("essay and full scenario execution use the same owner objects", () => {
    for (const owner of CORE_NUMERIC_OWNERS) expect(getOwner(owner.id)).toBe(owner);
  });

  test("missing and nonfinite owner inputs carry a named refusal", () => {
    expect(() => num({}, "temperature")).toThrow("missing or nonfinite");
    expect(() => num({ temperature: Number.NaN }, "temperature")).toThrow("missing or nonfinite");
    expect(num({ temperature: 293.15 }, "temperature")).toBe(293.15);
  });

  test("a non-value displacement cannot become a numeric scenario result", () => {
    expect(() => DIFFUSION_RMS_OWNER.fn({
      inputs: { temperature: 293.15, viscosity: 1e-3, particleRadius: 5e-7, elapsedTime: -1 },
      constantSetId: "modern-si-2019",
    })).toThrow("rmsDisplacement did not return a value");
  });
});
