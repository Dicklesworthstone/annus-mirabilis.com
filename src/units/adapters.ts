/**
 * Unit display adapters and conversion factors (AGENTS.md "Canonical transport is SI").
 * Every factor is an exact rational, tagged `exact` (the definition itself is exact) or
 * `conventional` (a Gaussian/EMU-SI correspondence that assumes mu_0 = 4*pi*1e-7 H/m, which
 * has not been exactly true since the 2019 SI redefinition). Pure: no I/O, no globals.
 * am-not-quantity-registry-2f7.
 */
import { divide, multiply, type Rational, rational } from "../content/dimensions/rational.ts";

export type UnitExactness = "exact" | "conventional";

export type UnitDefinition = Readonly<{
  unit: string;
  family: string;
  factor: Rational; // unit = factor * (one family base unit)
  exactness: UnitExactness;
}>;

function def(
  unit: string,
  family: string,
  num: bigint,
  den: bigint,
  exactness: UnitExactness,
): UnitDefinition {
  return Object.freeze({ unit, family, factor: rational(num, den), exactness });
}

const SPEED_OF_LIGHT_M_PER_S = 299792458n;

/** Base unit per family: length -> m, viscosity -> Pa*s, energy -> J, frequency -> Hz,
 * mass -> kg, charge -> C, potential -> V, electricField -> V/m, magneticField -> T,
 * current -> A, action -> J*s, countRate -> 1/s. Each family's base unit itself is
 * `factor: 1/1, exactness: "exact"`. */
const UNITS: readonly UnitDefinition[] = Object.freeze([
  // Length
  def("m", "length", 1n, 1n, "exact"),
  def("um", "length", 1n, 1_000_000n, "exact"),
  def("nm", "length", 1n, 1_000_000_000n, "exact"),
  def("cm", "length", 1n, 100n, "exact"),
  def("ls", "length", SPEED_OF_LIGHT_M_PER_S, 1n, "exact"),

  // Dynamic viscosity
  def("Pa*s", "viscosity", 1n, 1n, "exact"),
  def("mPa*s", "viscosity", 1n, 1_000n, "exact"),
  def("P", "viscosity", 1n, 10n, "exact"), // 1 P = 0.1 Pa*s

  // Energy
  def("J", "energy", 1n, 1n, "exact"),
  def("eV", "energy", 1_602_176_634n, 10_000_000_000_000_000_000_000_000_000n, "exact"), // 1.602176634e-19, exact SI
  def("erg", "energy", 1n, 10_000_000n, "exact"), // 1e-7 J

  // Frequency
  def("Hz", "frequency", 1n, 1n, "exact"),
  def("THz", "frequency", 1_000_000_000_000n, 1n, "exact"),

  // Mass
  def("kg", "mass", 1n, 1n, "exact"),
  def("g", "mass", 1n, 1_000n, "exact"),

  // Charge (conventional factors use the exact c only as a numerical device; the physical
  // correspondence itself is conventional because it assumes an exact mu_0)
  def("C", "charge", 1n, 1n, "exact"),
  def("statC", "charge", 1n, 10n * SPEED_OF_LIGHT_M_PER_S, "conventional"), // 1/(10c)
  def("abC", "charge", 10n, 1n, "conventional"),

  // Electric potential
  def("V", "potential", 1n, 1n, "exact"),
  def("statV", "potential", SPEED_OF_LIGHT_M_PER_S, 1_000_000n, "conventional"), // 299.792458
  def("abV", "potential", 1n, 100_000_000n, "conventional"), // 1e-8

  // Electric field
  def("V/m", "electricField", 1n, 1n, "exact"),
  def("statV/cm", "electricField", SPEED_OF_LIGHT_M_PER_S, 10_000n, "conventional"), // 299792458/10000 = 29979.2458

  // Magnetic field
  def("T", "magneticField", 1n, 1n, "exact"),
  def("G", "magneticField", 1n, 10_000n, "conventional"), // 1e-4

  // Current
  def("A", "current", 1n, 1n, "exact"),
  def("abA", "current", 10n, 1n, "conventional"),

  // Action, the unit of Planck's constant: eV*s is exact because the eV is.
  def("J*s", "action", 1n, 1n, "exact"),
  def("eV*s", "action", 1_602_176_634n, 10_000_000_000_000_000_000_000_000_000n, "exact"),

  // A count per second: quanta, electrons or events. Kept apart from Hz, which the SI reserves
  // for periodic phenomena, so a rate of quanta is never offered in hertz.
  def("1/s", "countRate", 1n, 1n, "exact"),
]);

const BY_UNIT = new Map(UNITS.map((u) => [u.unit, u]));

export class UnitConversionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "UnitConversionError";
    this.code = code;
  }
}

function lookup(unit: string): UnitDefinition {
  const def = BY_UNIT.get(unit);
  if (!def) throw new UnitConversionError("unknown-unit", `Unknown unit "${unit}".`);
  return def;
}

/** The exact rational factor `from` and `to` share, and whether the correspondence is exact
 * or conventional (the weaker of the two, if they differ). Refuses to convert across
 * families: a length never converts to a viscosity by exponent arithmetic alone. */
export function conversionFactor(
  fromUnit: string,
  toUnit: string,
): Readonly<{ factor: Rational; exactness: UnitExactness }> {
  const from = lookup(fromUnit);
  const to = lookup(toUnit);
  if (from.family !== to.family) {
    throw new UnitConversionError(
      "family-mismatch",
      `Cannot convert "${fromUnit}" (${from.family}) to "${toUnit}" (${to.family}).`,
    );
  }
  const factor = divide(from.factor, to.factor);
  const exactness: UnitExactness =
    from.exactness === "exact" && to.exactness === "exact" ? "exact" : "conventional";
  return Object.freeze({ factor, exactness });
}

/** The inverse of `conversionFactor(fromUnit, toUnit)`, exposed so a sensitivity (a
 * derivative per `fromUnit`) converts to a derivative per `toUnit` by this same exact
 * factor's reciprocal. AGENTS.md: unit conversions apply to sensitivities as well as values;
 * sensitivity conversion itself is implemented by am-ver-precision-display-5e5. */
export function inverseConversionFactor(
  fromUnit: string,
  toUnit: string,
): Readonly<{ factor: Rational; exactness: UnitExactness }> {
  const forward = conversionFactor(fromUnit, toUnit);
  return Object.freeze({
    factor: divide(rational(1n), forward.factor),
    exactness: forward.exactness,
  });
}

function bigPow(base: bigint, exp: bigint): bigint {
  let result = 1n;
  for (let i = 0n; i < exp; i++) result *= base;
  return result;
}

function rationalToExactDecimalString(r: Rational): string {
  const negative = r.num < 0n;
  const num = negative ? -r.num : r.num;
  let d = r.den;
  let twos = 0n;
  let fives = 0n;
  while (d % 2n === 0n) {
    d /= 2n;
    twos++;
  }
  while (d % 5n === 0n) {
    d /= 5n;
    fives++;
  }
  if (d !== 1n)
    throw new UnitConversionError(
      "non-terminating-decimal",
      `${r.num}/${r.den} has no finite decimal representation.`,
    );
  const k = twos > fives ? twos : fives;
  const scaledNum = num * bigPow(2n, k - twos) * bigPow(5n, k - fives);
  const digits = scaledNum.toString();
  const kNum = Number(k);
  let result: string;
  if (kNum === 0) {
    result = digits;
  } else if (digits.length <= kNum) {
    result = `0.${digits.padStart(kNum, "0")}`;
  } else {
    result = `${digits.slice(0, digits.length - kNum)}.${digits.slice(digits.length - kNum)}`;
  }
  return negative ? `-${result}` : result;
}

/** Parses a finite decimal string (with optional exponent) into an exact rational. Never
 * routes through binary64: "1.602176634e-19" keeps every printed digit. */
export function parseExactDecimal(text: string): Rational {
  const trimmed = text.trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(trimmed);
  if (!match)
    throw new UnitConversionError("invalid-decimal", `"${text}" is not a finite decimal number.`);
  const [, sign, intPart, fracPart = "", expPart] = match;
  const digits = intPart + fracPart;
  const exponent = (expPart ? Number(expPart) : 0) - fracPart.length;
  let num = BigInt(digits);
  if (sign === "-") num = -num;
  if (exponent >= 0) {
    return rational(num * bigPow(10n, BigInt(exponent)), 1n);
  }
  return rational(num, bigPow(10n, BigInt(-exponent)));
}

/** Exact rational conversion for a decimal-string input. Throws `non-terminating-decimal`
 * if the exact result has no finite decimal representation (never silently rounds). */
export function convertExact(decimalValue: string, fromUnit: string, toUnit: string): string {
  const value = parseExactDecimal(decimalValue);
  const { factor } = conversionFactor(fromUnit, toUnit);
  return rationalToExactDecimalString(multiply(value, factor));
}

/** Double-precision conversion: the value nearest the exact rational product. For factors
 * and inputs in this module's range, bigint-to-Number division is within one ULP of the
 * true nearest double; no tolerance constant is involved because there is nothing to
 * compare against, only a single computed result. */
export function convertValue(value: number, fromUnit: string, toUnit: string): number {
  if (!Number.isFinite(value))
    throw new UnitConversionError("nonfinite-value", "Only finite values can be converted.");
  const { factor } = conversionFactor(fromUnit, toUnit);
  return (value * Number(factor.num)) / Number(factor.den);
}

const CELSIUS_OFFSET = rational(27315n, 100n); // 273.15, exact

/** Converts an absolute temperature. The Celsius offset applies here and only here --
 * never to a temperature difference or a sensitivity, which are the same size of degree in
 * both scales. */
export function convertTemperatureValue(
  value: number,
  from: "K" | "degC",
  to: "K" | "degC",
): number {
  if (!Number.isFinite(value))
    throw new UnitConversionError("nonfinite-value", "Only finite temperatures can be converted.");
  const offset = Number(CELSIUS_OFFSET.num) / Number(CELSIUS_OFFSET.den);
  if (from === to) return value;
  if (from === "degC" && to === "K") return value + offset;
  if (from === "K" && to === "degC") return value - offset;
  throw new UnitConversionError(
    "unknown-unit",
    `Unknown temperature unit pair "${from}" -> "${to}".`,
  );
}

/** A temperature difference or sensitivity (a derivative per degree) is numerically
 * identical in K and degC: the affine offset cancels. Refuses to touch other unit pairs so a
 * length sensitivity is never silently passed through unconverted. */
export function convertTemperatureDelta(
  value: number,
  from: "K" | "degC",
  to: "K" | "degC",
): number {
  if (!Number.isFinite(value))
    throw new UnitConversionError("nonfinite-value", "Only finite differences can be converted.");
  if ((from !== "K" && from !== "degC") || (to !== "K" && to !== "degC")) {
    throw new UnitConversionError(
      "unknown-unit",
      `Unknown temperature unit pair "${from}" -> "${to}".`,
    );
  }
  return value;
}

export type HistoricalLabel = Readonly<{ label: string; unit: string; note: string }>;

/** Historical display labels: the value never changes, only how it is printed, and
 * "per gram-equivalent" additionally depends on a valence the label alone cannot supply. */
export const HISTORICAL_LABELS: readonly HistoricalLabel[] = Object.freeze([
  Object.freeze({
    label: "per gram-molecule",
    unit: "1/mol",
    note: "A historical label for mol^-1; the value does not change.",
  }),
  Object.freeze({
    label: "per gram-equivalent",
    unit: "1/mol",
    note: "A historical label for the charge of a monovalent ion's gram-equivalent; one gram-equivalent is 1/z mole for valence z. The value does not change but display requires z.",
  }),
  Object.freeze({
    label: "Mikron",
    unit: "um",
    note: "Paper 2's historical label for the micrometer.",
  }),
]);

export function listUnitsInFamily(family: string): readonly UnitDefinition[] {
  return Object.freeze(UNITS.filter((u) => u.family === family));
}
