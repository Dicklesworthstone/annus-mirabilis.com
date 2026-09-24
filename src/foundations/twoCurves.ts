/**
 * The two-measurements lesson's construction (am-found-statistics-inference-pzqv): the plane of
 * radius a and molecular number N, on logarithmic axes, in units of the true values.
 *
 * Diffusion fixes the product N·a, so on these axes its measurement is a straight band of slope
 * −1, as wide as the measurement's stated spread. A second measurement that fixes a^k·N is a band
 * of slope −k. The pairs that fit both lie where the bands overlap: a parallelogram whose width
 * in ln a is (s₁ + s₂)/(k − 1). As k approaches 1 the bands turn parallel and the overlap runs off
 * to infinity; at k = 1 no crossing exists, and the radius is not determined.
 *
 * This is geometry in units of the true values, not a physical law: the dissertation's
 * viscosity measurement is the case k = 3. The region is the overlap of the stated spreads, an
 * enclosure, not a probability.
 */
import type { ScientificResult } from "../experiments/results/types.ts";

/** The second measurement's exponent of a: 3 is the dissertation's viscosity measurement. */
export const EXPONENT_CHOICES = [3, 2, 1.5, 1.2, 1] as const;
/** Each measurement's stated spread, as a fraction of its value. */
export const SPREAD_CHOICES = [0.02, 0.05, 0.1] as const;

/**
 * Half-width of the drawing in ln units: the plane runs from two thirds to one and a half times
 * the truth, close enough in that the overlap at k = 3 and a 5 per cent spread is wider than the
 * ring that marks the true pair.
 */
export const PLANE_HALF_WIDTH = Math.log(1.5);

export type TwoCurvesInput = Readonly<{
  /** Whether the second measurement has been made. */
  second: boolean;
  exponent: number;
  spread: number;
}>;

/** A corner of the overlap, in ln(a / true a) and ln(N / true N). */
export type Point = Readonly<{ x: number; y: number }>;

export type TwoCurvesOutcome =
  | Readonly<{
      status: "curve";
      /** The radius, asked for alone: a typed underdetermined result. */
      radius: ScientificResult;
    }>
  | Readonly<{
      status: "region";
      radius: ScientificResult;
      /** The overlap of the two bands, four corners in order. */
      corners: readonly Point[];
      /** Largest and smallest radius and number in the overlap, as multiples of the truth. */
      radiusFactor: Readonly<{ low: number; high: number }>;
      numberFactor: Readonly<{ low: number; high: number }>;
      /** Whether part of the overlap lies beyond the drawing. */
      clipped: boolean;
    }>
  | Readonly<{ status: "refused"; message: string }>;

const IDENTITY = {
  quantityId: "radiusOverTrueRadius",
  unit: "1",
  semanticKind: "radius-ratio",
  ownerId: "foundations.twoCurves",
} as const;

/** The radius from what has been measured: a value with its enclosure, or not determined. */
export function radiusFrom(input: TwoCurvesInput): ScientificResult {
  if (!input.second || input.exponent === 1)
    return {
      ...IDENTITY,
      status: "underdetermined",
      compatibleFamily: input.second
        ? "Both measurements fix the same combination N·a, so every radius on the band fits both."
        : "Every radius on the band N·a = constant fits, each with its own N.",
      neededInformation: [
        "A second measurement that fixes a different combination of a and N, such as a³N.",
      ],
    };
  const half = (2 * input.spread) / (input.exponent - 1);
  return {
    ...IDENTITY,
    status: "value",
    value: 1,
    uncertainty: {
      kind: "enclosure",
      lower: Math.exp(-half),
      upper: Math.exp(half),
      method: "the overlap of the two measurements' stated spreads",
    },
  };
}

/** Where the two bands overlap, for a spread s on both measurements and exponent k. */
export function twoCurves(input: TwoCurvesInput): TwoCurvesOutcome {
  const { exponent: k, spread: s } = input;
  if (!Number.isFinite(k) || k < 1 || k > 4)
    return { status: "refused", message: "The exponent is chosen between 1 and 4." };
  if (!Number.isFinite(s) || s <= 0 || s > 0.5)
    return { status: "refused", message: "The spread is chosen between 0 and 50 percent." };
  const radius = radiusFrom(input);
  if (radius.status !== "value") return { status: "curve", radius };
  // The overlap of |y + x| ≤ s and |y + kx| ≤ s: each corner meets one edge of each band.
  const corner = (s1: number, s2: number): Point => {
    const x = (s2 - s1) / (k - 1);
    return { x, y: s1 - x };
  };
  const corners = [corner(s, s), corner(-s, s), corner(-s, -s), corner(s, -s)];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const extent = Math.max(...xs.map(Math.abs), ...ys.map(Math.abs));
  return {
    status: "region",
    radius,
    corners,
    radiusFactor: { low: Math.exp(Math.min(...xs)), high: Math.exp(Math.max(...xs)) },
    numberFactor: { low: Math.exp(Math.min(...ys)), high: Math.exp(Math.max(...ys)) },
    clipped: extent > PLANE_HALF_WIDTH,
  };
}
