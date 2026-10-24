/**
 * Sensitivity analysis formatting and unit conversion rules.
 * (am-ver-precision-display-5e5)
 *
 * NO PRODUCTION MODULE IMPORTS THIS, AND THE ONE LIVE SENSITIVITY SAYS SOMETHING DIFFERENT ON
 * PURPOSE (am-50bk, triaged 2026-10-24). `src/experiments/avogadro/sensitivity.ts` shares the
 * word and not the job: it runs a study, varying one parameter and reporting a
 * `ScientificResult` per point, each with its own unit and no derivative to convert.
 *
 * The site's one displayed derivative is `src/components/foundations/NudgeSensitivityDemo.tsx`,
 * which prints the ratio ΔV/Δν and labels it `V·s`, explaining in its own prose that "volts
 * divided by hertz gives volt-seconds". `formatSensitivity` here would print `V/Hz`. Delegating
 * would replace a simplification the lesson is about with the unsimplified form, so the
 * duplication is this file rather than the demo, exactly as with `src/reader/Outline.tsx`.
 *
 * What is genuinely unmounted is `convertSensitivity`, which is AGENTS.md's "Unit conversions
 * apply to sensitivities as well as values" and has nothing to convert while one fixed unit pair
 * is the whole population. Note before wiring it: it handles length and time only and raises a
 * bare `Error`, which is the debt `src/testing/refusals/bareThrowsBaseline.json` records.
 */

import { type FormatNumberOptions, formatCleanNumber, formatSignificantFigures } from "./format.ts";

const LENGTH_SCALE_TO_METRES: Readonly<Record<string, number>> = {
  m: 1,
  cm: 1e-2,
  mm: 1e-3,
  μm: 1e-6,
  micron: 1e-6,
  microns: 1e-6,
  nm: 1e-9,
  pm: 1e-12,
};

const TIME_SCALE_TO_SECONDS: Readonly<Record<string, number>> = {
  s: 1,
  ms: 1e-3,
  μs: 1e-6,
  ns: 1e-9,
  ps: 1e-12,
  min: 60,
  h: 3600,
};

/**
 * Converts a sensitivity derivative dy/dx from one independent variable unit to another.
 * dy/dx_to = (dy/dx_from) * (dx_from / dx_to).
 */
export function convertSensitivity(
  sensitivity: number,
  fromUnitX: string,
  toUnitX: string,
): number {
  if (fromUnitX === toUnitX) return sensitivity;

  // Length conversion
  const scaleFromLength = LENGTH_SCALE_TO_METRES[fromUnitX];
  const scaleToLength = LENGTH_SCALE_TO_METRES[toUnitX];
  if (scaleFromLength !== undefined && scaleToLength !== undefined) {
    // If x_from is in m and x_to is in μm, 1 μm = 1e-6 m.
    // dy/d(μm) = dy/d(m) * 1e-6.
    return sensitivity * (scaleToLength / scaleFromLength);
  }

  // Time conversion
  const scaleFromTime = TIME_SCALE_TO_SECONDS[fromUnitX];
  const scaleToTime = TIME_SCALE_TO_SECONDS[toUnitX];
  if (scaleFromTime !== undefined && scaleToTime !== undefined) {
    // If t_from is in s and t_to is in ms, 1 ms = 1e-3 s.
    // dy/d(ms) = dy/d(s) * 1e-3.
    return sensitivity * (scaleToTime / scaleFromTime);
  }

  throw new Error(`Unsupported sensitivity unit conversion from "${fromUnitX}" to "${toUnitX}"`);
}

/**
 * Formats a sensitivity derivative with proper unit compounding.
 */
export function formatSensitivity(
  sensitivity: number,
  unitY: string,
  unitX: string,
  options: FormatNumberOptions = {},
): string {
  const numStr =
    options.sigFigs !== undefined
      ? formatSignificantFigures(sensitivity, options.sigFigs, options)
      : formatCleanNumber(sensitivity);

  const cleanUnitY = unitY && unitY !== "1" && unitY !== "dimensionless" ? unitY : "";
  const cleanUnitX = unitX && unitX !== "1" && unitX !== "dimensionless" ? unitX : "";

  let unitStr = "";
  if (cleanUnitY && cleanUnitX) {
    unitStr = ` ${cleanUnitY}/${cleanUnitX}`;
  } else if (cleanUnitY) {
    unitStr = ` ${cleanUnitY}`;
  } else if (cleanUnitX) {
    unitStr = ` 1/${cleanUnitX}`;
  }

  return `${numStr}${unitStr}`.trim();
}
