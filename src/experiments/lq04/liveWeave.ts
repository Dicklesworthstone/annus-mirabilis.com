import type { WeavePredicate } from "../weave/types.ts";
import { LQ04_ENTROPY_SLOPE_COMPARISON } from "./definition.ts";

/**
 * Read the entropy owner's accepted result, including its typed domain exit. A single volume
 * comparison is not evidence for the whole law. The derivative pointer requires the accepted
 * owner's two local entropy probes; temperature readouts alone cannot supply that witness.
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
  Object.freeze({
    id: "lq04-s3-derivative-check",
    instrumentId: "lq-04",
    meaning: "agreement-within-stated-bound" as const,
    targets: Object.freeze(["s3-p4-s3"]),
    pointerText:
      "At both accepted states, two entropy-density probes at fixed frequency and volume give a numerical slope agreeing with 1/T within a relative tolerance of 10⁻⁸. Each density probe is 0.01% from its central state and remains inside the selected Wien regime. This is a local numerical consistency check of the entropy formula, not independent experimental evidence or a determination of the integration constant.",
    conditions: Object.freeze(
      (["initial", "final"] as const).flatMap((state) => [
        ...["EntropyDensitySlope", "InverseTemperature", "EntropySlopeDensityStep"].map(
          (suffix) =>
            Object.freeze({
              kind: "threshold" as const,
              quantityId: `${state}${suffix}`,
              direction: "at-least" as const,
              enter: Number.MIN_VALUE,
              exit: Number.MIN_VALUE,
            }),
        ),
        Object.freeze({
          kind: "threshold" as const,
          quantityId: `${state}EntropySlopeRelativeDiscrepancy`,
          direction: "at-least" as const,
          enter: 0,
          exit: 0,
        }),
        Object.freeze({
          kind: "threshold" as const,
          quantityId: `${state}EntropySlopeRelativeDiscrepancy`,
          direction: "at-most" as const,
          enter: LQ04_ENTROPY_SLOPE_COMPARISON.relativeTolerance,
          exit: LQ04_ENTROPY_SLOPE_COMPARISON.relativeTolerance,
        }),
      ]),
    ),
  }),
]);
