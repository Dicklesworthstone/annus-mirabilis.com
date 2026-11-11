import type { WeavePredicate } from "../weave/types.ts";

/** Read the solver's accepted classifications. Matched kicks alone do not imply equilibrium. */
export const BM04_LIVE_WEAVE_PREDICATES: readonly WeavePredicate[] = Object.freeze([
  Object.freeze({
    id: "bm04-s3-diffusion-coefficient",
    instrumentId: "bm-04",
    meaning: "quantity-compared" as const,
    targets: Object.freeze(["s3-p8-s5"]),
    pointerText:
      "The accepted thermal diffusion coefficient uses the temperature, viscosity and particle radius in this relation. Changing the applied force changes the drift, not this coefficient. The separately chosen kick multiplier can change the simulated diffusion.",
    conditions: Object.freeze([
      Object.freeze({
        kind: "status" as const,
        quantityId: "diffusionCoefficient",
        equals: "value" as const,
      }),
    ]),
  }),
  Object.freeze({
    id: "bm04-s3-force-balance",
    instrumentId: "bm-04",
    meaning: "agreement-within-stated-bound" as const,
    targets: Object.freeze(["s3-p7-s2"]),
    pointerText:
      "The numerical owner reports a stationary profile with thermally matched kicks: the largest residual face flux is at most one ten-thousandth of its transport scale. Drift and diffusion balance within that tolerance; at zero force both can vanish.",
    conditions: Object.freeze([
      Object.freeze({ kind: "regime" as const, on: "kickModel", equals: "1" }),
      Object.freeze({ kind: "regime" as const, on: "steadyState", equals: "1" }),
    ]),
  }),
]);
