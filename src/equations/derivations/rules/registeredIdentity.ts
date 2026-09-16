/**
 * Apply a registered mathematical or physical identity with cited premises.
 * Identities include kernel normalization, vanishing odd moments of symmetric kernels,
 * vanishing cross-terms of independent zero-mean variables, cosh/sinh identities, etc.
 */

import type { RuleCheckArgs, RuleCheckResult, RuleDefinition } from "./types.ts";

export const REGISTERED_IDENTITY_IDS = [
  "kernel-normalization",
  "odd-moments-symmetric-kernel",
  "independent-zero-mean-product-vanishes",
  "cosh-sinh-identity",
  "linearity-of-average",
  "spatial-isotropy",
  "velocity-addition",
] as const;

export type RegisteredIdentityId = (typeof REGISTERED_IDENTITY_IDS)[number] | string;

export interface RegisteredIdentityParams {
  readonly identityId: RegisteredIdentityId;
  readonly citedPremises?: readonly string[];
}

function check({ params }: RuleCheckArgs): RuleCheckResult {
  const p = params as unknown as RegisteredIdentityParams;
  if (!p.identityId || typeof p.identityId !== "string" || !p.identityId.trim()) {
    return { outcome: "fail", reason: "registered-identity requires a valid identityId." };
  }

  // Specific premise requirements for sensitive identities
  if (p.identityId === "independent-zero-mean-product-vanishes") {
    if (!p.citedPremises || p.citedPremises.length < 2) {
      return {
        outcome: "fail",
        reason:
          "independent-zero-mean-product-vanishes requires cited independence and zero-mean premises.",
      };
    }
  }

  return { outcome: "pass" };
}

export const registeredIdentityRule: RuleDefinition = { kind: "registered-identity", check };
