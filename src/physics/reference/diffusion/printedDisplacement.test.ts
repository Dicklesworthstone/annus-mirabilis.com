/**
 * THE PRINTED 0,8 MIKRON, AND THE TWO WAYS A PLAUSIBLE WRONG READING OF PAGE 559 FAILS.
 *
 * The inputs are the ones the plate states, read from the pinned facsimile's page image on
 * 2026-10-08 (`pdftoppm -f 11` on ap-17-549.pdf renders printed page 559; the embedded text layer
 * is forbidden and was not used): N = 6.10^23, water at 17 degrees C, k = 1,35.10^-2 where k is the
 * VISCOSITY, and a particle DIAMETER of 0,001 mm. The paper prints lambda_x = 8.10^-5 cm = 0,8
 * Mikron for one second and "ca. 6 Mikron" for one minute.
 *
 * The figures asserted here are the ones am-bm-results-cards-ft8k pins in its test plan, to within
 * the 1e-4 relative tolerance it states.
 *
 * TWO ADVERSARIAL FIXTURES, both named in AGENTS.md, both of which must fail for the stated reason
 * rather than merely fail:
 *
 *   - "a 1 micron radius reproduces Einstein's 0.8 micron". It does not, and this is the live trap
 *     on this page: 0,001 mm is a diameter, so the radius is 5e-7 m. Reading it as a radius halves
 *     the diffusion coefficient and the displacement comes out a factor sqrt(2) small.
 *   - "halving diffusivity halves displacement". It does not; the length goes as the square root,
 *     so halving D multiplies the displacement by 1/sqrt(2). The comparison wording must not imply
 *     otherwise, and the assertion below pins the exponent rather than the sentence.
 */

import { describe, expect, test } from "bun:test";
import { withinTolerance } from "../../../units/tolerance.ts";
import {
  BROWNIAN_PRINTED_DISPLACEMENT_SCENARIO,
  printedBrownianDisplacement,
} from "./printedDisplacement.ts";

/** Exactly what page 559 states, with the diameter already halved. */
const PLATE = {
  temperatureK: 290.15,
  viscosityPaS: 0.00135,
  particleRadiusM: 5e-7,
  elapsedSeconds: 1,
} as const;

const microns = (m: number) => m * 1e6;

/**
 * Comparison goes through src/units/tolerance.ts, which AGENTS.md names as the one shared module
 * for it. This file first carried `Math.abs(a - b) / Math.abs(b)` and the tolerance ratchet caught
 * it at a baseline of 0, correctly: a second relative comparison is the debt that ratchet exists to
 * record, and raising the baseline to admit one would be drawing on a budget rather than paying it.
 * Returning the verdict's `kind` rather than a boolean means a failure reads "expected within,
 * received outside" instead of "expected true, received false".
 */
const atRelative = (actual: number, reference: number, relative: number): string =>
  withinTolerance(actual, reference, { relative }).kind;

describe("the owner reproduces what Einstein printed", () => {
  test("one second, under his constants and under the modern thermal constant", () => {
    const r = printedBrownianDisplacement(PLATE);
    expect(r.status).toBe("value");
    expect(r.scenarioId).toBe(BROWNIAN_PRINTED_DISPLACEMENT_SCENARIO);
    console.log(
      `[census] printed displacement t=1s: printed ${microns(r.printed.value).toFixed(7)} um, ` +
        `modern ${microns(r.modern.value).toFixed(7)} um`,
    );
    expect(atRelative(microns(r.printed.value), 0.7948, 1e-4)).toBe("within");
    expect(atRelative(microns(r.modern.value), 0.7935, 1e-4)).toBe("within");
    // And it rounds to what the plate prints, at the one significant figure the plate gives.
    expect(Number(microns(r.printed.value).toPrecision(1))).toBe(0.8);
  });

  test("one minute, which the paper states as about 6 Mikron", () => {
    const r = printedBrownianDisplacement({ ...PLATE, elapsedSeconds: 60 });
    expect(atRelative(microns(r.printed.value), 6.1564, 1e-4)).toBe("within");
    expect(atRelative(microns(r.modern.value), 6.1467, 1e-4)).toBe("within");
    // The plate says "ca. 6", one significant figure, and 6.156 does round there.
    expect(Number(microns(r.printed.value).toPrecision(1))).toBe(6);
  });

  test("the two rows name their constant sets and never merge into one number", () => {
    const r = printedBrownianDisplacement(PLATE);
    expect(r.printed.constantSetId).toBe("einstein-1905-brownian-printed");
    expect(r.modern.constantSetId).toBe("modern-si-2019");
    expect(r.printed.entryLabels.length).toBeGreaterThan(0);
    expect(r.modern.entryLabels.length).toBeGreaterThan(0);
    // The wording is the owner's and carries no percentage: a view must not compute one either.
    expect(r.comparison.wording).not.toMatch(/%|per ?cent/i);
    expect(r.comparison.wording.length).toBeGreaterThan(80);
    expect(r.comparison.ratio).toBeLessThan(1);
    expect(r.comparison.ratio).toBeGreaterThan(0.99);
  });
});

describe("the modern-viscosity row, which is a different question from the thermal constant", () => {
  /** What content/scenarios/diffusion-modern-viscosity-17c.yaml records, from IAPWS-2008 via NIST. */
  const IAPWS = { valuePaS: 0.0010798059, sourceLabel: "iapws-2008-water-viscosity" } as const;

  test("it is absent unless the caller supplies a viscosity, never invented", () => {
    expect(printedBrownianDisplacement(PLATE).modernViscosity).toBeUndefined();
  });

  test("with the modern reference viscosity the displacement rises to about 0.887 micron", () => {
    const r = printedBrownianDisplacement({ ...PLATE, modernViscosity: IAPWS });
    expect(r.modernViscosity).toBeDefined();
    const v = microns(r.modernViscosity?.value ?? Number.NaN);
    console.log(`[census] modern-viscosity row: ${v.toFixed(7)} um`);
    expect(Number(v.toPrecision(3))).toBe(0.887);
    // It must move the length FURTHER than the thermal constant does, which is the reason it is a
    // separate labelled row rather than folded into the modern-constant one.
    const dThermal = Math.abs(r.modern.value - r.printed.value);
    const dFluid = Math.abs((r.modernViscosity?.value ?? 0) - r.printed.value);
    expect(dFluid).toBeGreaterThan(dThermal * 10);
  });

  test("THE EXPONENT: a viscosity ratio of about 1.25 gives a displacement ratio of about 1.118", () => {
    // The scenario's own point, and the adversarial claim it exists to refuse: the displacement
    // does NOT follow the viscosity ratio, nor its reciprocal. It follows the square root.
    const r = printedBrownianDisplacement({ ...PLATE, modernViscosity: IAPWS });
    const viscosityRatio = PLATE.viscosityPaS / IAPWS.valuePaS;
    const lengthRatio = (r.modernViscosity?.value ?? Number.NaN) / r.modern.value;
    expect(atRelative(viscosityRatio, 1.2502247, 1e-6)).toBe("within");
    expect(atRelative(lengthRatio, Math.sqrt(viscosityRatio), 1e-12)).toBe("within");
    expect(atRelative(lengthRatio, 1.1181345, 1e-6)).toBe("within");
    // And it is neither the ratio nor its reciprocal, stated so the failure is unmistakable.
    expect(atRelative(lengthRatio, viscosityRatio, 0.1)).toBe("outside");
    expect(atRelative(lengthRatio, 1 / viscosityRatio, 0.1)).toBe("outside");
  });

  test("the comparison names the fluid datum as the dated thing, not the arithmetic", () => {
    const r = printedBrownianDisplacement({ ...PLATE, modernViscosity: IAPWS });
    expect(r.comparison.wording).toContain("square root");
    expect(r.comparison.wording).not.toMatch(/%|per ?cent high\b.*arithmetic/i);
    // The two wordings differ, so the third row cannot appear under a sentence that ignores it.
    expect(r.comparison.wording).not.toBe(printedBrownianDisplacement(PLATE).comparison.wording);
  });
});

describe("ADVERSARIAL: the plausible wrong readings of page 559", () => {
  test("a 1 micron RADIUS does not reproduce the printed 0,8 micron", () => {
    // The printed 0,001 mm is a diameter. Taking it for a radius is the mistake this fixture
    // exists to catch, and it must be wrong by the specific factor rather than merely wrong.
    const wrong = printedBrownianDisplacement({ ...PLATE, particleRadiusM: 1e-6 });
    const right = printedBrownianDisplacement(PLATE);
    expect(Number(microns(wrong.printed.value).toPrecision(1))).not.toBe(0.8);
    // D goes as 1/a, so doubling the radius halves D and divides the length by sqrt(2).
    expect(atRelative(right.printed.value / wrong.printed.value, Math.SQRT2, 1e-12)).toBe("within");
    console.log(
      `[census] radius-as-diameter plant: ${microns(wrong.printed.value).toFixed(7)} um ` +
        `against the printed 0.7947833`,
    );
  });

  test("halving the diffusivity does NOT halve the displacement", () => {
    // Pinned on the exponent, not on the owner's sentence, so a reworded comparison cannot make
    // this pass. Halving D is the same as doubling the radius here, since D goes as 1/a.
    const base = printedBrownianDisplacement(PLATE);
    const halvedD = printedBrownianDisplacement({ ...PLATE, particleRadiusM: 1e-6 });
    const ratio = halvedD.printed.value / base.printed.value;
    expect(atRelative(ratio, 1 / Math.SQRT2, 1e-12)).toBe("within");
    // The claim under test, stated so its failure is unmistakable.
    expect(atRelative(ratio, 0.5, 0.4)).toBe("outside");
  });

  test("a nonpositive input is a typed refusal, never a zero displacement", () => {
    for (const bad of [
      { ...PLATE, temperatureK: 0 },
      { ...PLATE, viscosityPaS: -1 },
      { ...PLATE, particleRadiusM: 0 },
      { ...PLATE, elapsedSeconds: -1 },
    ]) {
      const r = printedBrownianDisplacement(bad);
      expect(r.status).toBe("outside-domain");
      expect(r.condition).toContain("T > 0");
      expect(Number.isNaN(r.printed.value)).toBe(true);
      // Never a zero wearing the look of a measurement.
      expect(r.printed.value).not.toBe(0);
    }
  });

  test("zero elapsed time is a legitimate zero, not a refusal", () => {
    // The boundary the refusal above must not swallow: at t = 0 the displacement really is zero.
    const r = printedBrownianDisplacement({ ...PLATE, elapsedSeconds: 0 });
    expect(r.status).toBe("value");
    expect(r.printed.value).toBe(0);
  });
});
