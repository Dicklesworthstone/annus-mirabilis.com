import { describe, expect, test } from "bun:test";
import {
  MOMENTUM_FACTOR,
  POWERS,
  PRINTED_ONE_WATT_EXPONENT,
  PRINTED_ONE_WATT_MANTISSA,
  pushNewtons,
  type Surface,
} from "../foundations/lightPush.ts";
import { C_SI } from "../physics/reference/waves.ts";
import { roundsTo, withinTolerance } from "../units/tolerance.ts";

/**
 * The push of light (dispatch 468). foundation:momentum-energy-light's instrument lets a reader
 * set a power and a surface; these are the relations it claims, checked against the owner's speed
 * of light rather than against a number typed here.
 *
 * The assertions are properties, so they hold at any power: the push is proportional to the power,
 * a mirror receives exactly twice what an absorber does, and the constant of proportionality is
 * 1/c. Only the last line is a printed value, and it is checked as a rounding.
 */

describe("the push of light on a surface at rest", () => {
  test("the push is the power divided by the speed of light", () => {
    expect(POWERS.length).toBeGreaterThan(1);
    for (const watts of POWERS) {
      const v = withinTolerance(pushNewtons(watts, "absorbs"), watts / C_SI, { relative: 1e-12 });
      expect(v.ok, `at ${watts} W: ${v.kind}, off by ${v.diff}`).toBe(true);
    }
  });

  test("it is proportional to the power, so doubling the beam doubles the push", () => {
    for (const surface of ["absorbs", "reflects"] as const) {
      const one = pushNewtons(1, surface);
      for (const watts of POWERS) {
        const v = withinTolerance(pushNewtons(watts, surface), watts * one, { relative: 1e-12 });
        expect(v.ok, `${surface} at ${watts} W: ${v.kind}`).toBe(true);
      }
    }
  });

  test("a mirror receives exactly twice what an absorber does, at every power", () => {
    expect(MOMENTUM_FACTOR.reflects / MOMENTUM_FACTOR.absorbs).toBe(2);
    for (const watts of POWERS) {
      const ratio = pushNewtons(watts, "reflects") / pushNewtons(watts, "absorbs");
      expect(ratio, `at ${watts} W`).toBe(2);
    }
    // Not vacuous: the two surfaces really do give different numbers.
    expect(pushNewtons(1, "reflects")).toBeGreaterThan(pushNewtons(1, "absorbs"));
  });

  test("a beam of no power pushes not at all, and every push is positive", () => {
    for (const surface of ["absorbs", "reflects"] as const) {
      expect(pushNewtons(0, surface as Surface)).toBe(0);
      for (const watts of POWERS) expect(pushNewtons(watts, surface)).toBeGreaterThan(0);
    }
  });

  test("the lesson's printed one-watt figure is this relation, rounded", () => {
    const printed = PRINTED_ONE_WATT_MANTISSA * 10 ** PRINTED_ONE_WATT_EXPONENT;
    const v = roundsTo(pushNewtons(1, "absorbs"), printed, { significantFigures: 3 });
    expect(v.ok, `printed ${printed} is not ${pushNewtons(1, "absorbs")} to 3 figures`).toBe(true);
  });
});
