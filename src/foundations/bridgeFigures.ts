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

import { erf } from "../physics/reference/special/erf.ts";

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

// The random-walk figure of dispatch 419. foundation:random-walks was listed in the sweep as
// having 2 svg, and both turned out to be KaTeX radical glyphs inside its formulas
// (width="400em", viewBox="0 0 400000 1944"), so it had no figure at all.

/** Where the four equally likely two-step coin walks end, in metres, as the lesson lists them. */
export const TWO_STEP_ENDS = [2, 0, 0, -2] as const;

/** The typical size of one step of the coin walk, in metres. */
export const STEP_METRES = 1;

/**
 * The typical distance from the start after n steps: the square root of the mean square, which is
 * n step-squares. Derived, because the lesson exists to say that this is a square root and not a
 * sum: 1 m after one step, about 1.4 after two, 10 after a hundred, 20 after four hundred.
 */
export const typicalDistance = (steps: number): number => STEP_METRES * Math.sqrt(steps);

/** The step counts the figure marks, chosen so their typical distances are whole metres. */
export const STEP_MARKS = [1, 4, 9, 16] as const;

// The Gaussian figure of dispatch 420. foundation:gaussian-distributions was 6,747 characters
// about the shape of a distribution, with five inline svg that are all square-root signs and no
// picture of the shape.

/** The widths the lesson bands, in root-mean-square widths from the start. */
export const WIDTH_BANDS = [1, 2, 3] as const;

/**
 * The chance of ending within k widths of the start, as a percentage. Read from the erf owner
 * rather than typed: foundSlice.numbers.test.ts already holds the lesson's printed 68, 95 and
 * 99.7 to this same function, so the figure and that check cannot disagree about what the bands
 * are worth.
 */
export const withinWidths = (k: number): number => 100 * erf(k / Math.SQRT2);

/** The height of the unit-width bell at x widths, with its peak at 1. */
export const bellHeight = (widths: number): number => Math.exp(-(widths * widths) / 2);

// The density figure of dispatch 420. foundation:distributions was 3,950 visible characters on
// the difference between a density and a probability, with no authored figure.

/** The bin foundation:distributions counts: 30 of 100 particles in a 2 micrometre bin. */
export const BIN = { particles: 100, inBin: 30, micrometres: 2 } as const;

/** What the bin holds. A probability belongs to an interval, so this is the bin's own number. */
export const binProbability = (): number => BIN.inBin / BIN.particles;

/**
 * The density there, per micrometre and per metre. The same bin measured two ways: the height
 * changes with the unit of length and the probability does not, which is the lesson's first claim.
 */
export const binDensityPerMicrometre = (): number => binProbability() / BIN.micrometres;
export const binDensityPerMetre = (): number => binDensityPerMicrometre() * 1e6;

/** The two spans the worked example spreads one unit of probability over, in micrometres. */
export const FLAT_SPANS = [4, 2] as const;

/** A flat density holding all the probability over that span: taller when the span is narrower. */
export const flatDensity = (micrometres: number): number => 1 / micrometres;

// The integration figure of dispatch 421. foundation:integration had no construction at all, and
// its mechanism is an instruction to picture something: "cut the line into narrow strips ... Add
// the strips, then cut them narrower and add again."

// The square foundation:taylor-expansion tells the reader to picture (dispatch 433).

/** The square foundation:taylor-expansion grows, and the steps it grows by. */
export const SQUARE_SIDE = 2;
export const SQUARE_STEPS = [0.1, 0.5, 2] as const;

/** Keeping the value and the slope term only: the two strips, and no corner. */
export const linearEstimate = (step: number): number =>
  SQUARE_SIDE * SQUARE_SIDE + 2 * SQUARE_SIDE * step;

/** The whole grown square. */
export const exactSquare = (step: number): number => (SQUARE_SIDE + step) * (SQUARE_SIDE + step);

/**
 * The corner the linear estimate drops, which is the step squared. DECLARED as well as derived,
 * because 0.1 * 0.1 is 0.010000000000000002 in double precision and a reader-facing figure must
 * not print the seventeenth digit of a rounding error. bridgeFigures.test.ts holds each printed
 * value to the arithmetic through withinTolerance().
 */
export const droppedCorner = (step: number): number => step * step;
export const PRINTED_CORNERS = [0.01, 0.25, 4] as const;

/** The density foundation:integration adds up: it rises from 0 to 0.5 per micrometre over 4 μm. */
export const RAMP = { micrometres: 4, topDensity: 0.5 } as const;
export const rampDensity = (micrometres: number): number =>
  (RAMP.topDensity / RAMP.micrometres) * micrometres;

/** The triangle's whole area, which is one because the particle has to be somewhere. */
export const rampArea = (): number => 0.5 * RAMP.micrometres * RAMP.topDensity;

/** The strip counts the lesson cuts the stretch into. */
export const STRIP_COUNTS = [4, 8] as const;

/** A left-edge strip sum: each strip takes the height at its own left edge. */
export const stripSum = (strips: number): number => {
  const width = RAMP.micrometres / strips;
  let total = 0;
  for (let i = 0; i < strips; i += 1) total += rampDensity(i * width) * width;
  return total;
};

// The derivative figure of dispatch 437. foundation:derivatives says "shorten the interval and
// watch what happens" and "on a graph of position against time, the derivative at a point is the
// steepness of the curve there", and its construction draws no curve at all.

/** The rolling ball of foundation:derivatives: it has gone 3t² metres after t seconds. */
export const BALL = { coefficient: 3, atSeconds: 1 } as const;
export const ballPosition = (seconds: number): number => BALL.coefficient * seconds * seconds;

/** The shrinking intervals the lesson averages over. */
export const NUDGES = [1, 0.1, 0.01, 0.001] as const;

/** The average speed over one of them, which is 6 + 3Δt and settles on 6. */
export const averageSpeed = (nudge: number): number =>
  (ballPosition(BALL.atSeconds + nudge) - ballPosition(BALL.atSeconds)) / nudge;

/** The speed at the instant itself, the value the averages close in on. */
export const INSTANT_SPEED = 2 * BALL.coefficient * BALL.atSeconds;

/**
 * What the lesson PRINTS for each interval. Declared as well as derived: in double precision the
 * average over 0.1 s comes out as 6.300000000000008 and the position as 3.630000000000001, and a
 * reader-facing figure must not show the fifteenth digit of a rounding error. bridgeFigures.test.ts
 * holds each of these to the arithmetic through withinTolerance().
 */
export const PRINTED_SPEEDS = [9, 6.3, 6.03, 6.003] as const;
export const PRINTED_POSITIONS = [12, 3.63, 3.0603, 3.006003] as const;

// The synchrony figure of dispatch 440. foundation:frames-events is §1's clock rule inside ONE
// frame, not simultaneity between two, so its figure is a signal exchange between two clocks and
// imports no spacetime geometry: no axes, no light cone, no second observer.

/** The round trip §1 uses to set a distant clock, in seconds on clock A. */
export const SYNC = { leaves: 0, returns: 10 } as const;

/** When the flash turned round, by the rule: half way between leaving and returning. */
export const reflectionTime = (): number => (SYNC.leaves + SYNC.returns) / 2;

/** What a clock two seconds fast reads at that same moment, and the correction it needs. */
export const FAST_READING = 7;
export const fastBy = (): number => FAST_READING - reflectionTime();

/** The distance the lesson supposes, in metres, and the speed the same trip then gives. */
export const SIGNAL_DISTANCE = 1.5e9;
export const signalSpeed = (): number => (2 * SIGNAL_DISTANCE) / (SYNC.returns - SYNC.leaves);

// The three-averages figure of dispatch 444. foundation:mean-variance-rms asks which average shows
// how far particles got, and answers with three. meanSquare() and rootMeanSquare() are already
// here from the squaring bridge, so only the third statistic and its printed rounding are new.

/** The average of the distances, ignoring sign: the third of the lesson's three answers. */
export const meanDistance = (values: readonly number[]): number =>
  average(values.map((v) => Math.abs(v)));

/**
 * The RMS of the lesson's four displacements as it PRINTS it. The exact value is the square root
 * of 5, which has no finite decimal, so the figure shows the rounding the lesson shows and
 * bridgeFigures.test.ts holds it to the square root through withinTolerance().
 */
export const PRINTED_RMS = 2.236;

// The underdetermination figure of dispatch 444. foundation:error-and-inference opens with a
// rectangle whose area is known and whose sides are not, and draws nothing.

/** The area the lesson knows, in square centimetres, and three pairs of sides that give it. */
export const RECTANGLE_AREA = 12;
export const RECTANGLE_SIDES = [
  [3, 4],
  [2, 6],
  [1, 12],
] as const;

/** The area a pair of sides encloses: the one thing the measurement fixes. */
export const rectangleArea = (sides: readonly [number, number]): number => sides[0] * sides[1];
