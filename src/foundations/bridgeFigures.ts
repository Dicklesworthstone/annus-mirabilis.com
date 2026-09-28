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
