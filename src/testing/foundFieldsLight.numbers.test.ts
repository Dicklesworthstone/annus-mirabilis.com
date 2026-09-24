import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { constantValue, getConstantSet } from "../physics/reference/constants.ts";
import { roundsTo } from "../units/tolerance.ts";

/**
 * am-found-fields-light-cv3o: every number the four lessons PRINT, recomputed from the inputs they
 * print, and found in the lesson's own text. foundFieldsLight.test.ts checks the bead's test-plan
 * values against literals typed into that test; this one reads the lessons, so a reader who redoes a
 * line of a worked example gets the lesson's own answer.
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
const printed = (value: number, shown: number, figures: number) =>
  roundsTo(value, shown, { significantFigures: figures }).ok;
const modern = getConstantSet("modern-si-2019");
/** The electron's mass is measured, so it is in the CODATA set, not the exact 2019 SI one. */
const codata = getConstantSet("modern-codata-2022");

describe("frames and events: setting a distant clock with one light signal", () => {
  const t = text("frames-events");

  test("sent at 0 s, back at 10 s: reflected at 5 s on A's time; a clock reading 7 s is 2 s fast", () => {
    expect((0 + 10) / 2).toBe(5);
    expect(7 - 5).toBe(2);
    expect(t).toContain("the reflection happened at 5 s on A's time");
    expect(t).toContain("If it read 7 s, it is 2 s fast");
  });

  test("2 × 1.5 × 10⁹ m in 10 s is 3 × 10⁸ m/s", () => {
    expect(printed((2 * 1.5e9) / 10, 3e8, 1)).toBe(true);
    expect(t).toContain("2 × 1.5 × 10⁹ m divided by 10 s is 3 × 10⁸ metres per second");
  });
});

describe("fields and waves: a 600-terahertz wave and a one-watt lamp", () => {
  const t = text("fields-waves");
  const c = constantValue(modern, "speedOfLight").value;

  test("λ = 299 792 458 ÷ 6.0 × 10¹⁴ = 4.997 × 10⁻⁷ m, 499.7 nm", () => {
    expect(c).toBe(299792458);
    expect(printed(c / 6.0e14, 4.997e-7, 4)).toBe(true);
    expect(printed((c / 6.0e14) * 1e9, 499.7, 4)).toBe(true);
    expect(t).toContain("299 792 458 ÷ 6.0 × 10¹⁴ = 4.997 × 10⁻⁷ m, which is 499.7 nanometres");
  });

  test("4π × 1² = 12.57 m² and 1 ÷ 12.57 = 0.0796 W/m²; at 2 m, 50.27 m² and 0.0199, a quarter", () => {
    expect(printed(4 * Math.PI, 12.57, 4)).toBe(true);
    expect(printed(1 / 12.57, 0.0796, 3)).toBe(true);
    expect(printed(4 * Math.PI * 4, 50.27, 4)).toBe(true);
    expect(printed(1 / 50.27, 0.0199, 3)).toBe(true);
    expect(printed(0.0199 / 0.0796, 0.25, 2)).toBe(true);
    expect(t).toContain("4π × 1² = 12.57 m², so the intensity is 1 ÷ 12.57 = 0.0796 W/m²");
    expect(t).toContain("4π × 2² = 50.27 m², so the intensity is 0.0199 W/m², a quarter");
  });
});

describe("electromagnetism: an electron across one volt", () => {
  const t = text("electromagnetism-charges");

  test("e × 1 V = 1.602 × 10⁻¹⁹ J, and the charge and mass printed are the modern values", () => {
    expect(printed(constantValue(modern, "elementaryCharge").value, 1.602e-19, 4)).toBe(true);
    expect(printed(constantValue(codata, "electronMass").value, 9.109e-31, 4)).toBe(true);
    expect(t).toContain("e × 1 V = 1.602 × 10⁻¹⁹ joules");
    expect(t).toContain("m = 9.109 × 10⁻³¹ kg");
  });

  test("v² = 2 × 1.602 × 10⁻¹⁹ ÷ 9.109 × 10⁻³¹ = 3.52 × 10¹¹; v ≈ 5.93 × 10⁵ m/s, 0.2 per cent of c", () => {
    const v2 = (2 * 1.602e-19) / 9.109e-31;
    expect(printed(v2, 3.52e11, 3)).toBe(true);
    expect(printed(Math.sqrt(v2), 5.93e5, 3)).toBe(true);
    expect(printed((100 * Math.sqrt(v2)) / 299792458, 0.2, 1)).toBe(true);
    expect(t).toContain("v² = 2 × 1.602 × 10⁻¹⁹ ÷ 9.109 × 10⁻³¹ = 3.52 × 10¹¹ m²/s²");
    expect(t).toContain("v ≈ 5.93 × 10⁵ m/s, about 600 kilometres per second");
    expect(t).toContain("only 0.2 per cent of the speed of light");
  });
});

describe("momentum and light: the push of a one-watt beam", () => {
  const t = text("momentum-energy-light");

  test("1 ÷ 299 792 458 is about 3.34 × 10⁻⁹; a mirror takes twice that, about 6.67 × 10⁻⁹ N", () => {
    expect(printed(1 / 299792458, 3.34e-9, 3)).toBe(true);
    expect(printed(2 / 299792458, 6.67e-9, 3)).toBe(true);
    expect(t).toContain("1 ÷ 299 792 458, about 3.34 × 10⁻⁹");
    expect(t).toContain("about 6.67 × 10⁻⁹ newtons");
  });

  test("3.34 × 10⁻⁹ N is the weight of about a third of a microgram", () => {
    const micrograms = (3.34e-9 / 9.81) * 1e9;
    expect(printed(micrograms, 0.3, 1)).toBe(true);
    expect(t).toContain("about the weight of a third of a microgram");
  });

  test("first measured in 1901, nearly thirty years after the Treatise of 1873", () => {
    expect(1901 - 1873).toBe(28);
    expect(t).toContain("first measured in 1901, nearly thirty years after Maxwell predicted it");
  });
});
