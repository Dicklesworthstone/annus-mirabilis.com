import type { WeavePredicate } from "../weave/types.ts";

/**
 * The light complex's accepted energy and volume have one scientific owner. The
 * separately labelled rigid-body countermodel never enters these predicates.
 * No ratio is recalculated here, and a pointer is not an empirical confirmation.
 */
export const SR10_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "sr10-energy-frequency-proportionality",
    instrumentId: "sr-10",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s8-p5-s1"]),
    pointerText:
      "The accepted energy of the light complex uses the same transformation factor as the frequency of its plane wave. This is the relationship Einstein remarks on here; it does not require a light-quantum premise or turn this calculation into experimental evidence.",
    conditions: Object.freeze(
      ["lightComplexEnergyStationary", "lightComplexEnergyMoving", "dopplerFactor"].map(
        (quantityId) =>
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
  Object.freeze({
    id: "sr10-volume-transformation",
    instrumentId: "sr-10",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s8-p2-s2"]),
    pointerText:
      "The accepted volumes enclose the same light complex on each frame's simultaneous slice. The enclosing surface moves with the light, so this comparison uses the light-complex volume law stated here rather than assuming the contraction of a material body.",
    conditions: Object.freeze(
      ["lightComplexVolumeStationary", "lightComplexVolumeMoving", "volumeFactor"].map(
        (quantityId) =>
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
