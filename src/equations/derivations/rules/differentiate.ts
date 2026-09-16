/**
 * Differentiate with respect to a variable with an explicit held-fixed set.
 */

import type { RuleCheckArgs, RuleCheckResult, RuleDefinition } from "./types.ts";

export interface DifferentiateParams {
  readonly variable: string;
  readonly heldFixed?: readonly string[];
  readonly order?: number;
}

function check({ params }: RuleCheckArgs): RuleCheckResult {
  const p = params as unknown as DifferentiateParams;
  if (!p.variable || typeof p.variable !== "string" || !p.variable.trim()) {
    return { outcome: "fail", reason: "differentiate requires a variable of differentiation." };
  }
  return {
    outcome: "unverifiable",
    reason:
      "symbolic differentiation is not checked structurally; requires a spot check and review.",
  };
}

export const differentiateRule: RuleDefinition = { kind: "differentiate", check };
