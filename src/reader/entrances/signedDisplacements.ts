/**
 * Pure arithmetic module for signed displacements and their statistics.
 *
 * Shared across the visual, keyboard, and table interfaces of the no-algebra
 * first encounters.
 *
 * Spec: am-bm-first-encounter-fjvh and AGENTS.md
 */

export interface SignedDisplacementTotals {
  readonly count: number;
  readonly signedSum: number;
  readonly meanSigned: number;
  readonly meanAbsolute: number;
  readonly meanSquare: number;
  readonly rootMeanSquare: number;
}

export const AUTHORED_BROWNIAN_DISPLACEMENTS: readonly number[] = Object.freeze([-3, -1, 1, 3]);
export const DOUBLED_BROWNIAN_DISPLACEMENTS: readonly number[] = Object.freeze([-6, -2, 2, 6]);
export const FOUR_ENTRY_BOUND = 4 as const;

/**
 * Normalizes a number to prevent negative-zero (-0) display anomalies.
 */
function cleanZero(val: number): number {
  return Object.is(val, -0) || Math.abs(val) < 1e-12 ? 0 : val;
}

/**
 * Calculates signed sum, mean signed displacement, mean absolute displacement,
 * mean square displacement, and root-mean-square (RMS) displacement for a set of values.
 */
export function calculateSignedDisplacements(entries: readonly number[]): SignedDisplacementTotals {
  const n = entries.length;
  if (n === 0) {
    return {
      count: 0,
      signedSum: 0,
      meanSigned: 0,
      meanAbsolute: 0,
      meanSquare: 0,
      rootMeanSquare: 0,
    };
  }

  let sum = 0;
  let absSum = 0;
  let sqSum = 0;

  for (let i = 0; i < n; i++) {
    const rawVal = entries[i];
    const val = typeof rawVal === "number" && !Number.isNaN(rawVal) ? cleanZero(rawVal) : 0;
    sum += val;
    absSum += Math.abs(val);
    sqSum += val * val;
  }

  const signedSum = cleanZero(sum);
  const meanSigned = cleanZero(sum / n);
  const meanAbsolute = cleanZero(absSum / n);
  const meanSquare = cleanZero(sqSum / n);
  const rootMeanSquare = cleanZero(Math.sqrt(meanSquare));

  return {
    count: n,
    signedSum,
    meanSigned,
    meanAbsolute,
    meanSquare,
    rootMeanSquare,
  };
}

/**
 * Scales every displacement by a constant factor (e.g. 2 for the doubled example).
 */
export function scaleDisplacements(entries: readonly number[], factor: number): readonly number[] {
  return Object.freeze(entries.map((x) => cleanZero(x * factor)));
}

/**
 * Formats a displacement with explicit sign (+3, -3, 0).
 */
export function formatSignedDisplacement(value: number): string {
  const val = cleanZero(value);
  if (val > 0) {
    return `+${val}`;
  }
  return `${val}`;
}

/**
 * Verbal description of displacement steps (e.g. "three steps left, one left, one right, three right").
 */
export function describeDisplacementInWords(value: number): string {
  const val = cleanZero(value);
  const absVal = Math.abs(val);
  const numWord =
    absVal === 1
      ? "one"
      : absVal === 2
        ? "two"
        : absVal === 3
          ? "three"
          : absVal === 4
            ? "four"
            : absVal === 5
              ? "five"
              : absVal === 6
                ? "six"
                : `${absVal}`;

  const stepWord = absVal === 1 ? "step" : "steps";

  if (val === 0) {
    return "at the starting point";
  }
  if (val < 0) {
    return `${numWord} ${stepWord} left`;
  }
  return `${numWord} ${stepWord} right`;
}
