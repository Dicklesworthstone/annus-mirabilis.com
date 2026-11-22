import type { WeavePredicate } from "../weave/types.ts";

/**
 * The residual owner evaluates an admitted plane wave at seeded events. These pointers
 * distinguish that numerical example from the general covariance argument in §6.
 */
export const SR07_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "sr07-form-invariance",
    instrumentId: "sr-07",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s6-p2-s1"]),
    pointerText:
      "The accepted six plane-wave residuals, calculated in normalized units with c = 1, compare the transformed equations at the sampled events. The owner reports that this wave meets its numerical tolerance. This illustrates the change of variables in this passage; it does not establish covariance for arbitrary fields.",
    conditions: Object.freeze([
      Object.freeze({ kind: "regime" as const, on: "formInvariant", equals: "1" }),
      ...[
        "residualMax",
        "residualFaradayX",
        "residualFaradayY",
        "residualFaradayZ",
        "residualAmpereX",
        "residualAmpereY",
        "residualAmpereZ",
      ].map((quantityId) =>
        Object.freeze({
          kind: "threshold" as const,
          quantityId,
          direction: "at-least" as const,
          enter: 0,
          exit: 0,
        }),
      ),
    ]),
  }),
  Object.freeze({
    id: "sr07-printed-transforms",
    instrumentId: "sr-07",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s6-p5-s2"]),
    pointerText:
      "The accepted plane-wave amplitude factor points to the field transformation printed here. The same trial also reports the frequency factor from its changed coordinates. X, Y, Z are electric components; L, M, N are magnetic components. The displayed Gaussian and SI formulas label their different units. This calculation uses the passage's normalization and physical identification of the fields as premises.",
    conditions: Object.freeze(
      ["amplitudeFactor", "frequencyFactor", "lorentzFactor"].map((quantityId) =>
        Object.freeze({
          kind: "threshold" as const,
          quantityId,
          direction: "at-least" as const,
          enter: 0,
          exit: 0,
        }),
      ),
    ),
  }),
]);
