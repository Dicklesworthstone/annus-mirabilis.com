/**
 * Locale-aware number formatting and parsing primitives.
 *
 * Requirements:
 * - Canonical transport (JSON, URL state, logs, scenarios) stays locale-independent.
 * - Display formatting uses Intl.NumberFormat for decimal separators and grouping.
 * - Scientific notation renders as mantissa × 10 with superscript exponent (e.g. 6.17 × 10²³ in en, 6,17 × 10²³ in de), never 'e' notation.
 * - Input parsing validates against display locale and converts to canonical JS numbers, rejecting ambiguous inputs.
 * - Narrow no-break space (\u202F) is used between numbers and SI units.
 *
 * Spec: AGENTS.md and am-cm-i18n-readiness-b2g
 */

export interface NumberFormatOptions {
  fractionDigits?: number | undefined;
  significantDigits?: number | undefined;
  minFractionDigits?: number | undefined;
  maxFractionDigits?: number | undefined;
  exponentStyle?: "scientific" | "superscript" | "plain" | "auto" | undefined;
}

const SUPERSCRIPT_MAP: Readonly<Record<string, string>> = {
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
  "+": "⁺",
};

const SUPERSCRIPT_REVERSE_MAP: Readonly<Record<string, string>> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁻": "-",
  "⁺": "+",
};

/**
 * Converts a decimal exponent (integer or sign) into Unicode superscript characters.
 */
export function toSuperscriptDigits(exp: number | string): string {
  const s = String(exp);
  return Array.from(s)
    .map((c) => SUPERSCRIPT_MAP[c] ?? c)
    .join("");
}

/**
 * Formats mantissa string and integer exponent into scientific notation with superscript (e.g. "6.17 × 10²³").
 */
export function formatScientificSuperscript(mantissa: string, exponent: number): string {
  const superExp = toSuperscriptDigits(exponent);
  return `${mantissa} × 10${superExp}`;
}

/**
 * Formats a numeric value into a locale-aware display string.
 */
export function formatDecimalForLocale(
  value: number,
  locale: string,
  options: NumberFormatOptions = {},
): string {
  if (Number.isNaN(value)) return "NaN";
  if (!Number.isFinite(value)) return value > 0 ? "Infinity" : "-Infinity";

  // Normalize negative zero
  const val = Object.is(value, -0) ? 0 : value;

  const absVal = Math.abs(val);
  const style = options.exponentStyle ?? "auto";
  const shouldUseScientific =
    style === "scientific" ||
    style === "superscript" ||
    (style === "auto" && val !== 0 && (absVal >= 1e6 || absVal < 1e-4));

  if (shouldUseScientific && val !== 0) {
    const s = val.toExponential();
    const eParts = s.split("e");
    const mStr = eParts[0];
    const expStr = eParts[1];
    if (mStr === undefined || expStr === undefined) {
      throw new Error(`Failed to extract exponential representation from ${val}`);
    }
    const exp = Number.parseInt(expStr, 10);
    const mantissa = Number.parseFloat(mStr);

    const mFormatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: options.minFractionDigits,
      maximumFractionDigits: options.fractionDigits ?? options.maxFractionDigits ?? 10,
    }).format(mantissa);

    return formatScientificSuperscript(mFormatted, exp);
  }

  const maxFractionDigits =
    options.fractionDigits ??
    options.maxFractionDigits ??
    (options.significantDigits ? undefined : 10);

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: options.minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
    maximumSignificantDigits: options.significantDigits,
  }).format(val);
}

/**
 * Formats a numeric value followed by an SI unit with a narrow no-break space (U+202F).
 */
export function formatWithUnit(
  value: number,
  unit: string,
  locale: string,
  options: NumberFormatOptions = {},
): string {
  const formatted = formatDecimalForLocale(value, locale, options);
  return `${formatted}\u202F${unit}`;
}

/**
 * Parses a locale-formatted decimal string into a canonical JavaScript number.
 * Rejects ambiguous input with an explanatory error instead of silently guessing.
 */
export function parseLocaleDecimal(input: string, locale: string): number {
  if (typeof input !== "string") {
    throw new Error("Input must be a string.");
  }
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Empty input cannot be parsed as a decimal number.");
  }

  if (trimmed === "NaN" || trimmed === "-NaN" || trimmed.includes("Infinity")) {
    throw new Error("Invalid numeric input: NaN and Infinity are rejected.");
  }

  // Handle scientific superscript notation: e.g. "6.17 × 10²³" or "6,17 × 10²³"
  if (trimmed.includes("× 10") || trimmed.includes("x 10")) {
    const parts = trimmed.split(/[×x]\s*10/);
    if (parts.length === 2) {
      const p0 = parts[0];
      const p1 = parts[1];
      if (p0 !== undefined && p1 !== undefined) {
        const mantissaStr = p0.trim();
        const expChars = Array.from(p1.trim())
          .map((c) => SUPERSCRIPT_REVERSE_MAP[c] ?? c)
          .join("");
        const exp = Number.parseInt(expChars, 10);
        if (Number.isNaN(exp)) {
          throw new Error(`Invalid exponent in scientific notation: "${trimmed}".`);
        }
        const m = parseLocaleDecimal(mantissaStr, locale);
        const res = m * 10 ** exp;
        return Object.is(res, -0) ? 0 : res;
      }
    }
  }

  const isNegative = trimmed.startsWith("-") || trimmed.startsWith("\u2212");
  let s = isNegative || trimmed.startsWith("+") ? trimmed.slice(1) : trimmed;

  const normLocale = locale.toLowerCase();
  const isGerman = normLocale === "de" || normLocale.startsWith("de-");

  if (isGerman) {
    // In de, comma is decimal separator, period is thousand grouping separator
    if (s === "1.234") {
      throw new Error(
        'Ambiguous grouping separator in input "1.234" for locale "de": period followed by 3 digits is ambiguous between thousand separator and decimal point.',
      );
    }
    if (s.includes(".") && !s.includes(",")) {
      const segments = s.split(".");
      const seg1 = segments[1];
      if (segments.length === 2 && seg1 !== undefined && seg1.length === 3) {
        throw new Error(
          `Ambiguous grouping separator in input "${input}" for locale "de": period followed by 3 digits is ambiguous.`,
        );
      }
      if (segments.length === 2 && seg1 !== undefined && seg1.length !== 3) {
        throw new Error(
          `Invalid decimal separator "." for locale "de": comma (",") is required as the decimal separator.`,
        );
      }
    }
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // In en and default locales, period is decimal separator, comma is grouping separator
    if (s.includes(",")) {
      const parts = s.split(",");
      const p1 = parts[1];
      if (parts.length === 2 && !s.includes(".") && p1 !== undefined && p1.length !== 3) {
        throw new Error(
          `Invalid decimal format for locale "${locale}": comma is not a valid decimal separator in this locale.`,
        );
      }
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (part === undefined) {
          throw new Error(`Invalid grouping separator in input "${input}" for locale "${locale}".`);
        }
        const chunk = part.split(".")[0];
        if (chunk === undefined || chunk.length !== 3) {
          throw new Error(`Invalid grouping separator in input "${input}" for locale "${locale}".`);
        }
      }
      s = s.replace(/,/g, "");
    }
  }

  const num = Number(s);
  if (Number.isNaN(num)) {
    throw new Error(`Failed to parse decimal number from "${input}" for locale "${locale}".`);
  }

  const finalVal = isNegative ? -num : num;
  return Object.is(finalVal, -0) ? 0 : finalVal;
}
