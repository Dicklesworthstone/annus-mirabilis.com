/**
 * Correction Graph and Staleness Propagation.
 * Specification: am-edit-review-records-hofz (§17.2, §17.7, §4.3)
 *
 * A correction is an edge that records the prior state. Nodes are never
 * silently overwritten: adding a node twice fails, and recording a correction
 * appends history rather than replacing it.
 */

export type CorrectionLayer =
  | "source"
  | "translation"
  | "reading"
  | "equation"
  | "argument"
  | "instrument";

export type GraphNodeType =
  | "source-block"
  | "translation-unit"
  | "reading"
  | "equation"
  | "argument-node"
  | "instrument";

export type GraphNode = Readonly<{
  id: string;
  type: GraphNodeType;
  layer: CorrectionLayer;
  revision: number | string;
  unitHash?: string | undefined;
  dependencies: readonly string[];
}>;

export type CorrectionEdge = Readonly<{
  nodeId: string;
  layer: CorrectionLayer;
  fromRevision: number | string;
  toRevision: number | string;
  timestamp: string;
}>;

export type StalenessReport = Readonly<{
  correctedId: string;
  correctedLayer: CorrectionLayer;
  staleNodeIds: readonly string[];
  staleReviewTypes: readonly string[];
  edge: CorrectionEdge;
}>;

export class CorrectionGraphError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CorrectionGraphError";
    this.code = code;
  }
}

export class CorrectionGraph {
  private readonly nodes = new Map<string, GraphNode>();
  private readonly dependents = new Map<string, Set<string>>();
  private readonly edges: CorrectionEdge[] = [];

  addNode(node: {
    id: string;
    type: GraphNodeType;
    layer: CorrectionLayer;
    revision: number | string;
    unitHash?: string | undefined;
    dependencies?: readonly string[] | undefined;
  }): void {
    if (this.nodes.has(node.id)) {
      throw new CorrectionGraphError(
        "duplicate-node",
        `Node "${node.id}" is already in the correction graph. Corrections are edges; they do not overwrite a node.`,
      );
    }
    const deps = node.dependencies ?? [];
    const fullNode: GraphNode = {
      id: node.id,
      type: node.type,
      layer: node.layer,
      revision: node.revision,
      ...(node.unitHash !== undefined ? { unitHash: node.unitHash } : {}),
      dependencies: Object.freeze([...deps]),
    };

    this.nodes.set(node.id, fullNode);

    for (const upstreamId of deps) {
      let set = this.dependents.get(upstreamId);
      if (!set) {
        set = new Set();
        this.dependents.set(upstreamId, set);
      }
      set.add(node.id);
    }
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  getEdges(): readonly CorrectionEdge[] {
    return Object.freeze([...this.edges]);
  }

  recordCorrection(
    id: string,
    newRevision: number | string,
    layer: CorrectionLayer,
    timestamp = new Date().toISOString(),
  ): StalenessReport {
    const existing = this.nodes.get(id);
    if (!existing) {
      throw new CorrectionGraphError(
        "unknown-node",
        `Cannot correct "${id}": it is not in the graph.`,
      );
    }

    const edge: CorrectionEdge = Object.freeze({
      nodeId: id,
      layer,
      fromRevision: existing.revision,
      toRevision: newRevision,
      timestamp,
    });
    this.edges.push(edge);

    this.nodes.set(id, {
      ...existing,
      revision: newRevision,
    });

    const visited = new Set<string>();
    const queue = [...(this.dependents.get(id) ?? [])];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);

      const node = this.nodes.get(current);
      if (!node) continue;

      if (
        layer === "instrument" &&
        (node.type === "source-block" || node.type === "translation-unit")
      ) {
        continue;
      }

      const nextDeps = this.dependents.get(current);
      if (nextDeps) {
        for (const dep of nextDeps) {
          if (!visited.has(dep)) {
            queue.push(dep);
          }
        }
      }
    }

    const staleReviewTypes = new Set<string>();
    for (const staleId of visited) {
      const n = this.nodes.get(staleId);
      if (!n) continue;
      if (n.type === "translation-unit") staleReviewTypes.add("german-source");
      if (n.type === "reading") {
        staleReviewTypes.add("physics-math");
        staleReviewTypes.add("r2-readability");
      }
      if (n.type === "equation" || n.type === "argument-node") staleReviewTypes.add("physics-math");
      if (n.type === "instrument") staleReviewTypes.add("tour-completion");
    }

    return {
      correctedId: id,
      correctedLayer: layer,
      staleNodeIds: Object.freeze(Array.from(visited)),
      staleReviewTypes: Object.freeze(Array.from(staleReviewTypes)),
      edge,
    };
  }

  /**
   * Validates that a staleness report does not mark unrelated nodes stale.
   * Throws CorrectionGraphError("unrelated-invalidation") if any unrelated node is marked stale.
   */
  validateStalenessBoundary(
    report: StalenessReport,
    unrelatedNodeIds: readonly string[],
  ): void {
    for (const unrelatedId of unrelatedNodeIds) {
      if (report.staleNodeIds.includes(unrelatedId)) {
        throw new CorrectionGraphError(
          "unrelated-invalidation",
          `Correction of "${report.correctedId}" wrongly invalidated unrelated node "${unrelatedId}".`,
        );
      }
    }
  }

  getSourceCorrections(): readonly CorrectionEdge[] {
    return Object.freeze(this.edges.filter((e) => e.layer === "source"));
  }

  getTranslationCorrections(): readonly CorrectionEdge[] {
    return Object.freeze(this.edges.filter((e) => e.layer === "translation"));
  }
}
