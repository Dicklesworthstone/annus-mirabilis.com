import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDeclaredConstantSet } from "../physics/reference/constants.ts";
import { stokesEinsteinD } from "../physics/reference/diffusion.ts";
import { inferMolecularDimensions } from "../physics/reference/molecularDimensions.ts";
import { withinTolerance } from "../units/tolerance.ts";

/**
 * am-found-statistics-inference-pzqv: the lesson two-measurements-two-unknowns prints formulas
 * rather than worked numbers, so this checks each formula it prints against the owners, at one
 * declared sphere and solution, and finds the formula in the lesson's text. D comes from
 * stokesEinsteinD; the inversion from inferMolecularDimensions, the owner the lesson's instrument
 * uses. foundTwoMeasurements.records.test.ts checks the record's shape and reads no formula.
 */

const text = (() => {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) for (const x of v) walk(x);
    else if (v && typeof v === "object") for (const x of Object.values(v)) walk(x);
  };
  walk(
    JSON.parse(
      readFileSync(
        join(process.cwd(), "content/foundations", "two-measurements-two-unknowns.json"),
        "utf8",
      ),
    ),
  );
  return out.join(" ");
})();
const close = (actual: number, reference: number) =>
  withinTolerance(actual, reference, { relative: 1e-9 }).ok;
const value = (r: { status: string; value?: unknown }): number => {
  expect(r.status).toBe("value");
  return r.value as number;
};

/** One sphere and one dilute solution, declared here; nothing below reads them back from a fit. */
const R = 8.31446261815324;
const T = 293;
const eta = 1.0e-3;
const a = 5e-10;
const N = 6e23;
/** Moles dissolved per cubic metre: 0.01 gram-molecule per litre. */
const n = 10;
const phi = (4 / 3) * Math.PI * a ** 3 * N * n;

const declared = (id: string, avogadro: number, decimal: string) =>
  createDeclaredConstantSet({
    id,
    era: 2026,
    provenance: "Declared inputs for the two-measurements lesson's formula checks.",
    precisionNote: "Formula identities at one declared point; not a measurement.",
    gasConstantProvenance: "not-applicable",
    entries: [
      {
        quantityId: "molarGasConstant",
        value: R,
        exactDecimal: "8.31446261815324",
        unit: "J/(mol K)",
        kind: "declared-scenario",
        evidentialRole: "declared-input",
        provenance: "The 2019 SI value, declared as an input.",
        dependsOn: [],
      },
      {
        quantityId: "avogadroConstant",
        value: avogadro,
        exactDecimal: decimal,
        unit: "1/mol",
        kind: "declared-scenario",
        evidentialRole: "declared-input",
        provenance: "A declared molecular number for the lesson's curve of (a, N) pairs.",
        dependsOn: [],
      },
    ],
  });
const setN = declared("scenario-two-measurements-n-6e23", N, "6e23");
const setHalfN = declared("scenario-two-measurements-n-3e23", N / 2, "3e23");
const D = value(stokesEinsteinD({ T, eta, a }, setN).result);

const infer = (specificViscosity: number, viscosityCoefficient: 1 | 2.5, molarConcentration = n) =>
  inferMolecularDimensions({
    temperature: T,
    viscosity: eta,
    diffusion: D,
    molarConcentration,
    specificViscosity,
    gasConstant: R,
    viscosityCoefficient,
  });

describe("a measured D fixes the product aN, not a and N", () => {
  test("D = (RT/N) · 1/(6πηa), as printed, is what the Stokes-Einstein owner gives", () => {
    expect(close(D, ((R * T) / N) * (1 / (6 * Math.PI * eta * a)))).toBe(true);
    expect(text).toContain("D = \\frac{RT}{N}\\cdot\\frac{1}{6\\pi\\eta a}");
    expect(text).toContain(
      "a measured D fixes one combination of the two unknowns, the product of the molecular number N and the radius a",
    );
  });

  test("double a and halve N: D is exactly what it was; double a alone and it is not", () => {
    // pzqv: "to within 10⁻¹² relative, computed through am-ref-diffusion-lr3 and compared with
    // withinTolerance".
    const invariant = withinTolerance(
      value(stokesEinsteinD({ T, eta, a: 2 * a }, setHalfN).result),
      D,
      { relative: 1e-12 },
    );
    expect(invariant.ok).toBe(true);
    expect(close(value(stokesEinsteinD({ T, eta, a: 2 * a }, setN).result), D)).toBe(false);
    expect(text).toContain(
      "Double a and halve N, and \\(6\\pi\\eta a N\\), and with it D, is exactly what it was. The answer is a curve, not a number.",
    );
  });

  test("Na = RT/(6πηD); from D alone the owner returns that product and leaves a and N open", () => {
    expect(close((R * T) / (6 * Math.PI * eta * D), a * N)).toBe(true);
    const alone = infer(0, 2.5, 0);
    expect(alone.radius.status).toBe("underdetermined");
    expect(alone.molecularNumber.status).toBe("underdetermined");
    expect(close(value(alone.radiusTimesMolecularNumber), a * N)).toBe(true);
    expect(text).toContain("N a = \\frac{RT}{6\\pi\\eta D}");
  });
});

describe("the viscosity fixes a³N, and the crossing fixes a", () => {
  test("φ = (4/3)πa³Nn, and a³N = 3(η*/η − 1)/(4πcn) for c = 1 and c = 5/2", () => {
    for (const c of [1, 2.5] as const) {
      // The dilute law: η*/η = 1 + cφ.
      const increment = c * phi;
      expect(close((3 * increment) / (4 * Math.PI * c * n), a ** 3 * N)).toBe(true);
    }
    expect(text).toContain("\\(\\varphi = \\frac{4}{3}\\pi a^3 N n\\)");
    expect(text).toContain("a^3 N = \\frac{3(\\eta^*/\\eta - 1)}{4\\pi c\\, n}");
  });

  test("the printed a² agrees with the owner's radius, and either relation then gives N", () => {
    for (const c of [1, 2.5] as const) {
      const increment = c * phi;
      const printedA2 =
        ((3 * increment) / (4 * Math.PI * c * n)) * ((6 * Math.PI * eta * D) / (R * T));
      const snapshot = infer(increment, c);
      const radius = value(snapshot.radius);
      expect(close(printedA2, radius ** 2)).toBe(true);
      expect(close(radius, a)).toBe(true);
      expect(close(value(snapshot.molecularNumber), N)).toBe(true);
      expect(close((R * T) / (6 * Math.PI * eta * D) / radius, N)).toBe(true);
      expect(close((3 * increment) / (4 * Math.PI * c * n) / radius ** 3, N)).toBe(true);
    }
    expect(text).toContain(
      "a^2 = \\frac{3(\\eta^*/\\eta - 1)}{4\\pi c\\, n}\\cdot\\frac{6\\pi\\eta D}{RT}",
    );
    expect(text).toContain(
      "Dividing the second combination by the first leaves \\(a^2\\) alone, so the crossing gives the radius, and then either relation gives N.",
    );
  });

  test("c is 1 as printed in 1906 and 5/2 after 1911: the choice moves a by √(5/2), and no other is admitted", () => {
    const increment = 2.5 * phi;
    const corrected = value(infer(increment, 2.5).radius);
    const original = value(infer(increment, 1).radius);
    expect(close(original / corrected, Math.sqrt(2.5))).toBe(true);
    const other = infer(increment, 2 as unknown as 1);
    expect(other.radius.status).toBe("outside-domain");
    expect(text).toContain(
      "1 as the dissertation printed it in 1906, and 5/2 after Einstein's correction of 1911",
    );
  });
});
