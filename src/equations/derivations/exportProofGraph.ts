/**
 * Export derivation proof graph for acyclicity, dependency resolution,
 * and edge-type validation (am-eq-derivation-chains-r4c).
 * - Logical premise edges (historical-derivation, pedagogical-reconstruction, modern-verification-oracle) must be acyclic.
 * - Non-premise cross-reference edges are permitted to contain cycles.
 * - Historical routes (source-order, discovery) must not cite modern-verification-oracle edges as derivation premises.
 */

import type { PremiseEdgeType } from "../../content/schemas/meanings.ts";
import type { DerivationChain, RouteKind } from "./types.ts";

export interface ProofGraphNode {
  readonly id: string;
  readonly kind: "step" | "premise" | "entry-assumption" | "target";
  readonly label?: string | undefined;
  readonly chainId?: string | undefined;
  readonly proofRouteId?: string | undefined;
}

export interface ProofGraphEdge {
  readonly from: string;
  readonly to: string;
  readonly edgeType: PremiseEdgeType;
  readonly isPremise: boolean;
}

export interface ProofRouteGraph {
  readonly chainId: string;
  readonly proofRouteId: string;
  readonly routeKind: RouteKind;
  readonly essentialForPrint?: boolean | undefined;
  readonly nodes: readonly ProofGraphNode[];
  readonly edges: readonly ProofGraphEdge[];
  readonly isAcyclic: boolean;
  readonly cyclePath?: readonly string[] | undefined;
  readonly edgeTypeViolations: readonly string[];
}

export interface ProofGraphExport {
  readonly target: string;
  readonly routes: readonly ProofRouteGraph[];
}

/**
 * Finds a directed cycle in a graph given an adjacency list of premise edges.
 * Returns the cycle path as an array of node IDs (e.g. ["A", "B", "C", "A"]) if found.
 */
function findDirectedCycle(adj: Map<string, string[]>): string[] | null {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const parent = new Map<string, string>();

  for (const node of adj.keys()) {
    if (visited.has(node)) continue;

    const stack: { u: string; edgeIdx: number }[] = [{ u: node, edgeIdx: 0 }];
    visited.add(node);
    inStack.add(node);

    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (!top) break;

      const neighbors = adj.get(top.u) ?? [];

      if (top.edgeIdx < neighbors.length) {
        const v = neighbors[top.edgeIdx];
        top.edgeIdx += 1;
        if (v === undefined) continue;

        if (inStack.has(v)) {
          // Cycle found: reconstruct path from v to top.u back to v
          const cycle: string[] = [v];
          for (let i = stack.length - 1; i >= 0; i--) {
            const frame = stack[i];
            if (!frame) continue;
            cycle.unshift(frame.u);
            if (frame.u === v) break;
          }
          if (cycle[0] !== v) {
            cycle.unshift(v);
          }
          return cycle;
        }

        if (!visited.has(v)) {
          visited.add(v);
          inStack.add(v);
          parent.set(v, top.u);
          stack.push({ u: v, edgeIdx: 0 });
        }
      } else {
        inStack.delete(top.u);
        stack.pop();
      }
    }
  }

  return null;
}

export function exportProofRouteGraph(chain: DerivationChain): ProofRouteGraph {
  const nodesMap = new Map<string, ProofGraphNode>();
  const edges: ProofGraphEdge[] = [];
  const premiseAdj = new Map<string, string[]>();
  const edgeTypeViolations: string[] = [];

  const addNode = (id: string, kind: ProofGraphNode["kind"], label?: string) => {
    if (!nodesMap.has(id)) {
      nodesMap.set(id, { id, kind, label, chainId: chain.id, proofRouteId: chain.proofRouteId });
    }
    if (!premiseAdj.has(id)) {
      premiseAdj.set(id, []);
    }
  };

  // Add target node
  addNode(chain.target, "target", chain.target);

  // Add entry assumptions
  for (const assumption of chain.entryAssumptions) {
    addNode(assumption.ref, "entry-assumption", assumption.ref);
  }

  const isHistoricalRoute = chain.routeKind === "source-order" || chain.routeKind === "discovery";

  // Build step nodes and edges
  for (let i = 0; i < chain.steps.length; i++) {
    const step = chain.steps[i];
    if (!step) continue;

    addNode(step.id, "step", step.isMove ? `[MOVE] ${step.moveLabel ?? step.id}` : step.id);

    // Sequential step flow
    if (i > 0) {
      const prevStep = chain.steps[i - 1];
      if (prevStep) {
        const edge: ProofGraphEdge = {
          from: prevStep.id,
          to: step.id,
          edgeType:
            chain.routeKind === "source-order"
              ? "historical-derivation"
              : "pedagogical-reconstruction",
          isPremise: true,
        };
        edges.push(edge);
        premiseAdj.get(prevStep.id)?.push(step.id);
      }
    }

    // Step premise references
    for (const pRef of step.premiseRefs) {
      const isPremise = pRef.edgeType !== "cross-reference";
      addNode(pRef.ref, isPremise ? "premise" : "premise", pRef.ref);

      const edge: ProofGraphEdge = {
        from: pRef.ref,
        to: step.id,
        edgeType: pRef.edgeType,
        isPremise,
      };
      edges.push(edge);

      // Only premise edges count towards cycle detection
      if (isPremise) {
        premiseAdj.get(pRef.ref)?.push(step.id);

        // Check historical route constraint
        if (isHistoricalRoute && pRef.edgeType === "modern-verification-oracle") {
          edgeTypeViolations.push(
            `step "${step.id}" in ${chain.routeKind} route cites modern-verification-oracle "${pRef.ref}" as a derivation premise.`,
          );
        }
      }
    }
  }

  // Connect last step to target
  if (chain.steps.length > 0) {
    const lastStep = chain.steps[chain.steps.length - 1];
    if (lastStep) {
      const edge: ProofGraphEdge = {
        from: lastStep.id,
        to: chain.target,
        edgeType:
          chain.routeKind === "source-order"
            ? "historical-derivation"
            : "pedagogical-reconstruction",
        isPremise: true,
      };
      edges.push(edge);
      premiseAdj.get(lastStep.id)?.push(chain.target);
    }
  }

  // Run cycle detection on premise graph
  const cycle = findDirectedCycle(premiseAdj);
  const isAcyclic = cycle === null;

  return Object.freeze({
    chainId: chain.id,
    proofRouteId: chain.proofRouteId,
    routeKind: chain.routeKind,
    ...(chain.essentialForPrint !== undefined
      ? { essentialForPrint: chain.essentialForPrint }
      : {}),
    nodes: Object.freeze(Array.from(nodesMap.values())),
    edges: Object.freeze(edges),
    isAcyclic,
    ...(cycle ? { cyclePath: Object.freeze(cycle) } : {}),
    edgeTypeViolations: Object.freeze(edgeTypeViolations),
  });
}

export function exportProofGraph(chain: DerivationChain): ProofGraphExport {
  return Object.freeze({
    target: chain.target,
    routes: Object.freeze([exportProofRouteGraph(chain)]),
  });
}

export function exportProofGraphs(chains: readonly DerivationChain[]): readonly ProofGraphExport[] {
  const byTarget = new Map<string, ProofRouteGraph[]>();

  for (const chain of chains) {
    const route = exportProofRouteGraph(chain);
    const existing = byTarget.get(chain.target) ?? [];
    existing.push(route);
    byTarget.set(chain.target, existing);
  }

  return Object.freeze(
    Array.from(byTarget.entries()).map(([target, routes]) =>
      Object.freeze({
        target,
        routes: Object.freeze(routes),
      }),
    ),
  );
}
