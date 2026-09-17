/**
 * Structured uncertainty kinds and rendering rules (am-ver-precision-display-5e5).
 *
 * Implements the six closed uncertainty kinds:
 * - standard (1-sigma standard error / uncertainty)
 * - coverage-95 (95% coverage interval / expanded uncertainty, k=2)
 * - bounds (strict physical or mathematical enclosure [lower, upper])
 * - estimate (order-of-magnitude or approximate value)
 * - discrete-count (exact integer count)
 * - exact-definition (exact defined constant, e.g. speed of light)
 */

import { formatCleanNumber, formatSignificantFigures } from "./format.ts";
import { spokenUnit } from "./spoken.ts";

export type UncertaintyKind =
  | "standard"
  | "coverage-95"
  | "bounds"
  | "estimate"
  | "discrete-count"
  | "exact-definition";

export type UncertaintySpec =
  | Readonly<{ kind: "standard"; value: number }>
  | Readonly<{ kind: "coverage-95"; value: number }>
  | Readonly<{ kind: "bounds"; lower: number; upper: number }>
  | Readonly<{ kind: "estimate" }>
  | Readonly<{ kind: "discrete-count" }>
  | Readonly<{ kind: "exact-definition"; definingRelation?: string }>;

export interface UncertaintyFormatOptions {
  readonly sigFigs?: number | undefined;
  readonly locale?: string | undefined;
}

/**
 * Formats an uncertainty specification into visible text.
 * Strictly separates statistical intervals from strict bounds/enclosures.
 */
export function formatUncertainty(
  spec: UncertaintySpec,
  options: UncertaintyFormatOptions = {},
): string {
  switch (spec.kind) {
    case "standard": {
      const formatted =
        options.sigFigs !== undefined
          ? formatSignificantFigures(spec.value, options.sigFigs, options)
          : formatCleanNumber(spec.value);
      return `± ${formatted}`;
    }
    case "coverage-95": {
      const formatted =
        options.sigFigs !== undefined
          ? formatSignificantFigures(spec.value, options.sigFigs, options)
          : formatCleanNumber(spec.value);
      return `± ${formatted} (95% coverage)`;
    }
    case "bounds": {
      const lower =
        options.sigFigs !== undefined
          ? formatSignificantFigures(spec.lower, options.sigFigs, options)
          : formatCleanNumber(spec.lower);
      const upper =
        options.sigFigs !== undefined
          ? formatSignificantFigures(spec.upper, options.sigFigs, options)
          : formatCleanNumber(spec.upper);
      return `[${lower}, ${upper}]`;
    }
    case "estimate":
      return "approx.";
    case "discrete-count":
      return "(exact count)";
    case "exact-definition":
      return spec.definingRelation
        ? `(exact: ${spec.definingRelation})`
        : "(exact by definition)";
  }
}

/**
 * Produces spoken text for screen readers without confusing bounds with probability distributions.
 */
export function spokenUncertainty(
  spec: UncertaintySpec,
  unit?: string,
  options: UncertaintyFormatOptions = {},
): string {
  switch (spec.kind) {
    case "standard": {
      const valStr =
        options.sigFigs !== undefined
          ? formatSignificantFigures(spec.value, options.sigFigs, options)
          : formatCleanNumber(spec.value);
      const unitStr = unit ? ` ${spokenUnit(unit, spec.value)}` : "";
      return `plus or minus ${valStr}${unitStr}`;
    }
    case "coverage-95": {
      const valStr =
        options.sigFigs !== undefined
          ? formatSignificantFigures(spec.value, options.sigFigs, options)
          : formatCleanNumber(spec.value);
      const unitStr = unit ? ` ${spokenUnit(unit, spec.value)}` : "";
      return `plus or minus ${valStr}${unitStr} at ninety-five percent confidence`;
    }
    case "bounds": {
      const lower =
        options.sigFigs !== undefined
          ? formatSignificantFigures(spec.lower, options.sigFigs, options)
          : formatCleanNumber(spec.lower);
      const upper =
        options.sigFigs !== undefined
          ? formatSignificantFigures(spec.upper, options.sigFigs, options)
          : formatCleanNumber(spec.upper);
      const unitStr = unit ? ` ${spokenUnit(unit, spec.upper)}` : "";
      return `bounded between ${lower} and ${upper}${unitStr}`;
    }
    case "estimate":
      return "approximately";
    case "discrete-count":
      return "exact count";
    case "exact-definition":
      return spec.definingRelation
        ? `exact by definition, ${spec.definingRelation}`
        : "exact by definition";
  }
}
