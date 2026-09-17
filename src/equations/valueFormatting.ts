/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: src/components/ui/equationValueFormatting.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Decoupled from patent types; exports standalone EquationValueFormat interface.
 * - Retained declarative telemetry formatting and validation with strict error strings.
 */

export interface EquationValueFormat {
  readonly style: "fixed";
  /** Decimal places accepted by Number.toFixed (0 through 20). */
  readonly fractionDigits: number;
  /** Multiplier applied before formatting; for example 1e-3 converts W to kW. */
  readonly scale?: number;
  readonly prefix?: string;
  readonly suffix?: string;
}

const MAX_FIXED_FRACTION_DIGITS = 20;
const NON_FINITE_TELEMETRY = "Unavailable — non-finite telemetry";
const INVALID_FORMAT = "Unavailable — invalid telemetry format";

export function validateEquationValueFormat(format: EquationValueFormat): readonly string[] {
  const errors: string[] = [];
  if (format.style !== "fixed") errors.push(`unsupported style ${String(format.style)}`);
  if (
    !Number.isInteger(format.fractionDigits) ||
    format.fractionDigits < 0 ||
    format.fractionDigits > MAX_FIXED_FRACTION_DIGITS
  ) {
    errors.push(`fractionDigits must be an integer from 0 through ${MAX_FIXED_FRACTION_DIGITS}`);
  }
  if (format.scale !== undefined && !Number.isFinite(format.scale)) {
    errors.push("scale must be finite when supplied");
  }
  if (format.prefix !== undefined && typeof format.prefix !== "string") {
    errors.push("prefix must be a string when supplied");
  }
  if (format.suffix !== undefined && typeof format.suffix !== "string") {
    errors.push("suffix must be a string when supplied");
  }
  return errors;
}

export function formatEquationTelemetryValue(
  rawValue: number,
  variable: {
    readonly unit: string;
    readonly valueFormat?: EquationValueFormat;
  },
): string {
  if (!Number.isFinite(rawValue)) return NON_FINITE_TELEMETRY;
  if (!variable.valueFormat) return `${rawValue.toFixed(2)} ${variable.unit}`.trim();
  if (validateEquationValueFormat(variable.valueFormat).length > 0) return INVALID_FORMAT;

  const scaled = rawValue * (variable.valueFormat.scale ?? 1);
  if (!Number.isFinite(scaled)) return NON_FINITE_TELEMETRY;
  return `${variable.valueFormat.prefix ?? ""}${scaled.toFixed(variable.valueFormat.fractionDigits)}${variable.valueFormat.suffix ?? ""}`;
}
