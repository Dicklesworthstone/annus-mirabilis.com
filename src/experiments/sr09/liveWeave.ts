import type { WeavePredicate } from "../weave/types.ts";

/**
 * These are pointers to the quantities being compared, not independent tests of the
 * wave transformation. Every condition reads the accepted owner's finite outputs;
 * an unrepresentable frequency must not borrow a valid-looking form value. The phase
 * pointer reads the owner's comparison verdict for the reader's selected fixed event.
 */
export const SR09_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "sr09-doppler-principle",
    instrumentId: "sr-09",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s7-p3-s1"]),
    pointerText:
      "The accepted frequencies in K and k and their Doppler factor illustrate the frequency transformation stated here. The observer is at rest in k, and the ray angle is measured in K. These are consequences of the plane-wave model, not independent observations of light.",
    conditions: Object.freeze(
      ["waveFrequencyStationary", "waveFrequencyMoving", "dopplerFactor"].map((quantityId) =>
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
    id: "sr09-aberration-formula",
    instrumentId: "sr-09",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s7-p5-s2"]),
    pointerText:
      "The accepted propagation angles describe the same ray in the two frames. This passage names the aberration law used for that comparison. A change of observer changes the ray's coordinates without creating a different light wave.",
    conditions: Object.freeze(
      ["propagationAngleStationary", "propagationAngleMoving"].map((quantityId) =>
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
    id: "sr09-phase-invariance",
    instrumentId: "sr-09",
    meaning: "agreement-within-stated-bound" as const,
    targets: Object.freeze(["s7-p2-s2"]),
    pointerText:
      "For the selected named event, the accepted phases in K and k agree within the numerical owner's absolute tolerance of 10⁻¹² radians. This points to the passage transforming the same wave and coordinates together. The laboratory uses k·x − ωt, the opposite sign to Einstein's printed phase, consistently in both frames. This numerical consistency check is not an independent observation of light.",
    conditions: Object.freeze([
      ...["selectedEventPhaseK", "selectedEventPhaseMoving"].map((quantityId) =>
        Object.freeze({
          kind: "threshold" as const,
          quantityId,
          direction: "at-least" as const,
          enter: -Number.MAX_VALUE,
          exit: -Number.MAX_VALUE,
        }),
      ),
      Object.freeze({
        kind: "regime" as const,
        on: "selectedEventPhaseAgreement",
        equals: "1",
      }),
    ]),
  }),
]);
