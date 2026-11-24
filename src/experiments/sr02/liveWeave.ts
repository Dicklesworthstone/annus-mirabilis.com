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

/** The analytic model compares fields and forces at one event. It does not supply a circuit
 * current or assert that three-forces have the same numerical value in different frames. */
export const SR02_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "sr02-introduction-asymmetry",
    instrumentId: "sr-02",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s0-p1-s3"]),
    pointerText:
      "The accepted table compares a magnetic force in the magnet's rest frame with an electric force in the conductor's rest frame at the same event. The forces need not have equal numerical values in the two frames; at zero relative speed both vanish. This narrow model illustrates the difference in description and its stationary limit; it does not compute the circuit current reported in the introduction.",
    conditions: Object.freeze([
      reading("transverseForceLaboratory"),
      reading("transverseForceComoving"),
      Object.freeze({
        kind: "status" as const,
        quantityId: "inducedCircuitCurrent",
        equals: "not-applicable" as const,
      }),
    ]),
  }),
  Object.freeze({
    id: "sr02-section-6-resolution",
    instrumentId: "sr-02",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s6-p10-s1"]),
    pointerText:
      "The accepted transformed electric field supplies the force on a charge at rest in the conductor's frame. This is the paper's new manner of expression. A missing simultaneity declaration can still prevent an electromotive-force comparison along a path; it does not remove this local field-and-force calculation.",
    conditions: Object.freeze([reading("electricFieldMoving"), reading("transverseForceComoving")]),
  }),
]);
