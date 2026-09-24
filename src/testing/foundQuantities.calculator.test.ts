import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import {
  CONVERSION_PAIRS,
  type ConversionOutcome,
  type ConversionPair,
  convertForPair,
  convertTyped,
  PRINTED_CONVERSIONS,
  type PrintedConversion,
  readTypedNumber,
} from "../foundations/unitConversions.ts";
import { conversionFactor } from "../units/adapters.ts";
import { withinTolerance } from "../units/tolerance.ts";

/**
 * The conversion calculator of foundation:unit-system-1905 (am-found-quantities-magnitudes-igxe).
 * Its factors and their exact-or-conventional status come from src/units/adapters.ts, and its
 * printed rows must agree with the constant sets they quote.
 */

interface ConstantEntry {
  readonly quantityId: string;
  readonly value: number;
  readonly printedStatus?: string;
  readonly printedReading?: string;
}

const constantSet = (id: string): readonly ConstantEntry[] =>
  (
    load(
      readFileSync(
        new URL(`../../content/quantities/constant-sets/${id}.yaml`, import.meta.url),
        "utf8",
      ),
    ) as { entries: ConstantEntry[] }
  ).entries;

const entry = (setId: string, quantityId: string): ConstantEntry => {
  const found = constantSet(setId).find((e) => e.quantityId === quantityId);
  expect(found).toBeDefined();
  return found as ConstantEntry;
};

type Converted = Extract<ConversionOutcome, { status: "converted" }>;

/** A failed expect stops the test, so the casts below only run on a found, converted row. */
const converted = (rowId: string) => {
  const found = PRINTED_CONVERSIONS.find((r) => r.id === rowId);
  expect(found).toBeDefined();
  const row = found as PrintedConversion;
  const outcome = convertForPair(row.value, row.pairId, row.digits);
  expect(outcome.status).toBe("converted");
  return { row, outcome: outcome as Converted };
};

const close = (actual: number, reference: number, relative = 1e-12) =>
  expect(withinTolerance(actual, reference, { relative }).ok).toBe(true);

/** Every non-mechanical pair must be conventional in the adapter. Returns the pairs that are not. */
const electricalButExact = (pairs: readonly ConversionPair[]) =>
  pairs.filter(
    (pair) =>
      pair.system !== "mechanical" &&
      conversionFactor(pair.fromUnit, pair.toUnit).exactness !== "conventional",
  );

describe("every factor and its status come from the unit table", () => {
  test("each pair converts, with the adapter's factor and the adapter's exactness", () => {
    expect(CONVERSION_PAIRS.length).toBeGreaterThan(0);
    for (const pair of CONVERSION_PAIRS) {
      const outcome = convertForPair(1, pair.id, 0);
      expect(outcome.status).toBe("converted");
      if (outcome.status !== "converted") continue;
      const adapter = conversionFactor(pair.fromUnit, pair.toUnit);
      close(outcome.factor, Number(adapter.factor.num) / Number(adapter.factor.den));
      expect(outcome.exactness).toBe(adapter.exactness);
    }
  });

  test("the electrical pairs are all conventional and the mechanical ones all exact", () => {
    const electrical = CONVERSION_PAIRS.filter((p) => p.system !== "mechanical");
    const mechanical = CONVERSION_PAIRS.filter((p) => p.system === "mechanical");
    // Both populations are non-empty on purpose: a list with no electrical pair would pass the
    // first check while testing nothing.
    expect(electrical.length).toBeGreaterThan(0);
    expect(mechanical.length).toBeGreaterThan(0);
    expect(electricalButExact(CONVERSION_PAIRS)).toEqual([]);
    for (const pair of mechanical) {
      expect(conversionFactor(pair.fromUnit, pair.toUnit).exactness).toBe("exact");
    }
  });

  test("planted: an electrical row whose correspondence is exact is caught", () => {
    const fixture: ConversionPair = {
      id: "planted-exact-electrical",
      fromUnit: "V",
      toUnit: "V",
      fromName: "volts",
      toName: "volts",
      fromSymbol: "V",
      toSymbol: "V",
      label: "V to V",
      system: "electromagnetic",
      factorDigits: 0,
    };
    expect(electricalButExact([...CONVERSION_PAIRS, fixture]).map((p) => p.id)).toEqual([
      "planted-exact-electrical",
    ]);
  });
});

describe("it converts units, never constants", () => {
  test("a request to turn a historical constant into a modern one is refused with the reason", () => {
    const outcome = convertTyped("6.17e23", "avogadroConstant:einstein-1905-to-modern-si-2019");
    expect(outcome.status).toBe("refused");
    if (outcome.status !== "refused") return;
    expect(outcome.reason).toBe("undocumented");
    expect(outcome.message).toContain("never turns a historical constant into a modern one");
  });

  test("no pair names a constant: every unit is one the adapter converts by a fixed ratio", () => {
    for (const pair of CONVERSION_PAIRS) {
      expect(() => conversionFactor(pair.fromUnit, pair.toUnit)).not.toThrow();
    }
  });
});

describe("the papers' numbers agree with the constant sets", () => {
  test("Brownian viscosity: 1,35 · 10⁻² poise is the set's 1.35 × 10⁻³ Pa s", () => {
    const { outcome } = converted("brownian-viscosity");
    const set = entry("einstein-1905-brownian-printed", "viscosity");
    expect(set.printedStatus).toBe("printed");
    close(outcome.value, set.value);
  });

  test("R is an editorial input, labelled so, and converts to 8.31 J", () => {
    const { row, outcome } = converted("gas-constant");
    const set = entry("einstein-1905-light-quanta-printed", "molarGasConstant");
    expect(set.printedStatus).toBe("editorial-input");
    expect(row.status).toBe("editorial-input");
    close(row.value, set.value);
    close(outcome.value, 8.31);
  });

  test("E, printed 9,6 · 10³ in electromagnetic units, is 9.6 × 10⁴ C", () => {
    const { row, outcome } = converted("light-gram-equivalent-charge");
    const set = entry("einstein-1905-light-quanta-printed", "gramEquivalentCharge");
    expect(set.printedStatus).toBe("printed");
    close(row.value, set.value);
    close(outcome.value, 9.6e4);
    expect(outcome.exactness).toBe("conventional");
  });

  test("Π = Rβν/E from the set's own inputs is the row's 4.34 × 10⁸ abvolts, and 4.34 V", () => {
    const { row, outcome } = converted("light-stopping-potential");
    expect(row.status).toBe("computed");
    const set = "einstein-1905-light-quanta-printed";
    const pi =
      (entry(set, "molarGasConstant").value * entry(set, "wienConstantBeta").value * 1.03e15) /
      entry(set, "gramEquivalentCharge").value;
    close(row.value, pi, 1e-3);
    close(outcome.value, 4.34);
    // The paper prints "ca. 4,3 Volt": two significant figures.
    close(outcome.value, entry(set, "stoppingPotentialMagnitude").value, 0.02);
  });

  test("§9's printed 6,4 · 10¹² erg is 6.4 × 10⁵ J", () => {
    const { row, outcome } = converted("light-ionization-energy");
    const set = entry("einstein-1905-light-quanta-printed", "ionizationWorkPerGramEquivalent");
    expect(set.printedStatus).toBe("printed");
    close(row.value, set.value);
    close(outcome.value, 6.4e5);
  });

  test("Planck's 4,69 · 10⁻¹⁰ statcoulombs is the set's 1.5644 × 10⁻¹⁹ C", () => {
    const { outcome } = converted("planck-elementary-charge");
    const set = entry("planck-1900-1901-printed", "elementaryCharge");
    expect(set.printedReading).toBe("4,69 · 10^-10");
    close(outcome.value, set.value, 1e-7);
    expect(outcome.exactness).toBe("conventional");
  });
});

describe("reading what a reader types", () => {
  test("the papers' forms and the computer's forms read as the same number", () => {
    for (const text of ["1.35e-2", "1,35e-2", "1,35 · 10^-2", "1.35 × 10^−2", "1.35x10-2"]) {
      const read = readTypedNumber(text);
      expect(read.kind).toBe("number");
      if (read.kind === "number") close(read.value, 1.35e-2);
    }
    const power = readTypedNumber("10^9");
    expect(power.kind === "number" && power.value).toBe(1e9);
    const negative = readTypedNumber("-4.3");
    expect(negative.kind === "number" && negative.value).toBe(-4.3);
  });

  test("the typed significant figures set the result's precision", () => {
    const three = convertTyped("1.35e-2", "poise");
    const four = convertTyped("1.350e-2", "poise");
    expect(three.status === "converted" && three.digits).toBe(2);
    expect(four.status === "converted" && four.digits).toBe(3);
  });

  test("unreadable, empty and out-of-range inputs are refused, never shown as a number", () => {
    const cases: readonly [string, string][] = [
      ["", "empty"],
      ["   ", "empty"],
      ["abc", "unreadable"],
      ["1.35×105", "unreadable"],
      ["1,35,5", "unreadable"],
      ["1e400", "out-of-range"],
      ["1e-400", "out-of-range"],
    ];
    for (const [text, reason] of cases) {
      const outcome = convertTyped(text, "poise");
      expect(outcome.status).toBe("refused");
      if (outcome.status === "refused") expect(outcome.reason).toBe(reason as never);
    }
  });

  test("an overflow in the conversion itself is refused: 10³⁰⁸ abcoulombs has no double", () => {
    const outcome = convertTyped("1e308", "abcoulomb");
    expect(outcome.status === "refused" && outcome.reason).toBe("out-of-range");
  });

  test("zero converts to zero", () => {
    const outcome = convertTyped("0", "gauss");
    expect(outcome.status === "converted" && outcome.value).toBe(0);
  });
});
