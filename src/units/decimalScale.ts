/** Shift a decimal exponent before binary64 conversion; do not multiply and divide rounded doubles. */
function shift(text: string, power: number): string {
  if (!Number.isSafeInteger(power) || Math.abs(power) > 308) throw new RangeError("Unsupported decimal unit scale.");
  if (text.length > 128 || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) throw new TypeError("Enter a finite decimal number.");
  const [coefficient, exponent = "0"] = text.toLowerCase().split("e");
  const adjusted = Number(exponent) + power;
  if (!Number.isSafeInteger(adjusted)) throw new RangeError("The exponent is outside the supported range.");
  return `${coefficient}e${adjusted}`;
}
export function parseScaledDecimal(text: string, displayPower: number): number {
  const value = Number(shift(text.trim(), -displayPower));
  if (!Number.isFinite(value)) throw new RangeError("The value is outside the finite calculation range.");
  // Refuse nonzero decimal input that underflows, rather than teaching a fabricated zero.
  const coefficient = text.trim().split(/[eE]/)[0]!;
  if (value === 0 && /[1-9]/.test(coefficient)) throw new RangeError("The value is smaller than the calculation can represent.");
  return value;
}
export function formatScaledDecimal(value: number, displayPower: number, significantDigits?: number): string {
  if (!Number.isFinite(value)) throw new TypeError("Only finite accepted values can be displayed.");
  // Precision rounding can exceed binary64's range even when the input is finite.
  // Keep that rounded decimal as text instead of parsing it back into a number.
  const text = significantDigits === undefined ? String(value) : value.toPrecision(significantDigits);
  const [mantissa, originalExponent] = text.split("e");
  const compact = mantissa!.includes(".") ? mantissa!.replace(/0+$/, "").replace(/\.$/, "") : mantissa!;
  const scaled = shift(originalExponent === undefined ? compact : `${compact}e${originalExponent}`, displayPower);
  const [coefficient, exponent] = scaled.split("e");
  const negative = coefficient!.startsWith("-");
  const unsigned = coefficient!.replace(/^[+-]/, "");
  const digits = unsigned.replace(".", "");
  const point = (unsigned.includes(".") ? unsigned.indexOf(".") : unsigned.length) + Number(exponent);
  let result: string;
  if (point >= -5 && point <= 15) {
    result = point <= 0 ? `0.${"0".repeat(-point)}${digits}` : point >= digits.length ? digits + "0".repeat(point - digits.length) : `${digits.slice(0, point)}.${digits.slice(point)}`;
    if (result.includes(".")) result = result.replace(/0+$/, "").replace(/\.$/, "");
    result = result.replace(/^0+(?=\d)/, "");
  } else return scaled;
  return `${negative ? "-" : ""}${result || "0"}`;
}
