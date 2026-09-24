import { describe, expect, test } from "bun:test";
import { roundsTo, withinTolerance } from "../units/tolerance.ts";
import { EINSTEIN_ONE_SECOND } from "./brownian/numericExercises.ts";
import { GREATEST_ELECTRON_ENERGY } from "./lightQuanta/numericExercises.ts";
import { SEALED_LAMP_YEAR } from "./massEnergy/numericExercises.ts";
import { MOVING_ROD } from "./relativity/numericExercises.ts";

/**
 * am-disc-exercise-checker-i4h2: each journey's numeric exercise shows a worked explanation, and
 * its numbers are typed into prose. The part's tests check the reference value through the
 * owners; this checks the prose: every line is redone from the factors it prints, found in the
 * explanation, and its final value agrees with the part's own reference. Checked by hand on live
 * 2026-09-24 first; all were right, and nothing held them there.
 */

/** The prose sets no-break and narrow no-break spaces around its operators; compare as spaces. */
const spaced = (text: string) => text.replace(/[\u00a0\u202f\u2009]/g, " ");

/** A figure as printed; its significant figures are counted from the string. */
const printedAs = (value: number, shown: string) =>
  roundsTo(value, Number(shown), {
    significantFigures: shown
      .replace(/^[-−]?[0.]*/, "")
      .replace(/e.*$/, "")
      .replace(".", "").length,
  }).ok;

describe("Brownian §5: Einstein's one-second displacement", () => {
  const text = spaced(EINSTEIN_ONE_SECOND.workedExplanation);

  test("D = (8.31 × 290.15)/(6 × 10²³ × 6π × 1.35 × 10⁻³ × 5 × 10⁻⁷) ≈ 3.16 × 10⁻¹³ m²/s", () => {
    const D = (8.31 * 290.15) / (6e23 * 6 * Math.PI * 1.35e-3 * 5e-7);
    expect(printedAs(D, "3.16e-13")).toBe(true);
    expect(text).toContain(
      "D = (8.31 × 290.15)/(6 × 10²³ × 6π × 1.35 × 10⁻³ × 5 × 10⁻⁷), about 3.16 × 10⁻¹³ m²/s",
    );
    expect(text).toContain("a radius of 0.5 μm, which is 5 × 10⁻⁷ m");
  });

  test("√(2 × 3.16 × 10⁻¹³ × 1) m ≈ 7.95 × 10⁻⁷ m = 0.795 μm, which Einstein printed as 0.8", () => {
    const lambda = Math.sqrt(2 * 3.16e-13 * 1);
    expect(printedAs(lambda, "7.95e-7")).toBe(true);
    expect(printedAs(lambda * 1e6, "0.795")).toBe(true);
    expect(printedAs(lambda * 1e6, "0.8")).toBe(true);
    expect(text).toContain("√(2 × 3.16 × 10⁻¹³ × 1) m, about 7.95 × 10⁻⁷ m, or 0.795 μm");
    // The prose's final value is the part's reference, within the part's own tolerance.
    const { reference, tolerance } = EINSTEIN_ONE_SECOND;
    expect(withinTolerance(lambda, reference.value, tolerance).ok).toBe(true);
  });
});

describe("Light quanta §8: the greatest electron energy at 600 THz and 2 eV", () => {
  const text = spaced(GREATEST_ELECTRON_ENERGY.workedExplanation);
  const eV = 1.602176634e-19;

  test("hν ≈ 3.976 × 10⁻¹⁹ J = 2.481 eV, and 2.481 − 2 = 0.481 eV ≈ 7.71 × 10⁻²⁰ J", () => {
    const hv = 6.62607015e-34 * 6e14;
    expect(printedAs(hv, "3.976e-19")).toBe(true);
    expect(printedAs(hv / eV, "2.481")).toBe(true);
    expect(printedAs(2.481 - 2, "0.481")).toBe(true);
    expect(printedAs(0.481 * eV, "7.71e-20")).toBe(true);
    expect(text).toContain(
      "hν = 6.62607015 × 10⁻³⁴ J·s × 6 × 10¹⁴ s⁻¹, about 3.976 × 10⁻¹⁹ J, which is 2.481 eV",
    );
    expect(text).toContain("2.481 − 2 = 0.481 eV, or 7.71 × 10⁻²⁰ J");
    const { reference, tolerance } = GREATEST_ELECTRON_ENERGY;
    expect(withinTolerance(0.481 * eV, reference.value, tolerance).ok).toBe(true);
  });
});

describe("Relativity §4: a 1 m rod at 0.6c", () => {
  const text = spaced(MOVING_ROD.workedExplanation);

  test("v²/c² = 0.36, √0.64 = 0.8, and the rod measures 0.8 m, 80 cm", () => {
    expect(0.6 ** 2).toBeCloseTo(0.36, 12);
    expect(Math.sqrt(1 - 0.36)).toBeCloseTo(0.8, 12);
    expect(text).toContain("v²/c² = 0.36, and √(1 − 0.36) = √0.64 = 0.8");
    expect(text).toContain("0.8 × 1 m = 0.8 m, or 80 cm");
    const { reference, tolerance } = MOVING_ROD;
    expect(withinTolerance(0.8, reference.value, tolerance).ok).toBe(true);
  });
});

describe("Mass and energy: a 100 W lamp sealed for a year", () => {
  const text = spaced(SEALED_LAMP_YEAR.workedExplanation);

  test("100 W × 3.156 × 10⁷ s = 3.156 × 10⁹ J; c² ≈ 8.988 × 10¹⁶; the mass falls about 3.51 × 10⁻⁸ kg", () => {
    expect(printedAs(100 * 3.156e7, "3.156e9")).toBe(true);
    expect(printedAs(299792458 ** 2, "8.988e16")).toBe(true);
    const drop = 3.156e9 / 8.988e16;
    expect(printedAs(drop, "3.51e-8")).toBe(true);
    // "some 35 micrograms": 3.51 × 10⁻⁸ kg is 35.1 μg.
    expect(printedAs(drop * 1e9, "35")).toBe(true);
    expect(text).toContain("100 W × 3.156 × 10⁷ s = 3.156 × 10⁹ J");
    expect(text).toContain("its square is about 8.988 × 10¹⁶ m²/s²");
    expect(text).toContain("3.156 × 10⁹ / 8.988 × 10¹⁶, about 3.51 × 10⁻⁸ kg: some 35 micrograms");
    const { reference, tolerance } = SEALED_LAMP_YEAR;
    expect(withinTolerance(drop, reference.value, tolerance).ok).toBe(true);
  });
});
