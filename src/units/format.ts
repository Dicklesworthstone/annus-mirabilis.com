/**
 * Precision and number formatting rules (am-ver-precision-display-5e5 / am-a11y-graph-descriptions-vxe1).
 *
 * Formats canonical numbers into human-readable strings with controlled significant figures,
 * suppressed floating-point noise, and explicit constant-set labels where applicable.
 */

export interface FormatNumberOptions {
  readonly sigFigs?: number | undefined;
  readonly maxDecimals?: number | undefined;
  readonly locale?: string | undefined;
  readonly notation?: "standard" | "scientific" | "auto" | undefined;
  readonly guardDigit?: boolean | undefined;
}

export interface FormatQuantityOptions extends FormatNumberOptions {
  readonly constantSetId?: string | undefined;
  readonly constantSetLabel?: string | undefined;
}

/**
 * Suppresses IEEE-754 floating point representation artifacts (e.g. 0.30000000000000004 -> "0.3").
 */
export function formatCleanNumber(val: number, maxDecimals = 12): string {
  if (!Number.isFinite(val)) return String(val);
  if (val === 0) return "0";

  const absVal = Math.abs(val);
  if (absVal < 1e-4 || absVal >= 1e6) {
    const expStr = val.toExponential(Math.min(maxDecimals, 6));
    return expStr.replace(/e\+?/, " × 10^");
  }

  const str = val.toFixed(maxDecimals);
  return str.replace(/\.?0+$/, "");
}

/**
 * Formats a number to a declared count of significant figures.
 */
export function formatSignificantFigures(
  val: number,
  sigFigs: number,
  options: FormatNumberOptions = {},
): string {
  if (!Number.isFinite(val)) return String(val);
  if (val === 0) return "0";

  const effectiveFigs = options.guardDigit ? sigFigs + 1 : sigFigs;
  const clampedFigs = Math.max(1, Math.min(20, effectiveFigs));

  const absVal = Math.abs(val);
  const notation = options.notation ?? "auto";

  if (notation === "scientific" || (notation === "auto" && (absVal >= 1e6 || absVal < 1e-4))) {
    const expStr = val.toExponential(clampedFigs - 1);
    return expStr.replace(/e\+?/, " × 10^");
  }

  const precStr = val.toPrecision(clampedFigs);
  // Avoid scientific notation if standard was preferred and number is within moderate bounds
  if (notation === "standard" && precStr.includes("e")) {
    return val.toFixed(Math.max(0, clampedFigs - Math.floor(Math.log10(absVal)) - 1));
  }
  return precStr;
}

/**
 * Formats a quantity value with its unit and optional constant-set notation.
 */
export function formatQuantityValue(
  value: number,
  unit: string,
  options: FormatQuantityOptions = {},
): string {
  if (!Number.isFinite(value)) return `${value} ${unit}`.trim();

  let numStr: string;
  if (options.sigFigs !== undefined) {
    numStr = formatSignificantFigures(value, options.sigFigs, options);
  } else {
    numStr = formatCleanNumber(value, options.maxDecimals ?? 6);
  }

  const unitPart = unit && unit !== "dimensionless" && unit !== "1" ? ` ${unit}` : "";
  const constantPart = options.constantSetLabel ? ` (${options.constantSetLabel})` : "";

  return `${numStr}${unitPart}${constantPart}`;
}
