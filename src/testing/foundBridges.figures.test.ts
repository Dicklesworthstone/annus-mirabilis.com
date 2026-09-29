import { describe, expect, test } from "bun:test";
import {
  average,
  averageSpeed,
  BALL,
  ballPosition,
  INSTANT_SPEED,
  JARS,
  MINUTE_DISPLACEMENT,
  MINUTE_DISPLACEMENT_MICROMETRES,
  MINUTE_DISPLACEMENT_SQUARED,
  MINUTE_DISPLACEMENT_SQUARED_MANTISSA,
  meanDistance,
  meanSquare,
  NUDGES,
  PARTICLE_ENDS,
  PLACES,
  PRINTED_POSITIONS,
  PRINTED_RMS,
  PRINTED_SPEEDS,
  SHARES,
  shareOf,
  sum,
  WALK,
  walkSpeeds,
} from "../foundations/bridgeFigures.ts";
import { roundsTo, withinTolerance } from "../units/tolerance.ts";

/**
 * The five bridge figures draw numbers their lessons also state in prose (dispatch 401), and the
 * two can drift apart silently: a figure that disagrees with the paragraph above it renders
 * perfectly and passes every schema. So every derived value the figures print is recomputed here
 * from the raw one beside it.
 *
 * The assertions are properties rather than a census, so they hold at four jars or at six: the
 * jars level to their own average, the walk has one speed throughout, the particle ends cancel
 * while their distances do not, the two shares agree while the groups differ, and squaring a
 * length squares its power of ten. Changing a jar's height or a walk reading turns this red rather
 * than leaving a figure quietly wrong.
 */

describe("the numbers the bridge figures draw", () => {
  test("the jars level to their own average, and the total and the count survive it", () => {
    expect(JARS.length).toBeGreaterThan(1);
    // Not every jar already holds the average, or the lesson's whole point would be invisible.
    expect(new Set(JARS).size).toBeGreaterThan(1);
    const mean = average(JARS);
    const levelled = JARS.map(() => mean);
    expect(sum(levelled)).toBe(sum(JARS));
    expect(levelled.length).toBe(JARS.length);
    expect(average(levelled)).toBe(mean);
    // Doubling the list doubles the total and the count, and leaves the average where it was.
    expect(average([...JARS, ...JARS])).toBe(mean);
    expect(sum([...JARS, ...JARS])).toBe(2 * sum(JARS));
    // The figure prints these three; a reader can count the marbles against them.
    expect(sum(JARS)).toBe(8);
    expect(mean).toBe(2);
  });

  test("the walk has one speed throughout, which is what makes its dots a straight line", () => {
    const speeds = walkSpeeds();
    expect(speeds.length).toBe(WALK.length - 1);
    expect(speeds.length).toBeGreaterThan(1);
    for (const speed of speeds) expect(speed).toBe(speeds[0] as number);
    expect(speeds[0]).toBe(1.4);
    // Read from the ends rather than step by step: the same rate, so the line passes through both.
    const last = WALK[WALK.length - 1] as (typeof WALK)[number];
    const first = WALK[0] as (typeof WALK)[number];
    expect((last.metres - first.metres) / (last.seconds - first.seconds)).toBe(speeds[0] as number);
    expect(first.metres).toBe(0);
    expect(first.seconds).toBe(0);
  });

  test("the particle ends cancel as displacements and do not cancel as distances", () => {
    expect(average(PARTICLE_ENDS)).toBe(0);
    expect(sum(PARTICLE_ENDS)).toBe(0);
    const distances = PARTICLE_ENDS.map(Math.abs);
    expect(sum(distances)).toBeGreaterThan(0);
    expect(average(distances)).toBeGreaterThan(0);
    // Read through a widened view: `as const` narrows the ends to a union of four literals, under
    // which the compiler settles both of these itself and the runtime check never runs.
    const ends: readonly number[] = PARTICLE_ENDS;
    // Symmetric about zero, which is what the figure draws: every end has its opposite.
    for (const end of ends) expect(ends).toContain(-end);
    // None of them stayed at zero, so no bar stands on the average.
    expect(ends.some((end) => end === 0)).toBe(false);
  });

  test("the two shares agree while the two groups differ", () => {
    expect(SHARES.length).toBe(2);
    const [small, large] = SHARES as unknown as readonly [
      (typeof SHARES)[number],
      (typeof SHARES)[number],
    ];
    expect(large.group).not.toBe(small.group);
    expect(large.moved).not.toBe(small.moved);
    expect(shareOf(large)).toBe(shareOf(small));
    expect(shareOf(small)).toBe(0.25);
    // The second row is the first one doubled, which is the claim the figure makes by eye.
    expect(large.group).toBe(2 * small.group);
    expect(large.moved).toBe(2 * small.moved);
    for (const row of SHARES) {
      expect(row.moved).toBeGreaterThan(0);
      expect(row.moved).toBeLessThan(row.group);
    }
  });

  test("the place ladder counts down one power at a time and names the units the lesson uses", () => {
    expect(PLACES[0]?.power).toBe(0);
    // place.power + i rather than -i: at i = 0 the negation is -0, which toBe distinguishes.
    for (const [i, place] of PLACES.entries()) expect(place.power + i).toBe(0);
    const named = PLACES.filter((p) => p.name !== null);
    expect(named.map((p) => p.symbol)).toEqual(["m", "cm", "mm", "μm"]);
    const micro = PLACES.find((p) => p.symbol === "μm");
    expect(micro?.power).toBe(-6);
    expect(PLACES.find((p) => p.symbol === "mm")?.power).toBe(-3);
  });

  test("the three averages are three different numbers, and the printed RMS is a rounding", () => {
    const ends = PARTICLE_ENDS;
    const mean = average(ends);
    const distance = meanDistance(ends);
    const squares = meanSquare(ends);
    // Three answers, and the lesson only works because they differ.
    expect(mean).toBe(0);
    expect(distance).toBeGreaterThan(mean);
    expect(Math.sqrt(squares)).toBeGreaterThan(distance);
    // Squaring weighs the far ones more, so the RMS always sits at or beyond the mean distance.
    expect(squares).toBe(average(ends.map((v) => v * v)));
    // 2.236 is a ROUNDING of the square root of 5, not a value double precision cannot hold, so
    // it is checked as a rounding to four significant figures rather than against a tolerance.
    const printed = roundsTo(Math.sqrt(squares), PRINTED_RMS, { significantFigures: 4 });
    expect(printed.ok, `printed RMS ${PRINTED_RMS} is not ${Math.sqrt(squares)} to 4 figures`).toBe(
      true,
    );
    // Here and only here the RMS is also the standard deviation, because the mean is zero.
    expect(Math.sqrt(squares - mean * mean)).toBe(Math.sqrt(squares));
  });

  test("the ball's printed speeds and positions are the arithmetic, to a stated tolerance", () => {
    // Every one of these is a rounding of a value double precision cannot hold exactly: the
    // average over a tenth of a second is 6.300000000000008 and the position 3.630000000000001.
    // The figure prints the declared value, and this is what stops the declaration drifting from
    // the formula it stands for. The comparison goes through the one module that owns tolerance.
    expect(NUDGES.length).toBe(PRINTED_SPEEDS.length);
    expect(NUDGES.length).toBe(PRINTED_POSITIONS.length);
    expect(NUDGES.length).toBeGreaterThan(1);
    for (const [i, nudge] of NUDGES.entries()) {
      const speed = withinTolerance(averageSpeed(nudge), PRINTED_SPEEDS[i] as number, {
        relative: 1e-12,
      });
      expect(speed.ok, `speed at ${nudge}: ${speed.kind}, off by ${speed.diff}`).toBe(true);
      const place = withinTolerance(
        ballPosition(BALL.atSeconds + nudge),
        PRINTED_POSITIONS[i] as number,
        { relative: 1e-12 },
      );
      expect(place.ok, `position at ${nudge}: ${place.kind}, off by ${place.diff}`).toBe(true);
    }
    // The averages approach the instant's speed and never reach it: each is 3 times its own nudge
    // above it, which is the term the lesson's worked example cancels.
    for (const [i, nudge] of NUDGES.entries()) {
      const excess = (PRINTED_SPEEDS[i] as number) - INSTANT_SPEED;
      expect(excess).toBeGreaterThan(0);
      const predicted = withinTolerance(excess, BALL.coefficient * nudge, { relative: 1e-9 });
      expect(predicted.ok, `excess at ${nudge}: ${predicted.kind}`).toBe(true);
    }
    expect(INSTANT_SPEED).toBe(2 * BALL.coefficient * BALL.atSeconds);
  });

  test("squaring the displacement squares its power of ten, and the printed figures match", () => {
    expect(MINUTE_DISPLACEMENT * 1e6).toBe(MINUTE_DISPLACEMENT_MICROMETRES);
    // 6e-6 * 6e-6 is 3.6000000000000005e-11 in double precision, so the printed value is declared
    // and held to the arithmetic here within a relative tolerance rather than by equality. The
    // comparison goes through src/units/tolerance.ts, the one module that owns it: a hand-rolled
    // relative difference here was a duplicate of that logic, and its verdict prints the
    // difference and the allowance where a bare boolean printed neither.
    const computed = MINUTE_DISPLACEMENT * MINUTE_DISPLACEMENT;
    const squared = withinTolerance(computed, MINUTE_DISPLACEMENT_SQUARED, { relative: 1e-12 });
    expect(
      squared.ok,
      `${squared.kind}: differed by ${squared.diff}, allowed ${squared.allowed}`,
    ).toBe(true);
    expect(MINUTE_DISPLACEMENT_SQUARED_MANTISSA * 1e-11).toBe(MINUTE_DISPLACEMENT_SQUARED);
    // The lesson's own trap: a square micrometre is twelve places down, not six.
    const microPower = PLACES.find((p) => p.symbol === "μm")?.power as number;
    expect(2 * microPower).toBe(-12);
    expect(10 ** (2 * microPower)).not.toBe(10 ** microPower);
  });
});
