/**
 * The scaling construction of foundation:ratios-scaling (am-found-quantities-magnitudes-igxe):
 * multiply a length by k and see what happens to an area, a volume and a diffusing particle's
 * spread. Pure and throw-free; a factor that cannot be used comes back as a typed refusal.
 */
import { readTypedNumber } from "./unitConversions.ts";

/** The slider's teaching range. A typed factor may go further, within FACTOR_DOMAIN. */
export const FACTOR_SLIDER = { min: 0.5, max: 5, step: 0.5 } as const;

/** The typed field's domain. Beyond it the factors stop fitting on a line; the pattern does not change. */
export const FACTOR_DOMAIN = { min: 0.001, max: 1000 } as const;

/**
 * The Brownian paper's spread in one second, in micrometres, to four figures: the value
 * einstein-1905-brownian-printed records as rmsDisplacement1d (0.7947833 μm), which the paper
 * prints as "0,8 Mikron". foundQuantities.scaling.test.ts checks the two agree.
 */
export const PAPER_SPREAD_UM = 0.7948;

export type ScalingOutcome =
  | {
      readonly status: "scaled";
      readonly k: number;
      readonly length: number;
      readonly area: number;
      readonly volume: number;
      /** Spread after k times as long: √k. */
      readonly spreadLongerTime: number;
      /** Spread with k times the radius, or k times the viscosity: 1/√k. */
      readonly spreadLargerRadius: number;
      /** The paper's 0.7948 μm, after k seconds instead of one. */
      readonly paperSpreadLongerTimeUm: number;
      /** The paper's 0.7948 μm, for a sphere k times the paper's radius, in one second. */
      readonly paperSpreadLargerRadiusUm: number;
    }
  | { readonly status: "refused"; readonly message: string };

export const SCALING_REFUSALS = {
  empty: "Type a scale factor, for example 2 or 0,5.",
  unreadable: "The construction cannot read that as a number. Write it like 2, 1.5 or 1,5.",
  "not-positive":
    "A scale factor must be larger than zero: a length cannot shrink to nothing or turn negative.",
  "out-of-range": `Choose a factor between ${FACTOR_DOMAIN.min} and ${FACTOR_DOMAIN.max}.`,
} as const;

const refused = (reason: keyof typeof SCALING_REFUSALS): ScalingOutcome => ({
  status: "refused",
  message: SCALING_REFUSALS[reason],
});

/** Scales by a factor already known as a number. */
export function scaleBy(k: number): ScalingOutcome {
  if (!Number.isFinite(k)) return refused("out-of-range");
  if (k <= 0) return refused("not-positive");
  if (k < FACTOR_DOMAIN.min || k > FACTOR_DOMAIN.max) return refused("out-of-range");
  const root = Math.sqrt(k);
  return {
    status: "scaled",
    k,
    length: k,
    area: k ** 2,
    volume: k ** 3,
    spreadLongerTime: root,
    spreadLargerRadius: 1 / root,
    paperSpreadLongerTimeUm: PAPER_SPREAD_UM * root,
    paperSpreadLargerRadiusUm: PAPER_SPREAD_UM / root,
  };
}

/** Scales by what a reader typed. */
export function scaleByTyped(text: string): ScalingOutcome {
  if (text.trim() === "") return refused("empty");
  const read = readTypedNumber(text);
  if (read.kind === "unreadable") return refused("unreadable");
  if (read.kind === "out-of-range") return refused("out-of-range");
  return scaleBy(read.value);
}

/**
 * A factor as text to four significant figures, the precision the lesson prints: 1.414, 0.7071,
 * 0.5620. A whole number stays whole (4, 8), because k² and k³ of a whole k are exact. The
 * component draws numbers outside 10⁻³ to 10⁵ in powers of ten instead.
 */
export const fourFigures = (x: number): string =>
  Number.isInteger(x) ? String(x) : x.toPrecision(4);
