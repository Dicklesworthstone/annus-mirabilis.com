/**
 * Precision and number formatting rules (am-ver-precision-display-5e5 / am-a11y-graph-descriptions-vxe1).
 *
 * Formats canonical numbers into human-readable strings with controlled significant figures,
 * suppressed floating-point noise, locale-aware presentation, guard digit marking, and explicit constant-set labels.
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

export interface ConstantSetDependentValue {
  readonly value: number;
  readonly constantSetId: string;
  readonly unit: string;
  readonly constantSetLabel?: string | undefined;
}

export interface GuardDigitResult {
  readonly mainText: string;
  readonly guardDigit: string;
  readonly formatted: string;
  readonly spokenText: string;
}

/**
 * Applies locale-specific formatting (e.g. decimal comma in de-DE) without altering the transported numeric value.
 */
export function applyLocale(numStr: string, locale?: string): string {
  if (!locale || locale.startsWith("en")) return numStr;
  if (locale.startsWith("de")) {
    // Replace decimal dot with comma, keeping scientific notation intact
    return numStr.replace(/(\d+)\.(\d+)/g, "$1,$2");
  }
  return numStr;
}

/**
 * Suppresses IEEE-754 floating point representation artifacts (e.g. 0.30000000000000004 -> "0.3").
 */
export function formatCleanNumber(val: number, maxDecimals = 12, locale?: string): string {
  if (!Number.isFinite(val)) return String(val);
  if (val === 0) return "0";

  const absVal = Math.abs(val);
  if (absVal < 1e-4 || absVal >= 1e6) {
    const expStr = val.toExponential(Math.min(maxDecimals, 6));
    const cleanExp = expStr.replace(/e\+?/, " × 10^");
    return applyLocale(cleanExp, locale);
  }

  const str = val.toFixed(maxDecimals);
  const clean = str.replace(/\.?0+$/, "");
  return applyLocale(clean, locale);
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
    const cleanExp = expStr.replace(/e\+?/, " × 10^");
    return applyLocale(cleanExp, options.locale);
  }

  const precStr = val.toPrecision(clampedFigs);
  if (notation === "standard" && precStr.includes("e")) {
    const fixed = val.toFixed(Math.max(0, clampedFigs - Math.floor(Math.log10(absVal)) - 1));
    return applyLocale(fixed, options.locale);
  }
  return applyLocale(precStr, options.locale);
}

/**
 * Formats a value with a marked guard digit.
 * The guard digit is an extra digit of precision distinguished for calculation audit.
 */
export function formatGuardDigit(
  val: number,
  sigFigs: number,
  options: FormatNumberOptions = {},
): GuardDigitResult {
  const fullText = formatSignificantFigures(val, sigFigs, { ...options, guardDigit: true });
  // The last character before any exponent/unit is the guard digit
  const match = fullText.match(/^([\d.,]+?)(\d)(.*)$/);
  if (match && match[1] && match[2]) {
    const mainText = match[1];
    const guardDigit = match[2];
    const suffix = match[3] ?? "";
    return {
      mainText,
      guardDigit,
      formatted: `${mainText}${guardDigit}${suffix}`,
      spokenText: `${mainText}${guardDigit}${suffix}`,
    };
  }
  return {
    mainText: fullText,
    guardDigit: "",
    formatted: fullText,
    spokenText: fullText,
  };
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
    numStr = formatCleanNumber(value, options.maxDecimals ?? 6, options.locale);
  }

  const unitPart = unit && unit !== "dimensionless" && unit !== "1" ? ` ${unit}` : "";
  const constantPart = options.constantSetLabel
    ? ` (${options.constantSetLabel})`
    : options.constantSetId
      ? ` (${options.constantSetId})`
      : "";

  return `${numStr}${unitPart}${constantPart}`;
}

/**
 * Formats a constant-set-dependent value.
 * Requires `constantSetId` in the input type; omitted constantSetId fails compile time.
 */
export function formatConstantSetDependentValue(
  item: ConstantSetDependentValue,
  options: FormatNumberOptions = {},
): string {
  return formatQuantityValue(item.value, item.unit, {
    ...options,
    constantSetId: item.constantSetId,
    constantSetLabel: item.constantSetLabel,
  });
}

/**
 * Formats a comparison between historical and modern constant-set evaluations.
 */
export function formatConstantSetComparison(
  historicalVal: number,
  modernVal: number,
  unit: string,
  options: FormatNumberOptions = {},
): string {
  const hStr = formatSignificantFigures(historicalVal, options.sigFigs ?? 3, options);
  const mStr = formatSignificantFigures(modernVal, options.sigFigs ?? 3, options);
  const unitStr = unit && unit !== "1" ? ` ${unit}` : "";
  return `${hStr} vs. ${mStr}${unitStr} (below input precision)`;
}
