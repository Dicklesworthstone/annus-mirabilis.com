import type { WeavePredicate } from "../weave/types.ts";

/**
 * Construction and candidate testing have distinct published statuses. Neither gamma nor a
 * later-aid value can authorize a construction pointer. The published coefficient vector fixes
 * only the longitudinal map; the transverse requirement is a separate step in this workbench.
 */
export const SR04_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "sr04-s3-unfixed-scale",
    instrumentId: "sr-04",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s3-p21-s1"]),
    pointerText:
      "The accepted requirements leave a family of maps, with the missing information listed above. This points to the paper's still-undetermined scale. The workbench reconstructs the argument with selectable constraints; it does not claim that its intermediate family is the paper's exact intermediate expression.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "status" as const,
        quantityId: "constraintFamily",
        equals: "underdetermined" as const,
      }),
    ]),
  }),
  Object.freeze({
    id: "sr04-s3-longitudinal-map",
    instrumentId: "sr-04",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s3-p22-s10"]),
    pointerText:
      "The accepted construction fixes the longitudinal position and time coefficients in the displayed map. The transverse scale requires the separate light-ray-across-the-motion requirement. This constraint reconstruction reaches the longitudinal part of the printed transformation; the later matrix and rapidity are not premises of the construction.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "status" as const,
        quantityId: "constraintFamily",
        equals: "value" as const,
      }),
    ]),
  }),
  Object.freeze({
    id: "sr04-s3-candidate-comparison",
    instrumentId: "sr-04",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s3-p15-s1"]),
    pointerText:
      "The accepted residual table tests a candidate against the construction requirements, including propagation of light in the moving frame. A discrepancy is something to inspect; the presence of residuals does not mean that the candidate meets the requirements or that the map has been derived.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "status" as const,
        quantityId: "candidateResiduals",
        equals: "value" as const,
      }),
    ]),
  }),
]);
