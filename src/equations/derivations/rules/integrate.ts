/**
 * Integrate, which must introduce a named integration constant or cite the
 * boundary condition that fixes it. Symbolic integration correctness is
 * not checkable by structural equality in general; this checker enforces
 * the one side condition it can enforce (the constant/boundary
 * requirement) and reports the transformation itself as `unverifiable`,
 * so `verifyChain.ts` requires it to be authored `authored-unverified`
 * with a passing spot check rather than silently accepted as `verified`.
 */

import { containsId } from "../treeUtils.ts";
import type { RuleCheckArgs, RuleCheckResult, RuleDefinition } from "./types.ts";

export interface IntegrateParams {
  readonly variable: string;
  readonly integrationConstant?: string;
  readonly boundaryCondition?: string;
}

function check({ to, params }: RuleCheckArgs): RuleCheckResult {
  const p = params as unknown as IntegrateParams;
  if (!p.variable?.trim()) {
    return { outcome: "fail", reason: "integrate requires a variable of integration." };
  }
  const hasConstant = Boolean(p.integrationConstant?.trim());
  const hasBoundary = Boolean(p.boundaryCondition?.trim());
  if (!hasConstant && !hasBoundary) {
    return {
      outcome: "fail",
      reason:
        "integrate must introduce a named integration constant or cite the boundary condition that fixes it.",
    };
  }
  if (hasConstant && p.integrationConstant && !containsId(to, p.integrationConstant)) {
    return {
      outcome: "fail",
      reason: `the named integration constant "${p.integrationConstant}" does not appear in "to".`,
    };
  }
  return {
    outcome: "unverifiable",
    reason: "symbolic integration is not checked structurally; requires a spot check and review.",
  };
}

export const integrateRule: RuleDefinition = { kind: "integrate", check };
