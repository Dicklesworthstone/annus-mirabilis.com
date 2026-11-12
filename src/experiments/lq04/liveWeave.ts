import type { WeavePredicate } from "../weave/types.ts";

/**
 * Read the entropy owner's accepted result, including its typed domain exit. A single volume
 * comparison is not evidence for the whole law. The declared derivative-check pointer remains
 * unavailable until the session publishes a derivative comparison; temperature alone is no check.
 */
export const LQ04_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "lq04-s4-volume-law",
    instrumentId: "lq-04",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s4-p5-s1"]),
    pointerText:
      "The accepted entropy change uses the coefficient E/(βν) multiplying ln(V/V₀), at fixed energy and frequency band. This is one constrained comparison under Wien's law, not experimental evidence for the whole volume law or a count of light particles.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "threshold" as const,
        quantityId: "radiationEntropy",
        direction: "at-least" as const,
        // Entropy changes may have either sign, including a genuine zero at V = V₀.
        enter: -Number.MAX_VALUE,
        exit: -Number.MAX_VALUE,
      }),
      Object.freeze({
        kind: "threshold" as const,
        quantityId: "entropyVolumeCoefficient",
        direction: "at-least" as const,
        enter: 0,
        exit: 0,
      }),
    ]),
  }),
  Object.freeze({
    id: "lq04-s4-wien-validity-limit",
    instrumentId: "lq-04",
    meaning: "outside-selected-domain" as const,
    targets: Object.freeze(["s4-p1-s3"]),
    pointerText:
      "The workbench cannot give an entropy value for these accepted settings. The reason above distinguishes the limits of the Wien approximation, the narrow band, and numerical representation. Einstein's sentence limits results based on Wien's law; a calculation outside its domain is not evidence against that law.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "status" as const,
        quantityId: "radiationEntropy",
        equals: "outside-domain" as const,
      }),
    ]),
  }),
]);
