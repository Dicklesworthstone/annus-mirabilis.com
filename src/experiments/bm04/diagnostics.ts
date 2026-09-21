import type { ScientificResult } from "../results/types.ts";
import { BM04_OUTPUTS } from "./definition.ts";

/** Preserve the distinction between an absent diffusion scale and a failed computation. */
export function bm04PecletResult(kickDiffusivity: number, peclet: number): ScientificResult {
  const contract = BM04_OUTPUTS.pecletNumber;
  if (!contract) throw new TypeError("Missing BM-04 Peclet output contract.");
  const identity = {
    quantityId: "pecletNumber",
    unit: contract.unit,
    semanticKind: contract.semanticKind,
    ownerId: contract.ownerId,
  };
  if (!Number.isFinite(kickDiffusivity) || kickDiffusivity < 0 || Number.isNaN(peclet)) {
    throw new RangeError(
      "The Peclet diagnostic requires a nonnegative finite diffusivity and a valid ratio.",
    );
  }
  if (kickDiffusivity === 0) {
    return {
      ...identity,
      status: "not-applicable",
      reason:
        "With kicks off there is no diffusive scale, so the Peclet ratio is not a finite diagnostic. The drift-only or frozen calculation remains valid.",
    };
  }
  if (!Number.isFinite(peclet)) {
    return {
      ...identity,
      status: "outside-domain",
      condition: "grid Peclet ratio exceeds binary64 range",
      domainKind: "numerical",
      reason:
        "The drift-to-diffusion ratio has no finite binary64 representation; this does not invalidate the accepted density and fluxes.",
      boundary: {
        alternativeModel: "Increase the kick diffusivity or reduce the drift-to-diffusion ratio.",
      },
    };
  }
  return { ...identity, status: "value", value: peclet };
}
