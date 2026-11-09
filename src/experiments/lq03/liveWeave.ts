import type { WeavePredicate } from "../weave/types.ts";

/**
 * Regime membership is published as Number(boolean) by the session, directly from the
 * radiation owner's report. These conditions read that accepted classification, never
 * the form, a plotted sample, or a second implementation of the spectral laws.
 */
export const LQ03_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "lq03-s4-wien-confirmed-within-limits",
    instrumentId: "lq-03",
    meaning: "agreement-within-stated-bound" as const,
    targets: Object.freeze(["s4-p1-s3"]),
    pointerText:
      "At the accepted probe frequency, Wien's law is within the chosen relative tolerance of Planck's law. This pointwise comparison does not certify the entropy argument's integrated approximation or supply experimental evidence.",
    conditions: Object.freeze([
      Object.freeze({ kind: "regime" as const, on: "wienRegimeAdmitted", equals: "1" }),
    ]),
  }),
  Object.freeze({
    id: "lq03-s2-classical-regime",
    instrumentId: "lq-03",
    meaning: "agreement-within-stated-bound" as const,
    targets: Object.freeze(["s2-p2-s2"]),
    pointerText:
      "At the accepted probe frequency, the classical law is within the chosen relative tolerance of Planck's law. This points to the large-temperature, long-wavelength limit taken in Section 2, not to agreement across the whole spectrum.",
    conditions: Object.freeze([
      Object.freeze({ kind: "regime" as const, on: "classicalRegimeAdmitted", equals: "1" }),
    ]),
  }),
  Object.freeze({
    id: "lq03-s4-outside-wien-regime",
    instrumentId: "lq-03",
    meaning: "outside-selected-domain" as const,
    targets: Object.freeze(["s4-p1-s3"]),
    pointerText:
      "At the accepted probe frequency, Wien's law exceeds the chosen relative tolerance of Planck's law. Read the stated limits of its use in Section 4; this comparison does not test the whole entropy argument.",
    conditions: Object.freeze([
      Object.freeze({ kind: "regime" as const, on: "wienRegimeAdmitted", equals: "0" }),
    ]),
  }),
]);
