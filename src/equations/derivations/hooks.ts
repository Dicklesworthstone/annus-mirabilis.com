/**
 * Hooks and integration interfaces for derivation chain consumers (am-eq-derivation-chains-r4c).
 * Consumed by derivation renderer (am-eq-derivation-renderer-9gd7), genealogy (am-eq-genealogy-hmm),
 * print policy (am-plat-print-3orn), missing-step explorer (am-reason-missing-step-explorer-rsl4),
 * and expression interaction families (am-inst-interaction-families-m2ps).
 */

import type { PremiseEdgeType } from "../../content/schemas/meanings.ts";
import { ruleLibrary } from "./rules/index.ts";
import { auditChainTools } from "./toolAudit.ts";
import type { DerivationChain, DerivationStep, RouteKind } from "./types.ts";

export interface PrintPolicyResult {
  readonly layout: "expanded" | "collapsed";
  readonly chainTitle?: string;
  readonly routeLabel?: string;
}

export interface GenealogyPremiseEdge {
  readonly from: string;
  readonly to: string;
  readonly edgeType: PremiseEdgeType;
  readonly chainId: string;
}

/**
 * Returns all derivation steps associated with a target equation or result ID across chains.
 */
export function stepsForTarget(
  chains: readonly DerivationChain[],
  targetId: string,
): readonly DerivationStep[] {
  return Object.freeze(chains.filter((c) => c.target === targetId).flatMap((c) => c.steps));
}

/**
 * Returns the changed subexpression IDs for a derivation step.
 */
export function changedIdsForStep(step: DerivationStep): readonly string[] {
  return step.changedSubexpressionIds;
}

/**
 * Returns premise edges for the equation genealogy map.
 * In historical view, only historical-derivation and pedagogical-reconstruction edges are included.
 * In modernLens view, modern-verification-oracle edges are also included.
 */
export function premiseEdgesForGenealogy(
  chains: readonly DerivationChain[],
  modernLens: boolean = false,
): readonly GenealogyPremiseEdge[] {
  const edges: GenealogyPremiseEdge[] = [];

  for (const chain of chains) {
    for (const step of chain.steps) {
      for (const pRef of step.premiseRefs) {
        if (pRef.edgeType === "cross-reference") continue;

        if (
          pRef.edgeType === "historical-derivation" ||
          pRef.edgeType === "pedagogical-reconstruction" ||
          (modernLens && pRef.edgeType === "modern-verification-oracle")
        ) {
          edges.push({
            from: pRef.ref,
            to: step.id,
            edgeType: pRef.edgeType,
            chainId: chain.id,
          });
        }
      }
    }
  }

  return Object.freeze(edges);
}

/**
 * Returns the reference evaluator / code slot identifier for a derivation chain.
 */
export function codeSlotFor(chainId: string): string | null {
  return `evaluator:${chainId}`;
}

/**
 * Evaluates print policy layout for a derivation chain.
 * - essentialForPrint: true -> expanded
 * - essentialForPrint: false -> collapsed
 * - absent: source-order -> expanded; discovery / pedagogical-reconstruction / modern-verification -> collapsed
 */
export function printPolicyFor(chain: DerivationChain): PrintPolicyResult {
  const routeLabelMap: Record<RouteKind, string> = {
    "source-order": "Original 1905 Derivation",
    discovery: "Discovery Path",
    "pedagogical-reconstruction": "Step-by-Step Reconstruction",
    "modern-verification": "Modern Verification Oracle",
  };

  const routeLabel = routeLabelMap[chain.routeKind];
  const chainTitle = `${chain.id} (${routeLabel})`;

  if (chain.essentialForPrint === true) {
    return Object.freeze({ layout: "expanded", chainTitle, routeLabel });
  }
  if (chain.essentialForPrint === false) {
    return Object.freeze({ layout: "collapsed", chainTitle, routeLabel });
  }

  if (chain.routeKind === "source-order") {
    return Object.freeze({ layout: "expanded", chainTitle, routeLabel });
  }

  return Object.freeze({ layout: "collapsed", chainTitle, routeLabel });
}

export { auditChainTools, ruleLibrary };
