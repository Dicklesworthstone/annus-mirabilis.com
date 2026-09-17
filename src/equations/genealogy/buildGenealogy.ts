/**
 * Constructs the Equation Genealogy Graph (am-eq-genealogy-hmm).
 *
 * Extracts nodes and edges from equations, derivation chains, and `usedBy`
 * references. Enforces perspective filtering (modern verification oracles
 * excluded from historical perspective) and tags cross-paper edges with
 * provenance.
 */

import type { SemanticEquation } from "../../content/schemas/argument.ts";
import {
  LOGICAL_ROLES,
  type LogicalRole,
  type PremiseEdgeType,
} from "../../content/schemas/meanings.ts";
import type { AdmittedImport, DerivationChain } from "../derivations/types.ts";
import type {
  GenealogyEdge,
  GenealogyGraph,
  GenealogyNode,
  GenealogyNodeType,
  GenealogyPerspective,
} from "./types.ts";

export interface BuildGenealogyOptions {
  readonly perspective?: GenealogyPerspective | undefined;
  readonly declaredRoots?: readonly string[] | undefined;
  readonly declaredResults?: readonly string[] | undefined;
  readonly admittedImports?: readonly AdmittedImport[] | undefined;
  readonly customNodes?: readonly GenealogyNode[] | undefined;
  readonly customEdges?: readonly GenealogyEdge[] | undefined;
}

function isLogicalRole(val: unknown): val is LogicalRole {
  return typeof val === "string" && (LOGICAL_ROLES as readonly string[]).includes(val);
}

function extractLatexFromNotationForms(val: unknown): string | undefined {
  if (!val || typeof val !== "object" || Array.isArray(val)) return undefined;
  const obj = val as Record<string, unknown>;
  const source = obj.source;
  if (source && typeof source === "object" && !Array.isArray(source)) {
    const sObj = source as Record<string, unknown>;
    if (typeof sObj.latex === "string" && sObj.latex.trim().length > 0) {
      return sObj.latex;
    }
  }
  const modern = obj.modern;
  if (modern && typeof modern === "object" && !Array.isArray(modern)) {
    const mObj = modern as Record<string, unknown>;
    if (typeof mObj.latex === "string" && mObj.latex.trim().length > 0) {
      return mObj.latex;
    }
  }
  return undefined;
}

interface DerivationLinksInfo {
  readonly chainIds: readonly string[];
  readonly usedBy: readonly string[];
}

function extractDerivationLinks(val: unknown): DerivationLinksInfo | undefined {
  if (!val || typeof val !== "object" || Array.isArray(val)) return undefined;
  const obj = val as Record<string, unknown>;
  const chainIds = Array.isArray(obj.chainIds)
    ? obj.chainIds.filter((x): x is string => typeof x === "string")
    : [];
  const usedBy = Array.isArray(obj.usedBy)
    ? obj.usedBy.filter((x): x is string => typeof x === "string")
    : [];
  return { chainIds, usedBy };
}

export function extractPaperFromId(id: string, defaultPaper: string): string {
  if (/-sr-|^sr-|^premise-sr-|^chain-sr-/.test(id)) return "special-relativity";
  if (/-me-|^me-|^premise-me-|^chain-me-/.test(id)) return "mass-energy";
  if (/-bm-|^bm-|^premise-bm-|^chain-bm-/.test(id)) return "brownian-motion";
  if (/-lq-|^lq-|^premise-lq-|^chain-lq-/.test(id)) return "light-quanta";
  if (/-md-|^md-|^premise-md-|^chain-md-/.test(id)) return "molecular-dimensions";
  return defaultPaper;
}

function extractSectionFromId(id: string): string | undefined {
  const match = id.match(/-(?:s|sec)(\d+)-/i) || id.match(/-s(\d+)$/i);
  return match?.[1] ? `§${match[1]}` : undefined;
}

function formatLabel(id: string): string {
  const parts = id.replace(/^(?:eq|premise|chain)-/, "").split("-");
  return parts.map((p) => (p.length > 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p)).join(" ");
}

/**
 * Builds a GenealogyGraph for a given paper from equations, derivation chains,
 * and options.
 */
export function buildGenealogy(
  paper: string,
  equations: readonly (SemanticEquation | Record<string, unknown>)[],
  chains: readonly DerivationChain[] = [],
  options: BuildGenealogyOptions = {},
): GenealogyGraph {
  const perspective: GenealogyPerspective = options.perspective ?? "historical";
  const declaredRootsSet = new Set(options.declaredRoots ?? []);
  const declaredResultsSet = new Set(options.declaredResults ?? []);

  const nodeMap = new Map<string, GenealogyNode>();

  const registerNode = (node: GenealogyNode) => {
    const existing = nodeMap.get(node.id);
    if (!existing) {
      nodeMap.set(node.id, node);
    } else {
      nodeMap.set(node.id, {
        ...existing,
        label: existing.label || node.label,
        spokenForm: existing.spokenForm ?? node.spokenForm,
        latex: existing.latex ?? node.latex,
        anchor: existing.anchor ?? node.anchor,
        isRoot: existing.isRoot || node.isRoot,
        isNumberedResult: existing.isNumberedResult || node.isNumberedResult,
        isTarget: existing.isTarget || node.isTarget,
        section: existing.section ?? node.section,
        logicalRole: existing.logicalRole ?? node.logicalRole,
      });
    }
  };

  // 1. Process authored equations
  for (const item of equations) {
    const eq = item as Record<string, unknown>;
    const id = typeof eq.id === "string" && eq.id.trim().length > 0 ? eq.id.trim() : "";
    if (!id) continue;

    const eqPaper =
      typeof eq.paper === "string" && eq.paper.trim().length > 0
        ? eq.paper.trim()
        : extractPaperFromId(id, paper);

    let logicalRole: LogicalRole | undefined;
    if (eq.meanings && typeof eq.meanings === "object" && !Array.isArray(eq.meanings)) {
      const candidate = (eq.meanings as Record<string, unknown>).logicalRole;
      if (isLogicalRole(candidate)) {
        logicalRole = candidate;
      }
    }

    const plainLatex =
      typeof eq.plainLatex === "string" && eq.plainLatex.trim().length > 0
        ? eq.plainLatex
        : undefined;
    const latex = extractLatexFromNotationForms(eq.notationForms) ?? plainLatex;

    const derivationLinks = extractDerivationLinks(eq.derivationLinks);
    const isRoot =
      declaredRootsSet.has(id) ||
      (logicalRole === "assumption" && (!derivationLinks || derivationLinks.chainIds.length === 0));

    const isNumberedResult =
      declaredResultsSet.has(id) ||
      logicalRole === "derivation" ||
      /^eq-(?:lq|bm|sr|me|md)-\d+/.test(id) ||
      /^eq-(?:lq|bm|sr|me|md)-s\d+-\d+/.test(id);

    let type: GenealogyNodeType = "equation";
    if (isRoot) {
      type = "postulate";
    } else if (isNumberedResult) {
      type = "result";
    }

    const title =
      typeof eq.title === "string" && eq.title.trim().length > 0 ? eq.title.trim() : undefined;
    const spokenForm =
      typeof eq.spokenForm === "string"
        ? eq.spokenForm
        : typeof eq.spoken === "string"
          ? eq.spoken
          : undefined;
    const anchor =
      typeof eq.anchor === "string" && eq.anchor.trim().length > 0 ? eq.anchor.trim() : id;
    const section =
      typeof eq.section === "string" && eq.section.trim().length > 0
        ? eq.section.trim()
        : extractSectionFromId(id);

    registerNode({
      id,
      paper: eqPaper,
      label: title ?? formatLabel(id),
      type,
      spokenForm,
      latex,
      anchor,
      isRoot,
      isNumberedResult,
      section,
      logicalRole,
    });
  }

  // 2. Process derivation chains
  for (const chain of chains) {
    const chainPaper = extractPaperFromId(chain.id, extractPaperFromId(chain.target, paper));

    // Register target node
    if (chain.target) {
      const targetPaper = extractPaperFromId(chain.target, chainPaper);
      const isRoot = declaredRootsSet.has(chain.target);
      registerNode({
        id: chain.target,
        paper: targetPaper,
        label: formatLabel(chain.target),
        type: isRoot ? "postulate" : "result",
        isRoot,
        isNumberedResult: true,
        isTarget: true,
        anchor: chain.target,
        section: extractSectionFromId(chain.target),
      });
    }

    // Register entry assumptions
    for (const assumption of chain.entryAssumptions) {
      const assumptionPaper =
        assumption.admittedImport?.sourcePaper ?? extractPaperFromId(assumption.ref, chainPaper);
      const isRoot = declaredRootsSet.has(assumption.ref);
      const isExternal = assumptionPaper !== paper;

      registerNode({
        id: assumption.ref,
        paper: assumptionPaper,
        label: formatLabel(assumption.ref),
        type: isExternal ? "external" : isRoot ? "postulate" : "premise",
        isRoot: isRoot || (!isExternal && chain.routeKind === "source-order" && isRoot),
        isNumberedResult: declaredResultsSet.has(assumption.ref),
        anchor: assumption.ref,
        section: assumption.admittedImport?.sourceSection
          ? `§${assumption.admittedImport.sourceSection}`
          : extractSectionFromId(assumption.ref),
      });
    }

    // Register steps and step premises
    for (const step of chain.steps) {
      const stepPaper = extractPaperFromId(step.id, chainPaper);
      registerNode({
        id: step.id,
        paper: stepPaper,
        label: step.isMove ? `[MOVE] ${step.moveLabel ?? step.id}` : formatLabel(step.id),
        type: "equation",
        isRoot: declaredRootsSet.has(step.id),
        isNumberedResult: declaredResultsSet.has(step.id),
        anchor: step.sourceAnchor ?? step.id,
        section: extractSectionFromId(step.id),
      });

      for (const pRef of step.premiseRefs) {
        const pRefPaper =
          pRef.admittedImport?.sourcePaper ?? extractPaperFromId(pRef.ref, stepPaper);
        const isRoot = declaredRootsSet.has(pRef.ref);
        const isExternal = pRefPaper !== paper;

        registerNode({
          id: pRef.ref,
          paper: pRefPaper,
          label: formatLabel(pRef.ref),
          type: isExternal ? "external" : isRoot ? "postulate" : "premise",
          isRoot,
          isNumberedResult: declaredResultsSet.has(pRef.ref),
          anchor: pRef.ref,
          section: pRef.admittedImport?.sourceSection
            ? `§${pRef.admittedImport.sourceSection}`
            : extractSectionFromId(pRef.ref),
        });
      }
    }
  }

  // 3. Register any remaining declared roots
  for (const rootId of declaredRootsSet) {
    if (!nodeMap.has(rootId)) {
      registerNode({
        id: rootId,
        paper: extractPaperFromId(rootId, paper),
        label: formatLabel(rootId),
        type: "postulate",
        isRoot: true,
        isNumberedResult: false,
        anchor: rootId,
        section: extractSectionFromId(rootId),
      });
    }
  }

  // 4. Merge custom nodes
  if (options.customNodes) {
    for (const node of options.customNodes) {
      registerNode(node);
    }
  }

  // 5. Build edges
  const edgeKey = (from: string, to: string, edgeType: string) => `${from}->${to}:${edgeType}`;
  const rawEdges = new Map<string, GenealogyEdge>();

  const addEdge = (edge: GenealogyEdge) => {
    const key = edgeKey(edge.from, edge.to, edge.edgeType);
    if (!rawEdges.has(key)) {
      rawEdges.set(key, edge);
    }
  };

  // 5a. From equation usedBy references
  for (const item of equations) {
    const eq = item as Record<string, unknown>;
    const fromId = typeof eq.id === "string" && eq.id.trim().length > 0 ? eq.id.trim() : "";
    const dLinks = extractDerivationLinks(eq.derivationLinks);
    if (fromId && dLinks && dLinks.usedBy.length > 0) {
      const fromPaper =
        typeof eq.paper === "string" && eq.paper.trim().length > 0
          ? eq.paper.trim()
          : extractPaperFromId(fromId, paper);
      for (const targetId of dLinks.usedBy) {
        const targetPaper = extractPaperFromId(targetId, fromPaper);
        const crossPaper = fromPaper !== targetPaper;
        addEdge({
          from: fromId,
          to: targetId,
          edgeType: "historical-derivation",
          isPremise: true,
          crossPaper,
          targetPaper: crossPaper ? targetPaper : undefined,
        });
      }
    }
  }

  // 5b. From derivation chains
  for (const chain of chains) {
    const chainPaper = extractPaperFromId(chain.id, extractPaperFromId(chain.target, paper));
    const firstStep = chain.steps[0];
    const initialTarget = firstStep ? firstStep.id : chain.target;
    const targetPaper = extractPaperFromId(initialTarget, chainPaper);

    // Entry assumptions -> first step or target
    for (const assumption of chain.entryAssumptions) {
      const isPremise = assumption.edgeType !== "cross-reference";
      const assumptionPaper =
        assumption.admittedImport?.sourcePaper ?? extractPaperFromId(assumption.ref, chainPaper);
      const crossPaper = Boolean(assumption.admittedImport) || assumptionPaper !== targetPaper;

      addEdge({
        from: assumption.ref,
        to: initialTarget,
        edgeType: assumption.edgeType,
        isPremise,
        crossPaper,
        targetPaper: crossPaper ? targetPaper : undefined,
        provenance: assumption.admittedImport,
      });
    }

    // Sequential steps
    for (let i = 0; i < chain.steps.length; i++) {
      const step = chain.steps[i];
      if (!step) continue;
      const stepPaper = extractPaperFromId(step.id, chainPaper);

      if (i > 0) {
        const prevStep = chain.steps[i - 1];
        if (prevStep) {
          const prevPaper = extractPaperFromId(prevStep.id, chainPaper);
          const crossPaper = prevPaper !== stepPaper;
          const edgeType: PremiseEdgeType =
            chain.routeKind === "source-order"
              ? "historical-derivation"
              : chain.routeKind === "modern-verification"
                ? "modern-verification-oracle"
                : "pedagogical-reconstruction";

          addEdge({
            from: prevStep.id,
            to: step.id,
            edgeType,
            isPremise: true,
            crossPaper,
            targetPaper: crossPaper ? stepPaper : undefined,
          });
        }
      }

      // Step premise references
      for (const pRef of step.premiseRefs) {
        const isPremise = pRef.edgeType !== "cross-reference";
        const pRefPaper =
          pRef.admittedImport?.sourcePaper ?? extractPaperFromId(pRef.ref, chainPaper);
        const crossPaper = Boolean(pRef.admittedImport) || pRefPaper !== stepPaper;

        addEdge({
          from: pRef.ref,
          to: step.id,
          edgeType: pRef.edgeType,
          isPremise,
          crossPaper,
          targetPaper: crossPaper ? stepPaper : undefined,
          provenance: pRef.admittedImport,
        });
      }
    }

    // Last step -> target
    if (chain.steps.length > 0 && chain.target) {
      const lastStep = chain.steps[chain.steps.length - 1];
      if (lastStep) {
        const lastPaper = extractPaperFromId(lastStep.id, chainPaper);
        const targetPaper = extractPaperFromId(chain.target, chainPaper);
        const crossPaper = lastPaper !== targetPaper;
        const edgeType: PremiseEdgeType =
          chain.routeKind === "source-order"
            ? "historical-derivation"
            : chain.routeKind === "modern-verification"
              ? "modern-verification-oracle"
              : "pedagogical-reconstruction";

        addEdge({
          from: lastStep.id,
          to: chain.target,
          edgeType,
          isPremise: true,
          crossPaper,
          targetPaper: crossPaper ? targetPaper : undefined,
        });
      }
    }
  }

  // 5c. Custom edges
  if (options.customEdges) {
    for (const edge of options.customEdges) {
      addEdge(edge);
    }
  }

  // 6. Filter by perspective and resolve cross-paper flags
  const filteredEdges: GenealogyEdge[] = [];
  const crossPaperEdges: GenealogyEdge[] = [];

  for (const edge of rawEdges.values()) {
    if (perspective === "historical" && edge.edgeType === "modern-verification-oracle") {
      continue;
    }

    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);

    const fromPaper = fromNode?.paper ?? extractPaperFromId(edge.from, paper);
    const toPaper = toNode?.paper ?? extractPaperFromId(edge.to, paper);

    const isCross =
      edge.crossPaper ||
      Boolean(edge.provenance) ||
      fromPaper !== toPaper ||
      (fromPaper === paper && toPaper !== paper) ||
      (fromPaper !== paper && toPaper === paper);

    const resolvedEdge: GenealogyEdge = Object.freeze({
      ...edge,
      crossPaper: isCross,
      targetPaper:
        edge.targetPaper ??
        (toPaper !== paper ? toPaper : fromPaper !== paper ? fromPaper : undefined),
    });

    filteredEdges.push(resolvedEdge);
    if (isCross) {
      crossPaperEdges.push(resolvedEdge);
    }
  }

  // 7. Compute roots
  const inDegree = new Map<string, number>();
  for (const node of nodeMap.values()) {
    inDegree.set(node.id, 0);
  }
  for (const edge of filteredEdges) {
    if (edge.isPremise && inDegree.has(edge.to)) {
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    }
  }

  const roots: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    const node = nodeMap.get(id);
    if (node?.isRoot || deg === 0) {
      roots.push(id);
    }
  }
  roots.sort((a, b) => a.localeCompare(b));

  const nodes = Object.freeze(
    Array.from(nodeMap.values()).sort((a, b) => a.id.localeCompare(b.id)),
  );
  const edges = Object.freeze(
    filteredEdges.sort((a, b) => `${a.from}->${a.to}`.localeCompare(`${b.from}->${b.to}`)),
  );

  return Object.freeze({
    paper,
    perspective,
    nodes,
    edges,
    roots: Object.freeze(roots),
    crossPaperEdges: Object.freeze(crossPaperEdges),
  });
}
