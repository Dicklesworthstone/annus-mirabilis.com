import type { WeavePredicate } from "../weave/types.ts";

/**
 * Executable counterparts of BM06_WEAVE_PREDICATES in definition.ts (am-read-result-weave-jex).
 * Those declarations predate the shared schema. Read the actual publication, not form controls:
 * evaluateBm06 publishes a density VALUE only at positive elapsed time, and an analytic-limit
 * at t = 0. The status condition therefore includes the old strict simulationTime > 0 condition
 * without inventing a quantity or replacing zero by an epsilon. A density array is not a scalar.
 *
 * The optional grid publishes stabilityRatio only when enabled, and wallContact as Number(boolean).
 * "0" is thus its actual published no-contact classification, not an invented grid-mode output.
 * The cell-probability thresholds are unchanged: enter at 1e-3 and exit above 2e-3. This does not
 * compute a density, compare grid cells, infer wall contact, or loosen a stability refusal.
 */
export const BM06_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "bm06-s4-solution",
    instrumentId: "bm-06",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s4-p10-s7"]),
    pointerText:
      "The accepted density and interval probability are evaluations of the point-source solution introduced here.",
    conditions: Object.freeze([
      Object.freeze({ kind: "status" as const, quantityId: "probabilityDensity", equals: "value" as const }),
      Object.freeze({ kind: "status" as const, quantityId: "intervalProbability", equals: "value" as const }),
    ]),
  }),
  Object.freeze({
    id: "bm06-s4-grid-agreement",
    instrumentId: "bm-06",
    meaning: "agreement-within-stated-bound" as const,
    targets: Object.freeze(["s4-p6-s7"]),
    pointerText:
      "The grid's published cell-probability difference is within the stated bound, with no wall contact detected at the model's threshold. The finite box and unbounded solution still have different boundaries.",
    conditions: Object.freeze([
      Object.freeze({ kind: "status" as const, quantityId: "stabilityRatio", equals: "value" as const }),
      Object.freeze({ kind: "regime" as const, on: "wallContact", equals: "0" }),
      Object.freeze({
        kind: "threshold" as const,
        quantityId: "maxCellMassDifference",
        direction: "at-most" as const,
        enter: 1e-3,
        exit: 2e-3,
      }),
    ]),
  }),
]);
