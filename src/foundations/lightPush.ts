import { C_SI } from "../physics/reference/waves.ts";

/**
 * The push of light on a surface at rest (dispatch 468), for foundation:momentum-energy-light.
 *
 * The lesson is a chain of arithmetic with nothing to set: "A surface absorbs a beam of 1 W ... the
 * push is 3.34 × 10⁻⁹ N", and "a mirror that sends the light straight back reverses its momentum
 * and so receives twice as much each second." Those are two relations a reader can be given to
 * operate, and the lesson gives them nothing.
 *
 * The relation lives here and not in the component, and the speed of light comes from the waves
 * owner's constant set rather than from a literal, so the component only formats what this returns.
 * This is the stationary case; a MOVING mirror is a different problem and is owned by
 * src/physics/reference/waves.ts, which this deliberately does not try to reproduce.
 */

/** How a surface deals with the light that lands on it. */
export type Surface = "absorbs" | "reflects";

/** A surface that sends the light back reverses its momentum, so it receives twice as much. */
export const MOMENTUM_FACTOR: Readonly<Record<Surface, number>> = { absorbs: 1, reflects: 2 };

/** The powers the lesson and its neighbours name, in watts. */
export const POWERS = [1, 100, 1000] as const;

/** Momentum delivered per second is a force: P/c for an absorber, twice that for a mirror. */
export function pushNewtons(watts: number, surface: Surface): number {
  return (MOMENTUM_FACTOR[surface] * watts) / C_SI;
}

/** The lesson's printed case, as it prints it: one watt absorbed. */
export const PRINTED_ONE_WATT_MANTISSA = 3.34;
export const PRINTED_ONE_WATT_EXPONENT = -9;
