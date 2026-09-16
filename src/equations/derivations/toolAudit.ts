/**
 * Audit derivation chain steps for foundation tool linkage (am-eq-derivation-chains-r4c).
 * - Steps without a `tool` are `pending` (valid during authoring; foundations attach them later).
 * - Steps with a `tool` that fails to resolve in the foundation registry are `errors`.
 * - Malformed tool IDs are rejected at the schema level.
 */

import type { DerivationChain, ReasonKind, RuleKind } from "./types.ts";

export interface PendingToolStep {
  readonly chainId: string;
  readonly proofRouteId: string;
  readonly stepId: string;
  readonly reasonKind: ReasonKind;
  readonly ruleKind: RuleKind;
  readonly sourceAnchor?: string | undefined;
  readonly r1Excerpt: string;
}

export interface ErrorToolStep {
  readonly chainId: string;
  readonly proofRouteId: string;
  readonly stepId: string;
  readonly toolId: string;
  readonly reason: string;
}

export interface ToolAuditReport {
  readonly pending: readonly PendingToolStep[];
  readonly errors: readonly ErrorToolStep[];
  readonly totalSteps: number;
  readonly validSteps: number;
}

export function auditChainTools(
  chains: readonly DerivationChain[],
  registry?: ReadonlySet<string> | readonly string[] | Record<string, unknown> | null,
): ToolAuditReport {
  const pending: PendingToolStep[] = [];
  const errors: ErrorToolStep[] = [];
  let totalSteps = 0;
  let validSteps = 0;

  // Normalize registry lookup set
  let registrySet: Set<string> | null = null;
  if (registry) {
    if (registry instanceof Set) {
      registrySet = registry;
    } else if (Array.isArray(registry)) {
      registrySet = new Set(registry);
    } else if (typeof registry === "object") {
      registrySet = new Set(Object.keys(registry));
    }
  }

  for (const chain of chains) {
    for (const step of chain.steps) {
      totalSteps += 1;

      if (!step.tool) {
        pending.push({
          chainId: chain.id,
          proofRouteId: chain.proofRouteId,
          stepId: step.id,
          reasonKind: step.reasonKind,
          ruleKind: step.rule.kind,
          sourceAnchor: step.sourceAnchor,
          r1Excerpt: (step.reasons?.r1 ?? "").slice(0, 120),
        });
      } else if (registrySet !== null) {
        if (!registrySet.has(step.tool)) {
          errors.push({
            chainId: chain.id,
            proofRouteId: chain.proofRouteId,
            stepId: step.id,
            toolId: step.tool,
            reason: `tool id "${step.tool}" does not resolve in foundation registry.`,
          });
        } else {
          validSteps += 1;
        }
      } else {
        // Tool is present and no registry supplied -> considered valid
        validSteps += 1;
      }
    }
  }

  return Object.freeze({
    pending: Object.freeze(pending),
    errors: Object.freeze(errors),
    totalSteps,
    validSteps,
  });
}
