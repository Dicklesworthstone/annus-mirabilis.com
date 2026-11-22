import type { WeavePredicate } from "../weave/types.ts";

/**
 * Signed and zero charge densities are admitted values. A status condition preserves those
 * cases, including a neutral current for which a net carrier velocity J/ρ is undefined.
 * The sphere owner assigns Q′ = Q; the second pointer names that modeling assumption.
 */
export const SR12_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "sr12-charge-density-transformation",
    instrumentId: "sr-12",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s9-p2-s1"]),
    pointerText:
      "The accepted charge and current densities compare K with k under the density transformation in this passage. The lab uses SI charge density in C/m³; the paper's ρ denotes 4π times its charge density. For a neutral conductor, the modern comparison combines charge species, each with its own velocity. It does not assign the net current a velocity J/ρ when the net density is zero.",
    conditions: Object.freeze([
      ...[
        "chargeDensityStationary",
        "chargeDensityMoving",
        "currentDensityStationary",
        "currentDensityMoving",
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
    id: "sr12-total-charge-invariance",
    instrumentId: "sr-12",
    meaning: "assumption-active" as const,
    targets: Object.freeze(["s9-p3-s1"]),
    pointerText:
      "The separate uniform-sphere comparison assigns the same total charge to the same material sphere in both frames. This is a conservation assumption of this model, not a separate test of charge conservation. The published totals do not come from integrating the transformed density over an arbitrary finite region.",
    conditions: Object.freeze(
      ["sphereTotalChargeStationary", "sphereTotalChargeMoving"].map((quantityId) =>
        Object.freeze({
          kind: "status" as const,
          quantityId,
          equals: "value" as const,
        }),
      ),
    ),
  }),
]);
