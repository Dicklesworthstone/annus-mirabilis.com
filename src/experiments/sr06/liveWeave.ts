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

/** The owner distinguishes a timelike result from a light ray through the Lorentz-factor
 * status. A rounded speed of 1 must not turn a timelike calculation into a light-ray claim. */
export const SR06_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "sr06-subluminal-composition",
    instrumentId: "sr-06",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s5-p2-s8"]),
    pointerText:
      "The accepted calculation supplies a finite Lorentz factor and the shortfall from light speed for two sub-light motions. The shortfall remains useful when the displayed speed rounds to c. This sentence gives the same-line conclusion; angled motion uses the section's general formula, and the rotation of two non-parallel boosts is a later geometric consequence.",
    conditions: Object.freeze([
      reading("composedGamma"),
      reading("composedSpeedOverC"),
      // The owner computes this stably even when the speed rounds to 1. Require an actual
      // positive shortfall, with no display-precision tolerance standing in for U < c.
      Object.freeze({
        kind: "threshold" as const,
        quantityId: "shortfall",
        direction: "at-least" as const,
        enter: Number.MIN_VALUE,
        exit: Number.MIN_VALUE,
      }),
    ]),
  }),
  Object.freeze({
    id: "sr06-null-stays-null",
    instrumentId: "sr-06",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s5-p6-s1"]),
    pointerText:
      "The selected moving-frame motion is a light ray. Its accepted speed remains c and its shortfall is zero after the change of frame. The absent finite Lorentz factor means that no rest frame has been assigned to the ray. This is a consequence of the assumed Lorentz transformation, not an independent measurement of light speed.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "status" as const,
        quantityId: "composedGamma",
        equals: "not-applicable" as const,
      }),
      Object.freeze({ kind: "regime" as const, on: "composedSpeedOverC", equals: "1" }),
      Object.freeze({ kind: "regime" as const, on: "shortfall", equals: "0" }),
    ]),
  }),
]);
