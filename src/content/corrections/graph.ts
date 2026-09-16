/**
 * Correction Graph and Staleness Propagation.
 * Specification: am-edit-review-records-hofz (§17.2, §17.7, §4.3)
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
  dependencies: readonly string[]; // IDs of upstream nodes this node depends on
}>;

export type StalenessReport = Readonly<{
  correctedId: string;
  correctedLayer: CorrectionLayer;
  staleNodeIds: readonly string[];
  staleReviewTypes: readonly string[];
}>;

export class CorrectionGraph {
  private readonly nodes = new Map<string, GraphNode>();
  private readonly dependents = new Map<string, Set<string>>(); // upstream -> downstream
  private readonly sourceCorrections: Array<{
    id: string;
    revision: number | string;
    timestamp: string;
  }> = [];
  private readonly translationCorrections: Array<{
    id: string;
    revision: number | string;
    timestamp: string;
  }> = [];

  addNode(node: {
    id: string;
    type: GraphNodeType;
    layer: CorrectionLayer;
    revision: number | string;
    unitHash?: string | undefined;
    dependencies?: readonly string[] | undefined;
  }): void {
    const deps = node.dependencies ?? [];
    const fullNode: GraphNode = {
      id: node.id,
      type: node.type,
      layer: node.layer,
      revision: node.revision,
      unitHash: node.unitHash,
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

  recordCorrection(
    id: string,
    newRevision: number | string,
    layer: CorrectionLayer,
    timestamp = new Date().toISOString(),
  ): StalenessReport {
    if (layer === "source") {
      this.sourceCorrections.push({ id, revision: newRevision, timestamp });
    } else if (layer === "translation") {
      this.translationCorrections.push({ id, revision: newRevision, timestamp });
    }

    // Traverse dependents
    const visited = new Set<string>();
    const queue = [...(this.dependents.get(id) ?? [])];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);

      const node = this.nodes.get(current);
      if (!node) continue;

      // Rule: Instrument / visual changes DO NOT stale translation or source reviews
      if (
        layer === "instrument" &&
        (node.type === "source-block" || node.type === "translation-unit")
      ) {
        continue;
      }

      // Add downstream dependents to queue
      const nextDeps = this.dependents.get(current);
      if (nextDeps) {
        for (const dep of nextDeps) {
          if (!visited.has(dep)) {
            queue.push(dep);
          }
        }
      }
    }

    // Determine affected review types
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
    };
  }

  getSourceCorrections(): readonly { id: string; revision: number | string; timestamp: string }[] {
    return Object.freeze([...this.sourceCorrections]);
  }

  getTranslationCorrections(): readonly {
    id: string;
    revision: number | string;
    timestamp: string;
  }[] {
    return Object.freeze([...this.translationCorrections]);
  }
}
