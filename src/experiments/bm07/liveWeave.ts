import type { WeavePredicate } from "../weave/types.ts";

/** A molecular-number pointer needs the owner's determinate estimate, not just measured D. */
export const BM07_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "bm07-s5-inversion",
    instrumentId: "bm-07",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s5-p3-s1"]),
    pointerText:
      "The accepted estimate uses the measured spreading and the supplied radius, temperature and viscosity to invert Einstein's relation. Here the observations are synthetic: recovering their hidden number tests the inference method, not the existence of molecules.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "status" as const,
        quantityId: "avogadroNumberEstimate",
        equals: "value" as const,
      }),
      Object.freeze({
        kind: "status" as const,
        quantityId: "diffusionCoefficientEstimate",
        equals: "value" as const,
      }),
    ]),
  }),
]);
