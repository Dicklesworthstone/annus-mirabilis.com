import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { load } from "js-yaml";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FORMULA_DISPLAY,
  UnitCancellationTable,
} from "../components/foundations/UnitCancellationTable.tsx";
import {
  BASE_UNITS,
  CANCELLATION_FORMULAS,
  type CancellationFormula,
  checkFormula,
  combine,
  type Dimensions,
} from "../foundations/unitCancellation.ts";

/**
 * The unit-cancellation table of foundation:quantities-units (am-found-quantities-magnitudes-igxe).
 * Its factors' units are checked against the site's own quantity registry, not against themselves,
 * and its two wrong formulas must be caught for the reason each one states.
 */

/** Every quantity's dimension from content/quantities, basis [length, mass, time, temperature, current, amount]. */
const registry = (() => {
  const dir = new URL("../../content/quantities/", import.meta.url);
  const byId = new Map<string, readonly number[]>();
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".yaml"))) {
    const parsed = load(readFileSync(new URL(name, dir), "utf8"));
    const items = Array.isArray(parsed) ? parsed : [];
    for (const q of items as { id?: string; dimension?: number[] }[]) {
      if (q.id && Array.isArray(q.dimension)) byId.set(q.id, q.dimension);
    }
  }
  return byId;
})();

const fromRegistry = (id: string, power = 1): Dimensions => {
  const d = registry.get(id);
  expect(d, `quantity ${id} in content/quantities`).toBeDefined();
  const [length = 0, mass = 0, time = 0, temperature = 0, current = 0, amount = 0] = d ?? [];
  expect([current, amount]).toEqual([0, 0]);
  return { kg: mass * power, m: length * power, s: time * power, K: temperature * power };
};

const formula = (id: string): CancellationFormula => {
  const found = CANCELLATION_FORMULAS.find((f) => f.id === id);
  expect(found).toBeDefined();
  return found as CancellationFormula;
};

const same = (a: Dimensions, b: Dimensions) =>
  expect(BASE_UNITS.map((u) => a[u] + 0)).toEqual(BASE_UNITS.map((u) => b[u] + 0));

/** Which registry quantity each factor symbol is, so its units are checked independently. */
const FACTOR_QUANTITY: Readonly<Record<string, readonly [string, number]>> = {
  k: ["boltzmannConstant", 1],
  T: ["temperature", 1],
  η: ["viscosity", 1],
  a: ["particleRadius", 1],
  D: ["diffusionCoefficient", 1],
  t: ["elapsedTime", 1],
  h: ["planckConstant", 1],
  ν: ["frequency", 1],
  L: ["emittedEnergyRestFrame", 1],
  "V²": ["speedOfLight", 2],
};

const EXPECTED_QUANTITY: Readonly<Record<string, string>> = {
  diffusivity: "diffusionCoefficient",
  "diffusivity-no-radius": "diffusionCoefficient",
  spread: "rmsDisplacement1d",
  "spread-no-root": "rmsDisplacement1d",
  quantum: "emittedEnergyRestFrame",
  "mass-energy": "inertialMassDecrease",
};

describe("the factors' units agree with the quantity registry", () => {
  test("every factor with units is the registry's quantity, and every pure number has none", () => {
    let checked = 0;
    for (const f of CANCELLATION_FORMULAS) {
      for (const factor of f.factors) {
        if (factor.placement === "number") {
          same(factor.dimensions, { kg: 0, m: 0, s: 0, K: 0 });
          continue;
        }
        const entry = FACTOR_QUANTITY[factor.symbol];
        expect(entry, `a registry quantity for ${factor.symbol}`).toBeDefined();
        const [id, power] = entry ?? ["", 1];
        same(factor.dimensions, fromRegistry(id, power));
        checked += 1;
      }
    }
    // Non-vacuity: the loop above must have compared real factors, not skipped them all.
    expect(checked).toBeGreaterThan(10);
  });

  test("every formula's expected units are the registry's for that quantity", () => {
    for (const f of CANCELLATION_FORMULAS) {
      const id = EXPECTED_QUANTITY[f.id];
      expect(id, `an expected quantity for ${f.id}`).toBeDefined();
      same(f.expected, fromRegistry(id ?? ""));
    }
  });
});

describe("the check", () => {
  test("the right formulas agree and the wrong ones do not; a fault is given exactly when they do not", () => {
    const verdicts = CANCELLATION_FORMULAS.map((f) => [f.id, checkFormula(f).agrees] as const);
    expect(verdicts.filter(([, agrees]) => agrees).length).toBeGreaterThan(0);
    expect(verdicts.filter(([, agrees]) => !agrees).length).toBeGreaterThan(0);
    for (const f of CANCELLATION_FORMULAS) {
      expect(checkFormula(f).agrees).toBe(f.fault === undefined);
    }
  });

  test("D comes out in m²/s; without the radius, m³/s", () => {
    same(checkFormula(formula("diffusivity")).result, { kg: 0, m: 2, s: -1, K: 0 });
    same(checkFormula(formula("diffusivity-no-radius")).result, { kg: 0, m: 3, s: -1, K: 0 });
  });

  test("the root halves the powers: √(2Dt) is a length, and 2Dt an area", () => {
    same(checkFormula(formula("spread")).result, { kg: 0, m: 1, s: 0, K: 0 });
    same(checkFormula(formula("spread-no-root")).result, { kg: 0, m: 2, s: 0, K: 0 });
  });

  test("every result's powers are whole numbers, so the page never has to draw a half", () => {
    for (const f of CANCELLATION_FORMULAS) {
      const r = combine(f.factors);
      for (const unit of BASE_UNITS) expect(Number.isInteger(r[unit])).toBe(true);
    }
  });
});

describe("the construction as served", () => {
  test("every formula has a drawn form", () => {
    for (const f of CANCELLATION_FORMULAS) expect(FORMULA_DISPLAY[f.id]).toBeDefined();
  });

  test("its first render, before any script runs, checks D and finds the units agree", () => {
    const html = renderToStaticMarkup(<UnitCancellationTable />);
    const text = html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");
    expect(html).toContain('data-foundation-construction="quantities-units"');
    expect(html).toContain("k<sub>B</sub>");
    expect(text).toContain("Adding the powers gives m2 s−1.");
    expect(text).toContain("the units agree.");
    expect(text).toContain("What it shows, in words");
  });
});
