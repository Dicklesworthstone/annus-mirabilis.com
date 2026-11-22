import type { WeavePredicate } from "../weave/types.ts";

/**
 * The store admits all three finite components of each vector. The weave reads their typed
 * status without converting a vector's first component into a scalar comparison.
 * The charge-rest-frame claim needs an accepted rest-state criterion and is not activated here.
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
]);
