/**
 * Sensitivity analysis formatting and unit conversion rules.
 * (am-ver-precision-display-5e5)
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
