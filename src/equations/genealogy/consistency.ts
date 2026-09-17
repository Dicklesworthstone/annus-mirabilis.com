/**
 * Consistency validator for Equation Genealogy (am-eq-genealogy-hmm).
 *
 * Validates:
 * 1. Two-way consistency between derivation chain premises and genealogy edges.
 * 2. Numbered results must have incoming premise lineage (no orphan results).
 * 3. Special Relativity (Paper 3) invariant: EXACTLY ONE outgoing cross-paper edge to Paper 4 (§8 energy transformation).
 * 4. Negative constraints: no modern verification oracles in historical view, no spurious edges, DAG acyclicity.
 */

import type { SemanticEquation } from "../../content/schemas/argument.ts";
import type { DerivationChain } from "../derivations/types.ts";
import type { GenealogyDiagnostic, GenealogyEdge, GenealogyGraph } from "./types.ts";

export interface ConsistencyValidationOptions {
  readonly admittedCustomEdges?: readonly GenealogyEdge[] | undefined;
  readonly isPaper3?: boolean | undefined;
}

/**
 * Finds a directed cycle in an adjacency list using DFS.
 */
function findCycleInAdjacency(adj: Map<string, string[]>): string[] | null {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const parent = new Map<string, string>();

  for (const startNode of adj.keys()) {
    if (visited.has(startNode)) continue;

    const stack: { u: string; edgeIdx: number }[] = [{ u: startNode, edgeIdx: 0 }];
    visited.add(startNode);
    inStack.add(startNode);

    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (!top) break;

      const neighbors = adj.get(top.u) ?? [];

      if (top.edgeIdx < neighbors.length) {
        const v = neighbors[top.edgeIdx]!;
        top.edgeIdx += 1;

        if (inStack.has(v)) {
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

export function validateGenealogyConsistency(
  graph: GenealogyGraph,
  equations: readonly (SemanticEquation | Record<string, unknown>)[] = [],
  chains: readonly DerivationChain[] = [],
  options: ConsistencyValidationOptions = {},
): readonly GenealogyDiagnostic[] {
  const diagnostics: GenealogyDiagnostic[] = [];

  // Build lookup of graph edges
  const edgeSet = new Set<string>();
  for (const e of graph.edges) {
    edgeSet.add(`${e.from}->${e.to}`);
  }

  // Build lookup of authorized edges from equations (usedBy) and chains (premiseRefs, steps, entryAssumptions)
  const authorizedEdges = new Set<string>();
  for (const eq of equations) {
    const dLinks = eq.derivationLinks as
      | { chainIds?: readonly string[]; usedBy?: readonly string[] }
      | undefined;
    if (eq.id && dLinks?.usedBy) {
      for (const targetId of dLinks.usedBy) {
        authorizedEdges.add(`${eq.id}->${targetId}`);
      }
    }
  }

  for (const chain of chains) {
    const firstStep = chain.steps[0];
    const initialTarget = firstStep ? firstStep.id : chain.target;

    for (const assumption of chain.entryAssumptions) {
      authorizedEdges.add(`${assumption.ref}->${initialTarget}`);

      // Check if chain premise edge is missing in graph (unless modern oracle in historical view)
      const isModernOracle = assumption.edgeType === "modern-verification-oracle";
      if (!(graph.perspective === "historical" && isModernOracle)) {
        if (!edgeSet.has(`${assumption.ref}->${initialTarget}`)) {
          diagnostics.push({
            code: "missing-premise-edge",
            message: `Derivation chain "${chain.id}" cites entry assumption "${assumption.ref}" -> "${initialTarget}" but no genealogy edge exists.`,
            edge: { from: assumption.ref, to: initialTarget },
          });
        }
      }
    }

    for (let i = 0; i < chain.steps.length; i++) {
      const step = chain.steps[i]!;

      if (i > 0) {
        const prevStep = chain.steps[i - 1]!;
        authorizedEdges.add(`${prevStep.id}->${step.id}`);
        const isModernOracle = chain.routeKind === "modern-verification";
        if (!(graph.perspective === "historical" && isModernOracle)) {
          if (!edgeSet.has(`${prevStep.id}->${step.id}`)) {
            diagnostics.push({
              code: "missing-premise-edge",
              message: `Derivation chain "${chain.id}" sequential step "${prevStep.id}" -> "${step.id}" is missing in genealogy.`,
              edge: { from: prevStep.id, to: step.id },
            });
          }
        }
      }

      for (const pRef of step.premiseRefs) {
        authorizedEdges.add(`${pRef.ref}->${step.id}`);
        const isModernOracle = pRef.edgeType === "modern-verification-oracle";
        if (!(graph.perspective === "historical" && isModernOracle)) {
          if (!edgeSet.has(`${pRef.ref}->${step.id}`)) {
            diagnostics.push({
              code: "missing-premise-edge",
              message: `Derivation chain "${chain.id}" step "${step.id}" cites premise "${pRef.ref}" but no genealogy edge exists.`,
              edge: { from: pRef.ref, to: step.id },
            });
          }
        }
      }
    }

    if (chain.steps.length > 0 && chain.target) {
      const lastStep = chain.steps[chain.steps.length - 1]!;
      authorizedEdges.add(`${lastStep.id}->${chain.target}`);
      const isModernOracle = chain.routeKind === "modern-verification";
      if (!(graph.perspective === "historical" && isModernOracle)) {
        if (!edgeSet.has(`${lastStep.id}->${chain.target}`)) {
          diagnostics.push({
            code: "missing-premise-edge",
            message: `Derivation chain "${chain.id}" target connection "${lastStep.id}" -> "${chain.target}" is missing in genealogy.`,
            edge: { from: lastStep.id, to: chain.target },
          });
        }
      }
    }
  }

  if (options.admittedCustomEdges) {
    for (const ce of options.admittedCustomEdges) {
      authorizedEdges.add(`${ce.from}->${ce.to}`);
    }
  }

  // 2. Check for spurious genealogy edges (edges not authorized by equations, chains, or declared edges)
  for (const edge of graph.edges) {
    if (!authorizedEdges.has(`${edge.from}->${edge.to}`)) {
      diagnostics.push({
        code: "spurious-genealogy-edge",
        message: `Genealogy edge "${edge.from}" -> "${edge.to}" has no supporting derivation chain premise or usedBy reference.`,
        edge: { from: edge.from, to: edge.to },
      });
    }
  }

  // 3. Orphan result detection: numbered results with in-degree 0 in premise edges that are not roots
  const premiseInDegree = new Map<string, number>();
  for (const node of graph.nodes) {
    premiseInDegree.set(node.id, 0);
  }
  for (const edge of graph.edges) {
    if (edge.isPremise && premiseInDegree.has(edge.to)) {
      premiseInDegree.set(edge.to, (premiseInDegree.get(edge.to) ?? 0) + 1);
    }
  }

  for (const node of graph.nodes) {
    if (node.isNumberedResult && !node.isRoot) {
      const inDeg = premiseInDegree.get(node.id) ?? 0;
      if (inDeg === 0) {
        diagnostics.push({
          code: "genealogy-orphan-result",
          message: `Numbered equation result "${node.id}" has no incoming premise edges and is not a declared root.`,
          nodeId: node.id,
          anchor: node.anchor ?? node.id,
        });
      }
    }
  }

  // 4. Special Relativity (Paper 3) Cross-Paper Invariant
  const isPaper3 =
    options.isPaper3 ??
    (graph.paper === "special-relativity" || graph.paper === "sr" || graph.paper === "ap-17-891");

  if (isPaper3) {
    const outgoingCrossPaper = graph.edges.filter((e) => {
      if (!e.crossPaper) return false;
      const targetPaper = e.targetPaper ?? e.provenance?.sourcePaper;
      return targetPaper !== undefined && targetPaper !== "special-relativity" && targetPaper !== "sr";
    });

    if (outgoingCrossPaper.length === 0) {
      diagnostics.push({
        code: "invalid-cross-paper-edge-set",
        message:
          "Special Relativity (Paper 3) must have exactly one outgoing cross-paper edge to Paper 4 (Section 8 light energy transformation), but found 0.",
      });
    } else if (outgoingCrossPaper.length > 1) {
      diagnostics.push({
        code: "invalid-cross-paper-edge-set",
        message: `Special Relativity (Paper 3) must have exactly one outgoing cross-paper edge to Paper 4, but found ${outgoingCrossPaper.length} edges.`,
      });
    } else {
      const singleEdge = outgoingCrossPaper[0]!;
      const targetPaper = singleEdge.targetPaper ?? singleEdge.provenance?.sourcePaper;
      if (targetPaper !== "mass-energy" && targetPaper !== "me" && targetPaper !== "ap-18-639") {
        diagnostics.push({
          code: "invalid-cross-paper-edge-set",
          message: `Special Relativity (Paper 3) outgoing cross-paper edge must target Paper 4 ('mass-energy'), but targets '${targetPaper}'.`,
          edge: { from: singleEdge.from, to: singleEdge.to },
        });
      }
    }
  }

  // 5. Check modern oracle in historical view
  if (graph.perspective === "historical") {
    for (const edge of graph.edges) {
      if (edge.edgeType === "modern-verification-oracle") {
        diagnostics.push({
          code: "modern-oracle-in-historical-view",
          message: `Modern verification oracle edge "${edge.from}" -> "${edge.to}" is forbidden in historical perspective.`,
          edge: { from: edge.from, to: edge.to },
        });
      }
    }
  }

  // 6. DAG Premise Acyclicity
  const premiseAdj = new Map<string, string[]>();
  for (const node of graph.nodes) {
    premiseAdj.set(node.id, []);
  }
  for (const edge of graph.edges) {
    if (edge.isPremise) {
      premiseAdj.get(edge.from)?.push(edge.to);
    }
  }
  const cycle = findCycleInAdjacency(premiseAdj);
  if (cycle) {
    diagnostics.push({
      code: "genealogy-cycle-detected",
      message: `Cycle detected in premise edges: ${cycle.join(" -> ")}`,
    });
  }

  return Object.freeze(diagnostics);
}
