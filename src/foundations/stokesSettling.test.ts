import { describe, expect, test } from "bun:test";
import {
  INITIAL_STOKES_SETTLING,
  readStokesSettling,
  STOKES_DEFAULTS,
  STOKES_FIELDS,
  type StokesResult,
  stokesDraft,
  stokesSettling,
} from "./stokesSettling.ts";

function accepted(result: StokesResult) {
  expect(result.kind).toBe("accepted");
  if (result.kind !== "accepted") throw new TypeError(result.message);
  return result.snapshot;
}

describe("the Stokes lesson uses a physical force balance", () => {
  test("the printed half-micrometre sphere, including diameter-based Reynolds number", () => {
    const result = accepted(INITIAL_STOKES_SETTLING);
    expect(result.dragAtOneMicronPerSecondN / 1e-15).toBeCloseTo(9.42477796077, 9);
    expect(result.velocityMPerSecond * 1e6).toBeCloseTo(0.109, 12);
    expect(result.reynolds / 1e-7).toBeCloseTo(1.09, 12);
    expect(result.oneMillimetreSeconds).toBeCloseTo(1000 / 0.109, 8);
    expect(result.direction).toBe("sinks");
    expect(result.ownerIds).toEqual(["diffusion.stokesMobility", "diffusion.driftVelocity"]);
  });

  test("radius affects weight cubically, drag linearly and terminal speed quadratically", () => {
    for (const radius of [0.1, 0.5, 1, 5]) {
      const before = accepted(stokesSettling({ ...STOKES_DEFAULTS, radius }));
      const after = accepted(stokesSettling({ ...STOKES_DEFAULTS, radius: 2 * radius }));
      expect(after.buoyantWeightN / before.buoyantWeightN).toBeCloseTo(8, 12);
      expect(after.dragAtOneMicronPerSecondN / before.dragAtOneMicronPerSecondN).toBeCloseTo(2, 12);
      expect(after.velocityMPerSecond / before.velocityMPerSecond).toBeCloseTo(4, 12);
      expect((after.oneMillimetreSeconds ?? 0) / (before.oneMillimetreSeconds ?? 1)).toBeCloseTo(
        0.25,
        12,
      );
    }
  });

  test("viscosity changes resistance, not weight, and rising uses the same signed balance", () => {
    const original = accepted(INITIAL_STOKES_SETTLING);
    const thicker = accepted(stokesSettling({ ...STOKES_DEFAULTS, viscosity: 2 }));
    expect(thicker.buoyantWeightN).toBe(original.buoyantWeightN);
    expect(thicker.velocityMPerSecond / original.velocityMPerSecond).toBeCloseTo(0.5, 12);
    expect(thicker.dragAtOneMicronPerSecondN / original.dragAtOneMicronPerSecondN).toBeCloseTo(
      2,
      12,
    );
    const rising = accepted(stokesSettling({ ...STOKES_DEFAULTS, grainDensity: 800 }));
    expect(rising.direction).toBe("rises");
    expect(rising.velocityMPerSecond).toBe(-original.velocityMPerSecond);
    expect(rising.oneMillimetreSeconds).toBe(original.oneMillimetreSeconds);
  });

  test("neutral buoyancy is a real zero drift with no manufactured finite travel time", () => {
    const result = accepted(stokesSettling({ ...STOKES_DEFAULTS, grainDensity: 1000 }));
    expect(result.buoyantWeightN).toBe(0);
    expect(result.velocityMPerSecond).toBe(0);
    expect(result.direction).toBe("balanced");
    expect(result.oneMillimetreSeconds).toBeNull();
    expect(result.dragAtOneMicronPerSecondN).toBeGreaterThan(0);
  });

  test("a fast dense sphere is refused instead of extrapolating creeping flow", () => {
    const result = stokesSettling({ radius: 100, viscosity: 0.1, grainDensity: 20000 });
    expect(result).toMatchObject({ kind: "refused", field: "radius" });
    if (result.kind === "refused") expect(result.message).toContain("Reynolds number above 0.1");
  });

  test("drafts and bounded numbers never turn malformed data into a physical value", () => {
    for (const field of STOKES_FIELDS) {
      for (const value of [NaN, Infinity, -Infinity, 0, field.max * 2])
        expect(stokesSettling({ ...STOKES_DEFAULTS, [field.key]: value })).toMatchObject({
          kind: "refused",
          field: field.key,
        });
      for (const text of ["", "-", "1+1", "NaN", "Infinity", "0x10", "1e-999", "9".repeat(49)])
        expect(
          readStokesSettling({ ...stokesDraft(STOKES_DEFAULTS), [field.key]: text }),
        ).toMatchObject({ kind: "refused", field: field.key });
    }
    expect(
      accepted(readStokesSettling({ ...stokesDraft(STOKES_DEFAULTS), radius: "5e-1" })).settings
        .radius,
    ).toBe(0.5);
  });

  test("an accepted snapshot does not retain the caller's mutable settings", () => {
    const settings = { ...STOKES_DEFAULTS };
    const result = accepted(stokesSettling(settings));
    settings.radius = 50;
    expect(result.settings.radius).toBe(0.5);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.settings)).toBe(true);
  });
});
