/**
 * Spoken number and unit forms (am-ver-precision-display-5e5 / am-a11y-graph-descriptions-vxe1).
 *
 * Produces accessible ordinary-language pronunciations for numbers, physical units,
 * and mathematical expressions so screen readers announce meaningful speech rather
 * than raw LaTeX or truncated symbol abbreviations.
 */

const SPOKEN_UNITS: Readonly<Record<string, { singular: string; plural: string }>> = Object.freeze({
  m: { singular: "metre", plural: "metres" },
  cm: { singular: "centimetre", plural: "centimetres" },
  mm: { singular: "millimetre", plural: "millimetres" },
  μm: { singular: "micrometre", plural: "micrometres" },
  micron: { singular: "micrometre", plural: "micrometres" },
  microns: { singular: "micrometre", plural: "micrometres" },
  nm: { singular: "nanometre", plural: "nanometres" },
  pm: { singular: "picometre", plural: "picometres" },
  s: { singular: "second", plural: "seconds" },
  ms: { singular: "millisecond", plural: "milliseconds" },
  μs: { singular: "microsecond", plural: "microseconds" },
  ns: { singular: "nanosecond", plural: "nanoseconds" },
  K: { singular: "kelvin", plural: "kelvin" },
  "°C": { singular: "degree Celsius", plural: "degrees Celsius" },
  kg: { singular: "kilogram", plural: "kilograms" },
  g: { singular: "gram", plural: "grams" },
  J: { singular: "joule", plural: "joules" },
  nJ: { singular: "nanojoule", plural: "nanojoules" },
  eV: { singular: "electronvolt", plural: "electronvolts" },
  W: { singular: "watt", plural: "watts" },
  N: { singular: "newton", plural: "newtons" },
  Pa: { singular: "pascal", plural: "pascals" },
  Pa·s: { singular: "pascal-second", plural: "pascal-seconds" },
  "Pa*s": { singular: "pascal-second", plural: "pascal-seconds" },
  poise: { singular: "poise", plural: "poise" },
  Hz: { singular: "hertz", plural: "hertz" },
  kHz: { singular: "kilohertz", plural: "kilohertz" },
  MHz: { singular: "megahertz", plural: "megahertz" },
  GHz: { singular: "gigahertz", plural: "gigahertz" },
  THz: { singular: "terahertz", plural: "terahertz" },
  "V/m": { singular: "volt per metre", plural: "volts per metre" },
  T: { singular: "tesla", plural: "teslas" },
  A: { singular: "ampere", plural: "amperes" },
  "A/m^2": { singular: "ampere per square metre", plural: "amperes per square metre" },
  "A/m²": { singular: "ampere per square metre", plural: "amperes per square metre" },
  C: { singular: "coulomb", plural: "coulombs" },
  "C/m^3": { singular: "coulomb per cubic metre", plural: "coulombs per cubic metre" },
  "C/m³": { singular: "coulomb per cubic metre", plural: "coulombs per cubic metre" },
  rad: { singular: "radian", plural: "radians" },
  deg: { singular: "degree", plural: "degrees" },
  "m/s": { singular: "metre per second", plural: "metres per second" },
  "m^2/s": { singular: "square metre per second", plural: "square metres per second" },
  "m²/s": { singular: "square metre per second", plural: "square metres per second" },
  "m^3": { singular: "cubic metre", plural: "cubic metres" },
  "m³": { singular: "cubic metre", plural: "cubic metres" },
  "1/s": { singular: "per second", plural: "per second" },
  "J/K": { singular: "joule per kelvin", plural: "joules per kelvin" },
  "J/(mol·K)": { singular: "joule per mole kelvin", plural: "joules per mole kelvin" },
  "J/(mol*K)": { singular: "joule per mole kelvin", plural: "joules per mole kelvin" },
  "1/mol": { singular: "per mole", plural: "per mole" },
  dimensionless: { singular: "", plural: "" },
  "1": { singular: "", plural: "" },
});

/**
 * Converts a physical unit symbol into its spoken name.
 */
export function spokenUnit(unit: string, count = 1): string {
  const trimmed = unit.trim();
  const entry = SPOKEN_UNITS[trimmed];
  if (entry) {
    return Math.abs(count) === 1 ? entry.singular : entry.plural;
  }
  return trimmed;
}

/**
 * Converts a number and unit to an ordinary spoken phrase (e.g. "0.79 micrometres").
 */
export function spokenQuantity(val: number | string, unit: string): string {
  const num = typeof val === "number" ? val : Number.parseFloat(val);
  const valStr = String(val);
  const unitStr = spokenUnit(unit, Number.isFinite(num) ? num : 1);

  if (!unitStr) return valStr;
  return `${valStr} ${unitStr}`.trim();
}
