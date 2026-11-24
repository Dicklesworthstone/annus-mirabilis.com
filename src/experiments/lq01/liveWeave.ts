import type { WeaveCondition, WeavePredicate } from "../weave/types.ts";

/** Availability is a finite scalar from the owner, not a status attached to an absent number. */
function reading(quantityId: string): WeaveCondition {
  return Object.freeze({
    kind: "threshold",
    quantityId,
    direction: "at-least",
    enter: -Number.MAX_VALUE,
    exit: -Number.MAX_VALUE,
  });
}

/** Read the wave owner's published results. The reader binding selects the accepted mode and
 * readout: this owner publishes both experiments' outputs, including the ones not on screen. */
export const LQ01_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "lq01-s0-wave-success",
    instrumentId: "lq-01",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s0-p2-s1"]),
    pointerText:
      "With both waves contributing, the accepted intensities and nonzero fringe visibility illustrate what the continuous wave description can account for: changing phase changes intensity through superposition. This calculated example is not new experimental confirmation, and success with propagation does not settle how light is emitted or absorbed.",
    conditions: Object.freeze([
      reading("centerIntensity"),
      reading("selectedPositionIntensity"),
      // The smallest positive representable value expresses visibility > 0, not a fit tolerance.
      Object.freeze({
        kind: "threshold" as const,
        quantityId: "fringeVisibility",
        direction: "at-least" as const,
        enter: Number.MIN_VALUE,
        exit: Number.MIN_VALUE,
      }),
    ]),
  }),
  Object.freeze({
    id: "lq01-s0-time-averages",
    instrumentId: "lq-01",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s0-p2-s2"]),
    pointerText:
      "The accepted detector readout is averaged over many cycles. The table also supplies the instantaneous intensity from the same wave model. Einstein distinguishes those two kinds of observation here; neither readout by itself establishes a mechanism for the generation or transformation of light.",
    conditions: Object.freeze([
      reading("centerIntensity"),
      reading("instantaneousCenterIntensity"),
    ]),
  }),
  Object.freeze({
    id: "lq01-s0-energy-spreading",
    instrumentId: "lq-01",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s0-p1-s4"]),
    pointerText:
      "The accepted intensity and power through the whole sphere describe a continuously spreading wave: the same source power crosses each larger sphere while less reaches a fixed small window. This is the continuous account Einstein contrasts with his light-quantum hypothesis, not a calculation of individual photon arrivals.",
    conditions: Object.freeze([
      reading("pointSourceIntensity"),
      reading("shellPower"),
      reading("smallAperturePower"),
    ]),
  }),
]);
