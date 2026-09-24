import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { conversionFactor } from "../units/adapters.ts";
import { getLogger } from "./log/logger.ts";

/**
 * Every number the four lessons of am-found-quantities-magnitudes-igxe print, recomputed from the
 * constant sets and the unit table and rounded to the precision the lesson prints it at. The
 * rounded string, with the word that follows it in the lesson, must appear in the lesson's text.
 * Nothing below retypes a printed result: each expected string is produced by the computation.
 */

const BEAD = "am-found-quantities-magnitudes-igxe";
const logger = getLogger("found-quantities-magnitudes");
afterAll(() => logger.flush());

interface ConstantEntry {
  readonly quantityId: string;
  readonly value: number;
}

const setValue = (setId: string, quantityId: string): number => {
  const entries = (
    load(
      readFileSync(
        new URL(`../../content/quantities/constant-sets/${setId}.yaml`, import.meta.url),
        "utf8",
      ),
    ) as { entries: ConstantEntry[] }
  ).entries;
  const found = entries.find((e) => e.quantityId === quantityId);
  expect(found).toBeDefined();
  return (found as ConstantEntry).value;
};

/** Every string a lesson shows: its paragraphs, steps and formulas, joined with spaces. */
const lessonText = (id: string): string => {
  const strings: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === "string") strings.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(
    JSON.parse(
      readFileSync(new URL(`../../content/foundations/${id}.json`, import.meta.url), "utf8"),
    ),
  );
  return strings.join(" ");
};

const SUPERSCRIPT: Readonly<Record<string, string>> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "-": "⁻",
};

/** `value` to `significant` figures as the lessons print it: 3.3 × 10⁻⁶. */
const sci = (value: number, significant: number): string => {
  const [mantissa = "", exponent = "0"] = value.toExponential(significant - 1).split("e");
  const power = String(Number(exponent))
    .split("")
    .map((c) => SUPERSCRIPT[c] ?? c)
    .join("");
  return `${mantissa} × 10${power}`;
};

/** Checks the lesson prints `expected`, logs the comparison, and returns whether it did. */
const printed = (foundationId: string, check: string, expected: string, actual: number) => {
  const found = lessonText(foundationId).includes(expected);
  logger.log({
    testId: `${foundationId}:${check}`,
    beadId: BEAD,
    expected,
    actual,
    comparisonKind: "rounds-to",
    outcome: found ? "passed" : "failed",
    message: found
      ? `${foundationId} prints ${expected}, which ${actual} rounds to`
      : `${foundationId} does not print "${expected}", which ${actual} rounds to`,
    extra: { foundationId, check },
  });
  expect(found, `${foundationId} should print "${expected}" (from ${actual})`).toBe(true);
};

const MODERN = "modern-si-2019";
const LIGHT = "einstein-1905-light-quanta-printed";
const BROWNIAN = "einstein-1905-brownian-printed";
const c = setValue(MODERN, "speedOfLight");
const h = setValue(MODERN, "planckConstant");
const e = setValue(MODERN, "elementaryCharge");
const factor = (from: string, to: string) => {
  const f = conversionFactor(from, to).factor;
  return Number(f.num) / Number(f.den);
};

describe("orders of magnitude", () => {
  const id = "orders-of-magnitude";

  test("sizes: a 1 μm grain against a 0.3 nm molecule, and the printed hydrogen mass 1/N", () => {
    const ratio = 1e-6 / 0.3e-9;
    printed(
      id,
      "grain-to-molecule",
      `${(Math.round(ratio / 1000) * 1000).toLocaleString("en-US")} times`,
      ratio,
    );
    const hydrogen = 1 / setValue(LIGHT, "avogadroConstant");
    printed(id, "hydrogen-mass", `${sci(hydrogen, 3)} g`, hydrogen);
  });

  test("speeds against light: bullet, jet, the Earth, and the Earth's ratio squared", () => {
    printed(id, "bullet", `${sci(1000 / c, 2)} for a rifle bullet`, 1000 / c);
    printed(id, "jet", `${sci(250 / c, 2)} for a jet`, 250 / c);
    printed(id, "earth", `${sci(29_800 / c, 2)} for the Earth`, 29_800 / c);
    printed(id, "earth-squared", `about ${sci((29_800 / c) ** 2, 2)}`, (29_800 / c) ** 2);
  });

  test("one quantum hν of red, green and ultraviolet light, in electron volts", () => {
    // Each anchored to the lesson's own wording, so a bare 2.34 elsewhere cannot satisfy it.
    for (const [nm, name, before, after] of [
      [650, "red", "about ", " electron volts"],
      [530, "green", "(530 nm) ", " eV"],
      [250, "ultraviolet", "(250 nm) ", " eV"],
    ] as const) {
      const eV = (h * c) / (nm * 1e-9) / e;
      printed(id, `photon-${name}`, `${before}${eV.toFixed(2)}${after}`, eV);
    }
  });

  test("molecular kicks: number density, flux, area and blows a second, as an estimate", () => {
    const n = (1000 / 0.018015) * setValue(MODERN, "avogadroConstant");
    printed(id, "number-density", `${sci(n, 3)} molecules per cubic metre`, n);
    const flux = 0.25 * n * 600;
    printed(id, "flux", `about ${sci(flux, 1)} strikes per square metre`, flux);
    const diameterArea = Math.PI * 1e-6 ** 2;
    printed(id, "area-1um-across", `${sci(diameterArea, 2)} m²`, diameterArea);
    printed(
      id,
      "rate-1um-across",
      `about ${sci(flux * diameterArea, 2)} strikes a second`,
      flux * diameterArea,
    );
    const radiusArea = 4 * Math.PI * 1e-6 ** 2;
    printed(
      id,
      "rate-1um-radius",
      `about ${sci(flux * radiusArea, 1)} for a grain of 1 μm radius`,
      flux * radiusArea,
    );
  });
});

describe("ratios and scaling", () => {
  const id = "ratios-scaling";

  test("the paper's 0.8 μm spread, and what doubling the radius does to it", () => {
    const spread = setValue(BROWNIAN, "rmsDisplacement1d") / 1e-6;
    printed(id, "spread", `${spread.toFixed(4)} μm in 1 s`, spread);
    printed(id, "root-half", `√½ = ${Math.SQRT1_2.toFixed(4)}`, Math.SQRT1_2);
    const doubled = spread * Math.SQRT1_2;
    printed(id, "doubled-radius", `= ${doubled.toFixed(4)} μm`, doubled);
    printed(id, "root-two", `about ${Math.SQRT2.toFixed(2)}`, Math.SQRT2);
  });
});

describe("quantities and units", () => {
  test("D for the paper's particle comes out in square metres per second", () => {
    const D =
      (setValue(MODERN, "boltzmannConstant") * 290.15) /
      (6 * Math.PI * setValue(BROWNIAN, "viscosity") * setValue(BROWNIAN, "particleRadius"));
    printed("quantities-units", "diffusivity", `${sci(D, 3)} m²/s`, D);
  });
});

describe("the 1905 unit system", () => {
  const id = "unit-system-1905";
  const R = setValue(LIGHT, "molarGasConstant");
  const beta = setValue(LIGHT, "wienConstantBeta");
  const E = setValue(LIGHT, "gramEquivalentCharge");
  const N = setValue(LIGHT, "avogadroConstant");
  const nu = 1.03e15; // printed in §8, p. 146
  const abV = factor("abV", "V");

  test("§8: Π = Rβν/E in abvolts, and in volts", () => {
    const pi = (R * beta * nu) / E;
    printed(id, "pi-abvolts", `${sci(pi, 3)} abvolts`, pi);
    printed(id, "pi-volts", `${(pi * abV).toFixed(2)} volts`, pi * abV);
  });

  test("§9 both ways: 6,4 · 10¹² erg as a potential, and Stark's 10 volts as an energy", () => {
    const potential = setValue(LIGHT, "ionizationWorkPerGramEquivalent") / E;
    printed(id, "ionization-abvolts", `${sci(potential, 3)} abvolts`, potential);
    printed(id, "ionization-volts", `or ${(potential * abV).toFixed(2)} volts`, potential * abV);
    const bound = (10 / abV) * E;
    printed(id, "stark-bound", `${sci(bound, 2)} erg per gram-equivalent`, bound);
  });

  test("E in coulombs, and its distance below the modern Faraday constant", () => {
    const coulombs = E * factor("abC", "C");
    printed(id, "e-coulombs", `${sci(coulombs, 2)} coulombs per gram-equivalent`, coulombs);
    const F = setValue(MODERN, "faradayConstant");
    const below = ((F - coulombs) / F) * 100;
    printed(id, "faraday-gap", `${below.toFixed(2)} percent below`, below);
  });

  test("per gram-equivalent against per ion: E/N, and the per-electron route's 4.31 volts", () => {
    const perIon = E / N;
    printed(id, "e-over-n-abcoulombs", `${sci(perIon, 3)} abcoulombs`, perIon);
    printed(
      id,
      "e-over-n-coulombs",
      `${sci(perIon * factor("abC", "C"), 3)} coulombs`,
      perIon * factor("abC", "C"),
    );
    const planck = setValue("planck-1900-1901-printed", "elementaryCharge") / factor("statC", "C");
    const perElectron = (((R / N) * beta * nu) / planck) * factor("statV", "V");
    printed(id, "per-electron-route", `gives ${perElectron.toFixed(2)} volts`, perElectron);
  });

  test("Gaussian units: one statvolt per centimetre in volts per metre", () => {
    const f = factor("statV/cm", "V/m");
    printed(id, "statvolt-per-cm", `${sci(f, 4)} volts per metre`, f);
  });
});
