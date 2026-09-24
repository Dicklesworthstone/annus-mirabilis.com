import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { constantValue, getConstantSet, thermalConstant } from "../physics/reference/constants.ts";
import { stokesMobility } from "../physics/reference/diffusion/routeA.ts";
import { osmoticPressure } from "../physics/reference/diffusion.ts";
import { withinTolerance } from "../units/tolerance.ts";

/**
 * am-found-transport-thermo-smv3: "Quoted numbers match tests." Every number the osmotic-pressure,
 * Stokes-drag and thermal-energy lessons print is recomputed here, through the owners where one
 * exists, and must round to what the lesson prints, at the precision it prints. A reader who redoes
 * a line of arithmetic from the lesson's own inputs gets the lesson's own answer.
 */

const text = (slug: string) => {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) for (const x of v) walk(x);
    else if (v && typeof v === "object") for (const x of Object.values(v)) walk(x);
  };
  walk(
    JSON.parse(readFileSync(join(process.cwd(), "content/foundations", `${slug}.json`), "utf8")),
  );
  return out.join(" ");
};

/** Whether a value, rounded to the given significant figures, is the printed number. */
const roundsTo = (value: number, printed: number, figures: number) =>
  withinTolerance(Number(value.toPrecision(figures)), printed, { relative: 1e-12 }).ok;

const value = (r: { result: { status: string; value?: unknown } }) => {
  if (r.result.status !== "value" || typeof r.result.value !== "number")
    throw new TypeError(r.result.status);
  return r.result.value;
};

const modern = getConstantSet("modern-si-2019");
const kB = thermalConstant(modern).value;

describe("osmotic pressure: 0.1 gram-molecule of sugar per litre at 293 K", () => {
  const t = text("free-energy-osmotic-pressure");
  const nu = 100 * 6.02e23;
  const perParticle = (8.314 * 293) / 6.02e23;

  test("ν = 6.02 × 10²⁵ per cubic metre, and RT/N = 4.05 × 10⁻²¹ J from the lesson's R and N", () => {
    expect(roundsTo(nu, 6.02e25, 3)).toBe(true);
    expect(roundsTo(perParticle, 4.05e-21, 3)).toBe(true);
    expect(t).toContain("6.02 × 10²⁵ molecules per cubic metre");
    expect(t).toContain("= 4.05 × 10⁻²¹ joules");
  });

  test("p ≈ 2.4 × 10⁵ Pa, about 2.4 atmospheres, a water column nearly 25 m; the owner agrees", () => {
    const p = perParticle * nu;
    expect(roundsTo(p, 2.4e5, 2)).toBe(true);
    expect(roundsTo(p / 101325, 2.4, 2)).toBe(true);
    const column = p / (1000 * 9.80665);
    expect(column).toBeLessThan(25);
    expect(roundsTo(column, 25, 2)).toBe(true);
    // The owner, with the exact 2019 SI k_B, gives the same pressure to the printed precision.
    expect(roundsTo(value(osmoticPressure({ n: nu, T: 293 }, modern)), 2.4e5, 2)).toBe(true);
    expect(t).toContain("p ≈ 2.4 × 10⁵ Pa, about 2.4 atmospheres");
    expect(t).toContain("nearly 25 metres tall");
  });

  test("a million grains per cubic millimetre: about 4 × 10⁻⁶ Pa, fewer by about 6 × 10¹⁰", () => {
    expect(roundsTo(perParticle * 1e15, 4e-6, 1)).toBe(true);
    expect(roundsTo(nu / 1e15, 6e10, 1)).toBe(true);
    expect(t).toContain("≈ 4 × 10⁻⁶ Pa");
    expect(t).toContain("by a factor of about 6 × 10¹⁰");
  });
});

describe("Stokes drag on a half-micrometre sphere in water", () => {
  const t = text("viscosity-stokes-drag");
  const mobility = value(stokesMobility(1e-3, 5e-7));

  test("at 1 μm/s the drag is about 9.4 × 10⁻¹⁵ N, and twice the speed 1.9 × 10⁻¹⁴ N", () => {
    expect(roundsTo(1e-6 / mobility, 9.4e-15, 2)).toBe(true);
    expect(roundsTo(2e-6 / mobility, 1.9e-14, 2)).toBe(true);
    expect(t).toContain("about 9.4 × 10⁻¹⁵ newtons");
    expect(t).toContain("1.9 × 10⁻¹⁴ N");
  });

  test("the inertia-to-viscosity ratio is 5 × 10⁻⁷, so the slow-flow regime holds", () => {
    expect(roundsTo((1000 * 1e-6 * 5e-7) / 1e-3, 5e-7, 1)).toBe(true);
    expect(t).toContain("= 5 × 10⁻⁷");
  });
});

describe("thermal energy of a nitrogen molecule and of a grain at 293 K", () => {
  const t = text("temperature-thermal-energy");
  const kT = kB * 293;

  test("k_BT = 4.05 × 10⁻²¹ J, and the printed factor times 293 gives it too", () => {
    expect(roundsTo(kT, 4.05e-21, 3)).toBe(true);
    expect(roundsTo(1.381e-23 * 293, 4.05e-21, 3)).toBe(true);
    // Why the lesson prints 1.381 and not 1.38: a reader multiplying 1.38 × 293 gets 4.04.
    expect(roundsTo(1.38e-23 * 293, 4.05e-21, 3)).toBe(false);
    expect(t).toContain("1.381 × 10⁻²³ × 293 = 4.05 × 10⁻²¹ J");
  });

  test("half of it, 2.02 × 10⁻²¹ J, and about 295 m/s for nitrogen", () => {
    expect(roundsTo(kT / 2, 2.02e-21, 3)).toBe(true);
    expect(roundsTo(Math.sqrt(kT / 4.65e-26), 295, 3)).toBe(true);
    expect(t).toContain("2.02 × 10⁻²¹ J");
    expect(t).toContain("about 295 metres a second");
  });

  test("the grain: 6.3 × 10⁻¹⁶ kg, about 1.4 × 10¹⁰ times the molecule, about 2.5 mm/s, some 70 ns", () => {
    const grain = 1200 * (4 / 3) * Math.PI * 5e-7 ** 3;
    expect(roundsTo(grain, 6.3e-16, 2)).toBe(true);
    expect(roundsTo(grain / 4.65e-26, 1.4e10, 2)).toBe(true);
    expect(roundsTo(Math.sqrt(kT / grain), 2.5e-3, 2)).toBe(true);
    expect(roundsTo(grain * value(stokesMobility(1e-3, 5e-7)), 7e-8, 1)).toBe(true);
    expect(t).toContain("6.3 × 10⁻¹⁶ kg");
    expect(t).toContain("about 1.4 × 10¹⁰ times");
    expect(t).toContain("about 2.5 millimetres a second");
    expect(t).toContain("some 70 nanoseconds");
  });

  test("the modern set's k_B is the exact 1.380649 × 10⁻²³ J/K the lesson rounds", () => {
    expect(constantValue(modern, "boltzmannConstant").value).toBe(1.380649e-23);
  });
});
