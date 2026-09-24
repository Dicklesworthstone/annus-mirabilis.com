/**
 * The conversion calculator of foundation:unit-system-1905 (am-found-quantities-magnitudes-igxe).
 *
 * It converts units only. Every factor, and whether it is exact or conventional, is read from
 * src/units/adapters.ts at the moment of conversion and never retyped here, so the calculator
 * cannot call an electrical correspondence exact while the adapter calls it conventional. It has
 * no entry that turns a historical constant into a modern one: those differ in value, not in
 * unit, and a request for one is refused with that reason instead of being answered.
 *
 * Nothing here throws. A typed number that cannot be read, or a result outside double precision,
 * comes back as a typed refusal with a sentence the page can show.
 */
import { conversionFactor, convertValue, type UnitExactness } from "../units/adapters.ts";

export type ConversionSystem = "mechanical" | "electromagnetic" | "electrostatic";

export interface ConversionPair {
  readonly id: string;
  /** Unit ids as src/units/adapters.ts spells them. */
  readonly fromUnit: string;
  readonly toUnit: string;
  /** Reader-facing plural names. */
  readonly fromName: string;
  readonly toName: string;
  /** Unit symbols for the ratio line: 1 P = 0.1 Pa s. */
  readonly fromSymbol: string;
  readonly toSymbol: string;
  /** Short label for the menu, narrow enough for a 320px phone. */
  readonly label: string;
  readonly system: ConversionSystem;
  /** Fraction digits the factor is drawn with: 299.792458 needs 8, 0.1 needs none. */
  readonly factorDigits: number;
}

export const CONVERSION_PAIRS: readonly ConversionPair[] = [
  {
    id: "poise",
    fromUnit: "P",
    toUnit: "Pa*s",
    fromName: "poise",
    toName: "pascal-seconds",
    fromSymbol: "P",
    toSymbol: "Pa s",
    label: "poise to Pa s",
    system: "mechanical",
    factorDigits: 0,
  },
  {
    id: "erg",
    fromUnit: "erg",
    toUnit: "J",
    fromName: "ergs",
    toName: "joules",
    fromSymbol: "erg",
    toSymbol: "J",
    label: "erg to J",
    system: "mechanical",
    factorDigits: 0,
  },
  {
    id: "centimetre",
    fromUnit: "cm",
    toUnit: "m",
    fromName: "centimetres",
    toName: "metres",
    fromSymbol: "cm",
    toSymbol: "m",
    label: "cm to m",
    system: "mechanical",
    factorDigits: 0,
  },
  {
    id: "gram",
    fromUnit: "g",
    toUnit: "kg",
    fromName: "grams",
    toName: "kilograms",
    fromSymbol: "g",
    toSymbol: "kg",
    label: "g to kg",
    system: "mechanical",
    factorDigits: 0,
  },
  {
    id: "abvolt",
    fromUnit: "abV",
    toUnit: "V",
    fromName: "abvolts",
    toName: "volts",
    fromSymbol: "abV",
    toSymbol: "V",
    label: "abvolt to V",
    system: "electromagnetic",
    factorDigits: 0,
  },
  {
    id: "abcoulomb",
    fromUnit: "abC",
    toUnit: "C",
    fromName: "abcoulombs",
    toName: "coulombs",
    fromSymbol: "abC",
    toSymbol: "C",
    label: "abcoulomb to C",
    system: "electromagnetic",
    factorDigits: 0,
  },
  {
    id: "statvolt",
    fromUnit: "statV",
    toUnit: "V",
    fromName: "statvolts",
    toName: "volts",
    fromSymbol: "statV",
    toSymbol: "V",
    label: "statvolt to V",
    system: "electrostatic",
    factorDigits: 8,
  },
  {
    id: "statcoulomb",
    fromUnit: "statC",
    toUnit: "C",
    fromName: "statcoulombs",
    toName: "coulombs",
    fromSymbol: "statC",
    toSymbol: "C",
    label: "statcoulomb to C",
    system: "electrostatic",
    factorDigits: 6,
  },
  {
    id: "statvolt-per-centimetre",
    fromUnit: "statV/cm",
    toUnit: "V/m",
    fromName: "statvolts per centimetre",
    toName: "volts per metre",
    fromSymbol: "statV/cm",
    toSymbol: "V/m",
    label: "statvolt/cm to V/m",
    system: "electrostatic",
    factorDigits: 8,
  },
  {
    id: "gauss",
    fromUnit: "G",
    toUnit: "T",
    fromName: "gauss",
    toName: "tesla",
    fromSymbol: "G",
    toSymbol: "T",
    label: "gauss to T",
    system: "electrostatic",
    factorDigits: 0,
  },
];

export const SYSTEM_LABELS: Readonly<Record<ConversionSystem, string>> = {
  mechanical: "Mechanical CGS",
  electromagnetic: "Electromagnetic CGS",
  electrostatic: "Electrostatic and Gaussian CGS",
};

export const EXACTNESS_NOTES: Readonly<Record<UnitExactness, string>> = {
  exact: "Exact: it follows from 1 cm = 0.01 m and 1 g = 0.001 kg.",
  conventional:
    "Conventional: it assumes the magnetic constant μ₀ is exactly 4π × 10⁻⁷ H/m. The SI has measured μ₀ since 2019, and it agrees with that value to within about one part in a billion.",
};

export type RefusalReason = "empty" | "unreadable" | "out-of-range" | "undocumented";

export const REFUSAL_MESSAGES: Readonly<Record<RefusalReason, string>> = {
  empty: "Type a number, for example 1.35e-2 or 1,35 · 10^-2.",
  unreadable:
    "The calculator cannot read that as a number. Write it like 1.35e-2 or 1,35 · 10^-2; a comma is read as a decimal comma, as the papers print it.",
  "out-of-range": "That number is too large or too small to convert here.",
  undocumented:
    "The calculator converts only the unit pairs listed. It never turns a historical constant into a modern one: those are different values, not different units.",
};

export type ConversionOutcome =
  | {
      readonly status: "converted";
      readonly pair: ConversionPair;
      readonly input: number;
      readonly value: number;
      readonly factor: number;
      readonly exactness: UnitExactness;
      /** Fraction digits for drawing input and result: the input's significant figures, less one. */
      readonly digits: number;
    }
  | { readonly status: "refused"; readonly reason: RefusalReason; readonly message: string };

const PAIRS_BY_ID = new Map(CONVERSION_PAIRS.map((pair) => [pair.id, pair]));

const refused = (reason: RefusalReason): ConversionOutcome => ({
  status: "refused",
  reason,
  message: REFUSAL_MESSAGES[reason],
});

/** Largest number of significant figures carried into a result. */
const MAX_SIGNIFICANT = 10;

export type TypedNumber =
  | { readonly kind: "number"; readonly value: number; readonly significant: number }
  | { readonly kind: "unreadable" }
  /** Written correctly, but outside double precision: 1e400 overflows and 1e-400 would read as 0. */
  | { readonly kind: "out-of-range" };

/**
 * Reads a typed number: 1.35e-2, 1,35e-2, 1.35 × 10^-2, 1,35 · 10^-2 or 10^9. A comma is a
 * decimal comma, as the papers print one. "× 10" needs a caret or a sign after it, so 1.35×105
 * is refused rather than read as 1.35 × 10⁵.
 */
export function readTypedNumber(text: string): TypedNumber {
  let t = text.replace(/\u2212/g, "-").replace(/\s+/g, "");
  t = t.replace(/^([+-]?)10\^/, (_whole, sign: string) => `${sign}1e`);
  t = t.replace(/[×x·*]10(?:\^|(?=[+-]))/, "e").replace(",", ".");
  const match = /^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(t);
  if (!match) return { kind: "unreadable" };
  const [, , whole = "", fraction = ""] = match;
  const digits = (whole + fraction).replace(/^0+/, "").length;
  const value = Number(t);
  if (!Number.isFinite(value) || (value === 0 && digits > 0)) return { kind: "out-of-range" };
  return {
    kind: "number",
    value,
    significant: Math.min(Math.max(digits, 1), MAX_SIGNIFICANT),
  };
}

/** Converts a value already known as a number, drawn with `digits` fraction digits. */
export function convertForPair(value: number, pairId: string, digits: number): ConversionOutcome {
  const pair = PAIRS_BY_ID.get(pairId);
  if (!pair) return refused("undocumented");
  if (!Number.isFinite(value)) return refused("out-of-range");
  const { factor, exactness } = conversionFactor(pair.fromUnit, pair.toUnit);
  const converted = convertValue(value, pair.fromUnit, pair.toUnit);
  if (!Number.isFinite(converted) || (converted === 0 && value !== 0)) {
    return refused("out-of-range");
  }
  return {
    status: "converted",
    pair,
    input: value,
    value: converted,
    factor: Number(factor.num) / Number(factor.den),
    exactness,
    digits,
  };
}

/** Converts what a reader typed, keeping the significant figures they typed. */
export function convertTyped(text: string, pairId: string): ConversionOutcome {
  if (!PAIRS_BY_ID.has(pairId)) return refused("undocumented");
  if (text.trim() === "") return refused("empty");
  const read = readTypedNumber(text);
  if (read.kind !== "number") return refused(read.kind);
  return convertForPair(read.value, pairId, read.significant - 1);
}

export type PrintedStatus = "printed" | "editorial-input" | "computed";

export interface PrintedConversion {
  readonly id: string;
  /** Where the number comes from, for the row's heading. */
  readonly source: string;
  /** What the number is. */
  readonly quantity: string;
  readonly value: number;
  /** Fraction digits the value was printed or computed with. */
  readonly digits: number;
  readonly pairId: string;
  /** A unit the conversion leaves untouched, written after both numbers: "per gram-equivalent". */
  readonly per?: string;
  readonly status: PrintedStatus;
}

/**
 * The papers' own numbers, from the constant sets and the lesson's worked example. The page's
 * table converts each through convertForPair, so the factor and its status come from the adapter.
 */
export const PRINTED_CONVERSIONS: readonly PrintedConversion[] = [
  {
    id: "brownian-viscosity",
    source: "Brownian motion, p. 559",
    quantity: "Water's viscosity, which the paper calls k",
    value: 1.35e-2,
    digits: 2,
    pairId: "poise",
    status: "printed",
  },
  {
    id: "gas-constant",
    source: "Supplied by the edition",
    quantity: "The gas constant R, which neither paper prints",
    value: 8.31e7,
    digits: 2,
    pairId: "erg",
    per: "per mole per kelvin",
    status: "editorial-input",
  },
  {
    id: "light-gram-equivalent-charge",
    source: "Light quanta §8, p. 146",
    quantity: "E, the charge of one gram-equivalent of a monovalent ion",
    value: 9.6e3,
    digits: 1,
    pairId: "abcoulomb",
    per: "per gram-equivalent",
    status: "printed",
  },
  {
    id: "light-stopping-potential",
    source: "Light quanta §8, computed in the worked example",
    quantity: "Π = Rβν/E with P′ = 0; the paper prints only the result, about 4,3 volts",
    value: 4.34e8,
    digits: 2,
    pairId: "abvolt",
    status: "computed",
  },
  {
    id: "light-ionization-energy",
    source: "Light quanta §9, p. 148",
    quantity: "Rβν for the longest effective wavelength in air",
    value: 6.4e12,
    digits: 1,
    pairId: "erg",
    per: "per gram-equivalent",
    status: "printed",
  },
  {
    id: "planck-elementary-charge",
    source: "Planck 1901, p. 565",
    quantity: "The elementary charge",
    value: 4.69e-10,
    digits: 2,
    pairId: "statcoulomb",
    status: "printed",
  },
];
