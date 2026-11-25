import type { WeavePredicate } from "../weave/types.ts";

/**
 * The store admits all three finite components of each vector. The weave reads their typed
 * status without converting a vector's first component into a scalar comparison.
 * The rest-frame pointer additionally requires the accepted complete velocity to be zero.
 */
export const SR08_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "sr08-field-transformation",
    instrumentId: "sr-08",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s6-p5-s2"]),
    pointerText:
      "The accepted electric and magnetic fields describe the same event in K and k. The field transformation in this passage mixes transverse components for the selected signed boost along x. The stored fields use SI units; the paper's X, Y, Z and L, M, N use printed Gaussian units. This is a consequence of the admitted transformation, with the normalization and physical identification of the fields taken as premises.",
    conditions: Object.freeze([
      ...[
        "electricFieldStationary",
        "electricFieldMoving",
        "magneticFieldStationary",
        "magneticFieldMoving",
      ].map((quantityId) =>
        Object.freeze({
          kind: "status" as const,
          quantityId,
          equals: "value" as const,
        }),
      ),
      Object.freeze({
        kind: "threshold" as const,
        quantityId: "lorentzFactor",
        direction: "at-least" as const,
        enter: 1,
        exit: 1,
      }),
    ]),
  }),
  Object.freeze({
    id: "sr08-new-manner-expression",
    instrumentId: "sr-08",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s6-p10-s1"]),
    pointerText:
      "The accepted charge velocity in k is exactly zero in all three components, so k is the charge's rest frame. The electric and total force readings there show the same force, with no magnetic contribution. This is the situation described by the paper's new manner of expression. The laboratory uses SI units and the chosen test charge; the source speaks of a unit charge. Forces in K and k need not have equal numerical values.",
    conditions: Object.freeze([
      Object.freeze({ kind: "regime" as const, on: "chargeAtRestMoving", equals: "1" }),
      ...[
        "chargeVelocityMoving",
        "electricForceMoving",
        "magneticForceMoving",
        "transverseForceComoving",
      ].map((quantityId) =>
        Object.freeze({
          kind: "status" as const,
          quantityId,
          equals: "value" as const,
        }),
      ),
    ]),
  }),
]);
