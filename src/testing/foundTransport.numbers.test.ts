import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { constantValue, getConstantSet, thermalConstant } from "../physics/reference/constants.ts";
import { configurationVolumeTerm, stokesMobility } from "../physics/reference/diffusion/routeA.ts";
import { osmoticPressure } from "../physics/reference/diffusion.ts";
import {
  compareBitwise,
  roundsTo as printedRoundsTo,
  withinTolerance,
} from "../units/tolerance.ts";

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

/** Whether a value falls inside the printed number's rounding interval at the given figures. */
const roundsTo = (value: number, printed: number, figures: number) =>
  printedRoundsTo(value, printed, { significantFigures: figures }).ok;

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

describe("work, entropy counting and entropy with temperature", () => {
  test("½ × 3 × 2² = 6 J and ½ × 2 × 2² = 4 J, differing by 2 J", () => {
    const t = text("work-energy");
    expect(roundsTo(0.5 * 3 * 2 ** 2, 6, 1)).toBe(true);
    expect(roundsTo(0.5 * 2 * 2 ** 2, 4, 1)).toBe(true);
    expect(t).toContain("½ × 3 × 2² = 6 joules");
    expect(t).toContain("½ × 2 × 2² = 4 joules");
    expect(t).toContain("differ by 2 joules");
  });

  test("N ln ½ is about −4.2 × 10²³, and R ln ½ = 8.314 × (−0.693) is about −5.76 J/K", () => {
    const t = text("entropy-multiplicity");
    expect(roundsTo(6.02e23 * Math.log(0.5), -4.2e23, 2)).toBe(true);
    expect(roundsTo(Math.log(0.5), -0.693, 3)).toBe(true);
    expect(roundsTo(8.314 * Math.log(0.5), -5.76, 3)).toBe(true);
    // The printed rounding of ln ½ gives the same figure, so the line can be redone as printed.
    expect(roundsTo(8.314 * -0.693, -5.76, 3)).toBe(true);
    expect(t).toContain("about −4.2 × 10²³");
    expect(t).toContain("8.314 × (−0.693), about −5.76 joules per kelvin");
  });

  test("3 J into 300 K raises the entropy by 0.01 J/K, and into 150 K by twice that", () => {
    const t = text("entropy-temperature");
    expect(roundsTo(3 / 300, 0.01, 1)).toBe(true);
    expect(roundsTo(3 / 150, 0.02, 1)).toBe(true);
    expect(t).toContain("3 J ÷ 300 K = 0.01 joule per kelvin");
    expect(t).toContain("0.02 joule per kelvin, twice as much");
  });
});

describe("the test plan's fixed values, from the modern 2019 SI set at 293.15 K", () => {
  const T = 293.15;
  const R = constantValue(modern, "molarGasConstant").value;
  const N = constantValue(modern, "avogadroConstant").value;
  const at7 = (v: number, printed: number) =>
    printedRoundsTo(v, printed, { significantFigures: 7 }).ok;

  test("the mobility of a 0.5 μm sphere in water at 1 mPa·s is 1.061033 × 10⁸ m N⁻¹ s⁻¹", () => {
    expect(at7(value(stokesMobility(1e-3, 5e-7)), 1.061033e8)).toBe(true);
  });

  test("0.1 mol/L gives an osmotic pressure of 2.437385 × 10⁵ Pa, 2.406 atm", () => {
    const p = value(osmoticPressure({ n: 100 * N, T }, modern));
    expect(at7(p, 2.437385e5)).toBe(true);
    expect(printedRoundsTo(p / 101325, 2.406, { significantFigures: 4 }).ok).toBe(true);
  });

  test("k_BT = 4.047373 × 10⁻²¹ J and 3/2 k_BT = 6.071059 × 10⁻²¹ J, in the ratio 2/3 exactly", () => {
    const kT = kB * T;
    expect(at7(kT, 4.047373e-21)).toBe(true);
    expect(at7(1.5 * kT, 6.071059e-21)).toBe(true);
    expect(compareBitwise(kT / (1.5 * kT), 2 / 3).ok).toBe(true);
  });

  test("1 eV is 1.602177 × 10⁻¹⁹ J", () => {
    expect(at7(constantValue(modern, "elementaryCharge").value, 1.602177e-19)).toBe(true);
  });

  // The configuration term of the free energy, −kT·n·ln(V/V₀), and the pressure the owner reports.
  const volumeTerm = (V: number, V0: number) => {
    const r = configurationVolumeTerm({ Np: 1_000_000, V, V0, T }, modern);
    if (!("deltaF" in r)) throw new TypeError(r.result.status);
    return r;
  };

  test("light §5's footnote: the volume law's slope is a pressure with pv = R(n/N)T", () => {
    // A numerical derivative at three volumes, not a symbolic one: the repository has no symbolic
    // differentiator. It still fails if the owner's pressure and free energy disagree.
    const n = 1_000_000;
    for (const v of [1e-6, 1e-3, 2.5]) {
      const h = v * 1e-5;
      const slope =
        -(value(volumeTerm(v + h, v).deltaF) - value(volumeTerm(v - h, v).deltaF)) / (2 * h);
      expect(withinTolerance(slope, value(volumeTerm(v, v).pressure), { relative: 1e-6 }).ok).toBe(
        true,
      );
      expect(withinTolerance(slope * v, R * (n / N) * T, { relative: 1e-6 }).ok).toBe(true);
    }
  });

  test("doubling the volume raises the entropy by n k_B ln 2", () => {
    const n = 1_000_000;
    const gained = -value(volumeTerm(2, 1).deltaF) / T;
    expect(withinTolerance(gained, n * kB * Math.LN2, { relative: 1e-12 }).ok).toBe(true);
    // Halving it lowers the entropy by the same amount, the entropy-multiplicity lesson's R ln ½ per mole.
    const lost = -value(volumeTerm(1, 2).deltaF) / T;
    expect(withinTolerance(lost, -n * kB * Math.LN2, { relative: 1e-12 }).ok).toBe(true);
  });
});
