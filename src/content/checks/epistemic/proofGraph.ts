/**
 * Proof-graph rejections: cycles among derivation edges, and oracles on
 * historical routes (am-cm-checks-epistemic-o7n).
 */

export const DERIVATION_EDGE_TYPES = [
  "historical-derivation",
  "modern-verification-oracle",
  "pedagogical-reconstruction",
] as const;

export type DerivationEdgeType = (typeof DERIVATION_EDGE_TYPES)[number];

export const HISTORICAL_PROOF_ROUTES = ["source-order", "discovery"] as const;

export type ProofGraphNode = Readonly<{
  id: string;
  premises: readonly Readonly<{
    ref: Readonly<{ kind: string; id: string }>;
    edgeType: string;
  }>[];
  prerequisites: readonly Readonly<{ foundationId: string; kind: string }>[];
}>;

export type ProofRecord = Readonly<{
  id: string;
  route: string;
  argumentNodeIds: readonly string[];
}>;

function isDerivationEdge(edgeType: string): boolean {
  return (DERIVATION_EDGE_TYPES as readonly string[]).includes(edgeType);
}

function neighbors(node: ProofGraphNode, nodeIds: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const p of node.premises) {
    if (!isDerivationEdge(p.edgeType)) continue;
    if (p.ref.kind === "argument" && nodeIds.has(p.ref.id)) out.push(p.ref.id);
  }
  for (const pr of node.prerequisites) {
    if (pr.kind === "proof-edge" && nodeIds.has(pr.foundationId)) out.push(pr.foundationId);
  }
  return out;
}

/**
 * Iterative DFS that returns the first cycle path (including the repeated start),
 * or null if the selected proof's derivation edges are acyclic.
 */
export function findProofCycle(
  nodes: readonly ProofGraphNode[],
  proof: ProofRecord,
): readonly string[] | null {
  const selected = new Set(proof.argumentNodeIds);
  const byId = new Map(nodes.filter((n) => selected.has(n.id)).map((n) => [n.id, n]));

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const parent = new Map<string, string | null>();

  type Frame = { id: string; i: number; kids: string[] };
  for (const start of proof.argumentNodeIds) {
    const startNode = byId.get(start);
    if (visited.has(start) || !startNode) continue;
    const stack: Frame[] = [{ id: start, i: 0, kids: neighbors(startNode, selected) }];
    parent.set(start, null);
    inStack.add(start);
    visited.add(start);

    while (stack.length) {
      const frame = stack[stack.length - 1];
      if (!frame) break;
      if (frame.i >= frame.kids.length) {
        inStack.delete(frame.id);
        stack.pop();
        continue;
      }
      const next = frame.kids[frame.i];
      frame.i += 1;
      if (next === undefined) continue;
      if (inStack.has(next)) {
        const cycle = [next];
        for (let i = stack.length - 1; i >= 0; i--) {
          const step = stack[i];
          if (!step) continue;
          cycle.push(step.id);
          if (step.id === next) break;
        }
        cycle.reverse();
        return cycle;
      }
      if (visited.has(next)) continue;
      const node = byId.get(next);
      visited.add(next);
      inStack.add(next);
      parent.set(next, frame.id);
      stack.push({ id: next, i: 0, kids: node ? neighbors(node, selected) : [] });
    }
  }
  return null;
}

export function historicalRouteUsesOracle(
  nodes: readonly ProofGraphNode[],
  proof: ProofRecord,
): Readonly<{ nodeId: string; premiseId: string }> | null {
  if (!(HISTORICAL_PROOF_ROUTES as readonly string[]).includes(proof.route)) return null;
  const selected = new Set(proof.argumentNodeIds);
  for (const node of nodes) {
    if (!selected.has(node.id)) continue;
    for (const p of node.premises ?? []) {
      if (p.edgeType === "modern-verification-oracle") {
        return { nodeId: node.id, premiseId: p.ref.id };
      }
    }
  }
  return null;
}
