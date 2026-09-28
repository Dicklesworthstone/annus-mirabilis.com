/**
 * The numbers the five bridge figures draw (dispatch 401).
 *
 * The bridge lessons are the no-algebra route's first door, and each of these figures draws
 * something its lesson's prose had asked the reader to draw on paper. The numbers live here
 * rather than in the components so that the drawing and the lesson's own sentences cannot drift
 * apart: bridgeFigures.test.ts recomputes every derived value from the raw one beside it, so
 * changing a jar's height or a walker's step turns the arithmetic red instead of quietly leaving
 * a figure that disagrees with the paragraph above it.
 *
 * Nothing here is a physical law, so nothing here belongs to a kernel. It is the arithmetic a
 * reader is invited to check by counting: four jars, a steady walk, two rows of dots.
 */

/** Marbles in the four jars of foundation:bridge-sum-average, before they are poured together. */
export const JARS = [3, 1, 1, 3] as const;

/** Positions, in micrometres, where the four particles of foundation:bridge-a-graph end up. */
export const PARTICLE_ENDS = [-3, -1, 1, 3] as const;

/** The steady walk of foundation:bridge-a-graph: seconds elapsed and metres covered. */
export const WALK = [
  { seconds: 0, metres: 0 },
  { seconds: 10, metres: 14 },
  { seconds: 20, metres: 28 },
  { seconds: 30, metres: 42 },
  { seconds: 40, metres: 56 },
  { seconds: 50, metres: 70 },
  { seconds: 60, metres: 84 },
] as const;

/** The two groups of foundation:bridge-fractions-ratios: how many moved, out of how many. */
export const SHARES = [
  { moved: 1, group: 4 },
  { moved: 2, group: 8 },
] as const;

/**
 * The place-value ladder of foundation:bridge-scientific-notation-units. Each rung is a power of
 * ten of a metre; the named ones are the units the Brownian paper's §5 example is written in.
 */
export const PLACES = [
  { power: 0, name: "metre", symbol: "m" },
  { power: -1, name: null, symbol: null },
  { power: -2, name: "centimetre", symbol: "cm" },
  { power: -3, name: "millimetre", symbol: "mm" },
  { power: -4, name: null, symbol: null },
  { power: -5, name: null, symbol: null },
  { power: -6, name: "micrometre", symbol: "μm" },
] as const;

/** The displacement the Brownian paper's §5 example reaches after a minute, in metres. */
export const MINUTE_DISPLACEMENT = 6e-6;

/**
 * The same displacement in micrometres, and its square in m², as the lesson prints them. Declared
 * rather than computed at the point of display: 6e-6 * 6e-6 is 3.6000000000000005e-11 in double
 * precision, and a reader-facing figure must not print the sixteenth digit of a rounding error.
 * bridgeFigures.test.ts holds both to the arithmetic within a stated tolerance.
 */
export const MINUTE_DISPLACEMENT_MICROMETRES = 6;
export const MINUTE_DISPLACEMENT_SQUARED = 3.6e-11;
/** Its mantissa when the square is written as a multiple of 10⁻¹¹ m². */
export const MINUTE_DISPLACEMENT_SQUARED_MANTISSA = 3.6;

export const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

export const average = (values: readonly number[]): number => sum(values) / values.length;

/** Metres covered per second, from one pair of walk readings to the next. */
export function walkSpeeds(): readonly number[] {
  return WALK.slice(1).map((point, i) => {
    const previous = WALK[i] as (typeof WALK)[number];
    return (point.metres - previous.metres) / (point.seconds - previous.seconds);
  });
}

/** The share of a group that moved, as a plain number. */
export const shareOf = (row: { moved: number; group: number }): number => row.moved / row.group;

// The three figures of dispatch 409, on the same terms as the five above: the numbers live here so
// that a drawing and the paragraph it sits under cannot drift apart.

/**
 * The made-up account of foundation:bridge-equals-sign-relationship, in the lesson's own units: a
 * body starts with `before`, keeps `kept` and sends `sent` away as light. The figure draws the two
 * rows at one scale, so `kept + sent` must be `before` or the second row would overrun the first
 * and the picture would contradict the balance it exists to show.
 */
export const ACCOUNT = { before: 100, kept: 70, sent: 30 } as const;

/** Which half of the box a token landed in. The lesson's two tokens each take one of these. */
export type Half = "left" | "right";

/**
 * Every equally likely outcome of dropping `tokens` tokens, each into the left or the right half,
 * in the order foundation:bridge-probability-notation lists them: left and left, left and right,
 * right and left, right and right. There are 2^tokens of them and exactly one is all left, which
 * is where the lesson's 1/4 for two tokens and 1/16 for four come from. Generated rather than
 * typed, so the count and the list cannot disagree.
 */
export function outcomes(tokens: number): readonly (readonly Half[])[] {
  if (tokens <= 0) return [[]];
  return outcomes(tokens - 1).flatMap((rest) => [
    ["left" as Half, ...rest],
    ["right" as Half, ...rest],
  ]);
}

/**
 * The two tokens the lesson drops. The run of a hundred drops its second paragraph counts is not
 * here, because no figure draws it: 23 of 100 and a quarter of 100 land about 5 viewBox units
 * apart, which is roughly 6 px at a bridge figure's drawn width, so a reader would see the two as
 * the same at exactly the point the lesson says they differ.
 */
export const TOKENS = 2;

/**
 * The four displacements of foundation:bridge-squaring-square-roots, in micrometres. The same four
 * numbers as PARTICLE_ENDS, and deliberately a separate constant: they are the ends of a walk in
 * one lesson and the inputs to a mean square in the other, and either lesson may change its example
 * without the other following.
 */
export const DISPLACEMENTS = [-3, -1, 1, 3] as const;

/** The average of the squares: the mean square. */
export const meanSquare = (values: readonly number[]): number => average(values.map((v) => v * v));

/** The square root of the mean square: a typical distance, back in the original unit. */
export const rootMeanSquare = (values: readonly number[]): number => Math.sqrt(meanSquare(values));

// The flux figure of dispatch 418, and the first entry here for a lesson that is not a bridge. The
// module holds the numbers a lesson's FIGURE draws, whichever lesson that is; foundation:flux-
// continuity is one of the 31 of 45 lessons that rendered no figure at all, and at 1,909 visible
// characters with 22 formulas it was the shortest that is not a no-algebra bridge.

/**
 * The two seconds foundation:flux-continuity counts, exactly as its worked example prints them:
 * seven particles cross in and five cross out, then five and five. Everything the figure states
 * about them is derived below rather than typed, so the drawing cannot claim an accumulation the
 * crossings do not give.
 */
export const FLUX_SECONDS = [
  { entered: 7, left: 5 },
  { entered: 5, left: 5 },
] as const;

/** What the region gained: what came in less what went out. */
export const netChange = (second: { entered: number; left: number }): number =>
  second.entered - second.left;

/** How many particles crossed a boundary at all, in either direction. */
export const crossings = (second: { entered: number; left: number }): number =>
  second.entered + second.left;

// The diffusion figure of dispatch 419. foundation:diffusion-equation was 2,991 visible characters
// with 46 formulas and no picture, and its own prose describes a shape it never showed: "If the dye
// is thicker on both sides than at the spot itself, a dip, dye drifts in from both sides and the
// spot fills. If the spot is a peak ... The right-hand side is D times the curvature, which is
// positive at a dip and negative at a peak."

/**
 * A dye profile along the tube with one peak and one dip, as a fraction of the tube's length.
 * Curvature is negative at PEAK_AT and positive at DIP_AT, which is the sign the lesson's own
 * sentence turns on, so the drawing shows the case the prose names rather than a generic bump.
 */
export const PEAK_AT = 0.25;
export const DIP_AT = 0.75;
export const profileHeight = (fraction: number): number =>
  1 + 0.6 * Math.cos(2 * Math.PI * (fraction - PEAK_AT));

/** Its second derivative, up to a positive constant: the sign is all the lesson claims. */
export const profileCurvature = (fraction: number): number =>
  -Math.cos(2 * Math.PI * (fraction - PEAK_AT));

/** The spreading the lesson works: a typical distance of 1 mm after one minute. */
export const SPREAD = { minutes: 1, millimetres: 1 } as const;

/**
 * Typical distance grows as the square root of D times t, so doubling D multiplies it by about
 * 1.4 and quadrupling the time doubles it. Derived, never typed: the lesson's whole point is that
 * the mean square is what doubles and the distance is its square root.
 */
export const spreadAfter = (dFactor: number, tFactor: number): number =>
  SPREAD.millimetres * Math.sqrt(dFactor * tFactor);
