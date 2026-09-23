/**
 * Powers of ten a reader can read.
 *
 * `Number.prototype.toExponential` is a serialization format, and the laboratories were
 * printing it straight to readers: "9.990000e-1" for a share of 99.9%, "2.070974e-20 J"
 * for a resonator's mean energy, "0.000000e+0" for nothing at all. Measured on the
 * 14:24:47 build of 2026-09-22, 202 such tokens reached reader-facing text on 22 of the
 * 38 laboratory pages.
 *
 * `exponentialParts` takes the same arguments as `toExponential` and keeps its digits
 * exactly, so a call site changes notation without changing the precision it chose.
 * Choosing that precision is a per-instrument question (AGENTS.md, "Precision and
 * tolerance") and is deliberately not answered here.
 *
 * Two presentation rules:
 * - A small exponent is written out as a plain decimal when that needs no invented
 *   digits: 9.990000e-1 becomes 0.9990000, and 5.0e+1 becomes 50. 1.0e+3 stays
 *   scientific, because writing 1000 would claim four significant figures where the
 *   caller kept two.
 * - Signs use U+2212 MINUS SIGN, which all three site faces carry. The superscript
 *   block is NOT used for the exponent: Newsreader has no ⁵ to ⁹ and no ⁻, and
 *   JetBrains Mono has no ⁻, so an exponent written in those characters would be drawn
 *   in a fallback face. Renderers raise the exponent with markup instead.
 */

const MINUS = "−";

/** Exponents written out as plain decimals when the caller's digits allow it. */
const PLAIN_EXPONENT_LIMIT = 3;

export type ExponentialParts =
  | {
      /** A plain decimal, e.g. "0.9990000". No power of ten to draw. */
      readonly kind: "plain";
      readonly text: string;
    }
  | {
      /** Mantissa with its sign, e.g. "−2.070974". */
      readonly kind: "scientific";
      readonly mantissa: string;
      /** Signed exponent text, e.g. "−20" or "14". */
      readonly exponent: string;
    };

const withMinus = (text: string): string => text.replace(/^-/, MINUS);

/**
 * Splits `value.toExponential(fractionDigits)` into what a reader should see.
 * Non-finite values are passed through as text; refusing them is the caller's job.
 */
export function exponentialParts(value: number, fractionDigits?: number): ExponentialParts {
  if (!Number.isFinite(value)) return { kind: "plain", text: String(value) };
  const serialized =
    fractionDigits === undefined ? value.toExponential() : value.toExponential(fractionDigits);
  const [mantissaRaw = serialized, exponentRaw = "0"] = serialized.split("e");
  const exponent = Number(exponentRaw);
  if (exponent === 0) return { kind: "plain", text: withMinus(mantissaRaw) };

  const negative = mantissaRaw.startsWith("-");
  const unsigned = negative ? mantissaRaw.slice(1) : mantissaRaw;
  const [whole = unsigned, fraction = ""] = unsigned.split(".");
  const digits = whole + fraction;

  if (Math.abs(exponent) <= PLAIN_EXPONENT_LIMIT) {
    if (exponent < 0) {
      const text = `0.${"0".repeat(-exponent - 1)}${digits}`;
      return { kind: "plain", text: negative ? MINUS + text : text };
    }
    // A positive shift is plain only when every place it fills is a digit the caller kept.
    if (exponent <= fraction.length) {
      const integer = digits.slice(0, 1 + exponent);
      const rest = digits.slice(1 + exponent);
      const text = rest.length > 0 ? `${integer}.${rest}` : integer;
      return { kind: "plain", text: negative ? MINUS + text : text };
    }
  }
  return {
    kind: "scientific",
    mantissa: withMinus(mantissaRaw),
    exponent: exponent < 0 ? MINUS + String(-exponent) : String(exponent),
  };
}

/** Ordinary-language form for assistive technology: "2.07 times 10 to the power minus 20". */
export function exponentialSpoken(value: number, fractionDigits?: number): string {
  const parts = exponentialParts(value, fractionDigits);
  const say = (text: string) => text.replace(MINUS, "minus ");
  if (parts.kind === "plain") return say(parts.text);
  return `${say(parts.mantissa)} times 10 to the power ${say(parts.exponent)}`;
}

/**
 * One-line text for places that cannot hold markup (a `title`, an option label, a
 * data attribute a reader never sees): "2.070974 × 10^−20". Prefer the rendered forms.
 */
export function exponentialText(value: number, fractionDigits?: number): string {
  const parts = exponentialParts(value, fractionDigits);
  if (parts.kind === "plain") return parts.text;
  return `${parts.mantissa} × 10^${parts.exponent}`;
}

/**
 * A positive number known only through its natural logarithm, because it lies outside double
 * precision: lq-03's Wien tail far past its peak, or the classical density at a 10^300 Hz probe. It
 * printed as "below double-precision range; ln(value) = -9.598486147758314e+285 (natural log of
 * J s/m³)", which was also wrong in direction whenever the logarithm was positive.
 *
 * It is written the way every other number on the page is, as a mantissa and a power of ten, while
 * the fractional part of log10 still carries the mantissa's digits. A double holds about 15.9
 * significant digits, so once log10 needs more than 15 − (fractionDigits + 1) of them for its
 * integer part, the mantissa would be invented; past that only the exponent is known, and the
 * number is written as 10 raised to that exponent, itself in scientific form.
 */
export type NaturalLogParts =
  | {
      readonly kind: "scientific";
      readonly mantissa: string;
      readonly exponent: string;
    }
  | {
      /** 10 raised to this exponent, which is itself written in scientific form. */
      readonly kind: "power";
      readonly exponent: ExponentialParts;
    };

export function partsFromNaturalLog(ln: number, fractionDigits = 3): NaturalLogParts {
  const log10 = ln / Math.LN10;
  const limit = 10 ** (15 - (fractionDigits + 1));
  if (Math.abs(log10) < limit) {
    let exponent = Math.floor(log10);
    let mantissa = (10 ** (log10 - exponent)).toFixed(fractionDigits);
    // 9.9996 rounds to "10.000"; carry it into the exponent.
    if (Number(mantissa) >= 10) {
      exponent += 1;
      mantissa = (Number(mantissa) / 10).toFixed(fractionDigits);
    }
    return {
      kind: "scientific",
      mantissa,
      exponent: exponent < 0 ? MINUS + String(-exponent) : String(exponent),
    };
  }
  return { kind: "power", exponent: exponentialParts(log10, fractionDigits) };
}

export function naturalLogSpoken(ln: number, fractionDigits = 3): string {
  const parts = partsFromNaturalLog(ln, fractionDigits);
  const say = (text: string) => text.replace(MINUS, "minus ");
  if (parts.kind === "scientific")
    return `${parts.mantissa} times 10 to the power ${say(parts.exponent)}`;
  const e = parts.exponent;
  const inner =
    e.kind === "plain"
      ? say(e.text)
      : `${say(e.mantissa)} times 10 to the power ${say(e.exponent)}`;
  return `10 to the power ${inner}`;
}

/**
 * A bound written for text the laboratories render through withScripts: an exact power of ten of
 * 10^4 or more, or 10^−4 or less, is "10^{−24}", which withScripts raises; anything else is its plain
 * decimal with a true minus sign. Refusal messages printed their admission bounds as JavaScript
 * writes them: "1e-24 and 1000000", "within [1e-6, 1e6] ls", "between 1e-4 and 1e4".
 *
 * The test for an exact power reads toExponential's mantissa rather than comparing with 10 ** n,
 * which need not equal the literal (10 ** -24 is not 1e-24 in every engine).
 */
export function powerOfTenText(value: number): string {
  if (value !== 0 && Number.isFinite(value)) {
    const [mantissa, exponentText = "0"] = Math.abs(value).toExponential().split("e");
    const exponent = Number(exponentText);
    if (mantissa === "1" && Math.abs(exponent) >= 4)
      return `${value < 0 ? MINUS : ""}10^{${exponent < 0 ? MINUS : ""}${Math.abs(exponent)}}`;
  }
  return String(value).replace(/^-/, MINUS);
}
