/**
 * React Component and Keyboard Navigation for Equation Genealogy (am-eq-genealogy-hmm).
 *
 * Provides:
 * 1. Build-time / static SVG rendering.
 * 2. Accessible nested list fallback (<nav aria-label="Equation genealogy list"> with "see above" deduplication).
 * 3. Keyboard navigation: ArrowUp (parent), ArrowDown (child), ArrowLeft/Right (same layer), Enter/Space (select), Escape (clear).
 * 4. Distinct visualization for cross-paper outgoing edge (e.g. Paper 3 §8 light energy -> Paper 4).
 */

import type React from "react";
import { useState } from "react";
import { layoutGenealogyGraph } from "./layoutLayers.ts";
import type { GenealogyGraph, GenealogyLayoutResult, GenealogyNode } from "./types.ts";

export interface GenealogyProps {
  readonly graph: GenealogyGraph;
  readonly layout?: GenealogyLayoutResult | undefined;
  readonly selectedNodeId?: string | undefined;
  readonly onSelectNode?: ((nodeId: string) => void) | undefined;
  readonly showListFallback?: boolean | undefined;
  readonly className?: string | undefined;
}

/**
 * Pure keyboard navigation handler for testing and interactive runtime.
 */
export function handleGenealogyKeyDown(
  event: { key: string; preventDefault?: () => void },
  currentNodeId: string | null,
  graph: GenealogyGraph,
  layout: GenealogyLayoutResult,
  callbacks: {
    onSelectNode?: (nodeId: string) => void;
    onFocusNode?: (nodeId: string) => void;
    onClearSelection?: () => void;
  },
): boolean {
  if (!currentNodeId) {
    if (event.key === "ArrowDown" || event.key === "Enter") {
      const firstRoot = graph.roots[0];
      if (firstRoot) {
        event.preventDefault?.();
        callbacks.onFocusNode?.(firstRoot);
        callbacks.onSelectNode?.(firstRoot);
        return true;
      }
    }
    return false;
  }

  const currentLayoutNode = layout.nodes.find((n) => n.id === currentNodeId);
  if (!currentLayoutNode) return false;

  const currentLayerNodes = layout.layers[currentLayoutNode.layer] ?? [];
  const currentOrder = currentLayoutNode.order;

  // Build in/out neighbors from edges
  const parents = graph.edges
    .filter((e) => e.to === currentNodeId && e.isPremise)
    .map((e) => e.from);
  const children = graph.edges
    .filter((e) => e.from === currentNodeId && e.isPremise)
    .map((e) => e.to);

  switch (event.key) {
    case "ArrowUp": {
      event.preventDefault?.();
      const nextId = parents[0];
      if (nextId) {
        callbacks.onFocusNode?.(nextId);
        callbacks.onSelectNode?.(nextId);
        return true;
      }
      return false;
    }

    case "ArrowDown": {
      event.preventDefault?.();
      const nextId = children[0];
      if (nextId) {
        callbacks.onFocusNode?.(nextId);
        callbacks.onSelectNode?.(nextId);
        return true;
      }
      return false;
    }

    case "ArrowLeft": {
      event.preventDefault?.();
      if (currentOrder > 0) {
        const prevSibling = currentLayerNodes[currentOrder - 1];
        if (prevSibling) {
          callbacks.onFocusNode?.(prevSibling.id);
          callbacks.onSelectNode?.(prevSibling.id);
          return true;
        }
      }
      return false;
    }

    case "ArrowRight": {
      event.preventDefault?.();
      if (currentOrder < currentLayerNodes.length - 1) {
        const nextSibling = currentLayerNodes[currentOrder + 1];
        if (nextSibling) {
          callbacks.onFocusNode?.(nextSibling.id);
          callbacks.onSelectNode?.(nextSibling.id);
          return true;
        }
      }
      return false;
    }

    case "Enter":
    case " ": {
      event.preventDefault?.();
      callbacks.onSelectNode?.(currentNodeId);
      return true;
    }

    case "Escape": {
      event.preventDefault?.();
      callbacks.onClearSelection?.();
      return true;
    }

    default:
      return false;
  }
}

/**
 * Renders the accessible nested list tree fallback.
 */
export function GenealogyListFallback({
  graph,
  selectedNodeId,
  onSelectNode,
}: {
  readonly graph: GenealogyGraph;
  readonly selectedNodeId?: string | undefined;
  readonly onSelectNode?: ((id: string) => void) | undefined;
}): React.JSX.Element {
  const nodeMap = new Map<string, GenealogyNode>();
  for (const n of graph.nodes) {
    nodeMap.set(n.id, n);
  }

  const childrenMap = new Map<string, string[]>();
  for (const n of graph.nodes) {
    childrenMap.set(n.id, []);
  }
  for (const e of graph.edges) {
    if (e.isPremise) {
      childrenMap.get(e.from)?.push(e.to);
    }
  }

  const renderNodeBranch = (
    nodeId: string,
    ancestorSet: Set<string>,
    renderedSet: Set<string>,
  ): React.JSX.Element => {
    const node = nodeMap.get(nodeId);
    if (!node) return <li key={nodeId}>Unknown node: {nodeId}</li>;

    const isSelected = selectedNodeId === nodeId;
    const isRepeated = renderedSet.has(nodeId);

    if (isRepeated || ancestorSet.has(nodeId)) {
      return (
        <li key={`${nodeId}-repeat`}>
          <span className="genealogy-node-item repeated">
            (see above for <strong>{node.label}</strong>)
          </span>
        </li>
      );
    }

    renderedSet.add(nodeId);
    const nextAncestors = new Set(ancestorSet);
    nextAncestors.add(nodeId);

    const children = childrenMap.get(nodeId) ?? [];

    return (
      <li key={nodeId}>
        <button
          type="button"
          className="genealogy-node-btn"
          data-selected={isSelected}
          data-node-id={node.id}
          data-is-root={node.isRoot}
          data-is-result={node.isNumberedResult}
          onClick={() => onSelectNode?.(node.id)}
        >
          <span className="genealogy-badge">
            {node.isRoot ? "POSTULATE" : node.isNumberedResult ? "RESULT" : "EQUATION"}
          </span>
          <span className="genealogy-node-title">{node.label}</span>
          {node.anchor && <span className="genealogy-anchor">({node.anchor})</span>}
        </button>
        {children.length > 0 && (
          <ol className="genealogy-children-list">
            {children.map((childId) => renderNodeBranch(childId, nextAncestors, renderedSet))}
          </ol>
        )}
      </li>
    );
  };

  const renderedSet = new Set<string>();

  return (
    <nav className="genealogy-list-nav" aria-label="Equation genealogy list">
      <ol className="genealogy-roots-list">
        {graph.roots.map((rootId) => renderNodeBranch(rootId, new Set(), renderedSet))}
      </ol>
    </nav>
  );
}

/**
 * Main Genealogy component.
 */
export function Genealogy({
  graph,
  layout: providedLayout,
  selectedNodeId: controlledSelectedId,
  onSelectNode,
  showListFallback = true,
  className = "",
}: GenealogyProps): React.JSX.Element {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : internalSelectedId;

  const layout = providedLayout ?? layoutGenealogyGraph(graph);

  const handleSelect = (id: string) => {
    setInternalSelectedId(id);
    onSelectNode?.(id);
  };

  const handleClear = () => {
    setInternalSelectedId(null);
  };

  // Find lineage (ancestors) and impact (descendants) for highlighting
  const ancestors = new Set<string>();
  const descendants = new Set<string>();

  if (selectedId) {
    // In-edges / parents DFS
    const queueUp = [selectedId];
    while (queueUp.length > 0) {
      const curr = queueUp.shift();
      if (!curr) break;
      for (const e of graph.edges) {
        if (e.to === curr && e.isPremise && !ancestors.has(e.from)) {
          ancestors.add(e.from);
          queueUp.push(e.from);
        }
      }
    }

    // Out-edges / children DFS
    const queueDown = [selectedId];
    while (queueDown.length > 0) {
      const curr = queueDown.shift();
      if (!curr) break;
      for (const e of graph.edges) {
        if (e.from === curr && e.isPremise && !descendants.has(e.to)) {
          descendants.add(e.to);
          queueDown.push(e.to);
        }
      }
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    handleGenealogyKeyDown(e, selectedId, graph, layout, {
      onSelectNode: handleSelect,
      onFocusNode: handleSelect,
      onClearSelection: handleClear,
    });
  };

  return (
    <section
      className={`genealogy-container ${className}`.trim()}
      aria-label={`Equation genealogy for ${graph.paper}`}
      onKeyDown={onKeyDown}
    >
      <div className="genealogy-header">
        <h3>Equation Genealogy: {graph.paper}</h3>
        <span className="genealogy-perspective-badge" data-perspective={graph.perspective}>
          {graph.perspective === "historical" ? "Historical Derivation" : "Modern Lens"}
        </span>
      </div>

      {graph.crossPaperEdges.length > 0 && (
        <div className="genealogy-cross-paper-banner" role="status">
          <strong>Cross-Paper Derivation Link:</strong>
          {graph.crossPaperEdges.map((e) => (
            <span key={`${e.from}->${e.to}`} className="genealogy-cross-paper-pill">
              Leaves {graph.paper} &rarr; {e.targetPaper ?? "Paper 4"} (from {e.from})
            </span>
          ))}
        </div>
      )}

      <div className="genealogy-graph-wrapper">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width="100%"
          height="auto"
          className="genealogy-graph-svg"
          role="img"
          aria-label="Equation genealogy graph diagram"
        >
          <defs>
            <marker
              id="arrow-default"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M 0 1 L 8 4 L 0 7 z" fill="#5c5346" />
            </marker>
            <marker
              id="arrow-crosspaper"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M 0 1 L 8 4 L 0 7 z" fill="#c25e00" />
            </marker>
            <marker
              id="arrow-oracle"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M 0 1 L 8 4 L 0 7 z" fill="#2d6a9f" />
            </marker>
          </defs>

          <g className="genealogy-edges">
            {layout.edges.map((e) => {
              const isCross = e.edge.crossPaper;
              const isOracle = e.edge.edgeType === "modern-verification-oracle";
              const markerId = isCross
                ? "arrow-crosspaper"
                : isOracle
                  ? "arrow-oracle"
                  : "arrow-default";
              const isHighlighted =
                selectedId !== null &&
                ((ancestors.has(e.from) && (ancestors.has(e.to) || e.to === selectedId)) ||
                  (descendants.has(e.to) && (descendants.has(e.from) || e.from === selectedId)));

              const stroke = isHighlighted
                ? "var(--accent)"
                : isCross
                  ? "#c25e00"
                  : isOracle
                    ? "#2d6a9f"
                    : "#8c8273";

              return (
                <path
                  key={`${e.from}->${e.to}`}
                  d={e.path}
                  className="genealogy-edge"
                  data-from={e.from}
                  data-to={e.to}
                  data-cross-paper={isCross}
                  data-highlighted={isHighlighted}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={isHighlighted ? 3 : 2}
                  strokeDasharray={isCross ? "4 3" : undefined}
                  markerEnd={`url(#${markerId})`}
                />
              );
            })}
          </g>

          <g className="genealogy-nodes">
            {layout.nodes.map((n) => {
              const isSelected = selectedId === n.id;
              const isAncestor = ancestors.has(n.id);
              const isDescendant = descendants.has(n.id);
              const isRoot = n.node.isRoot;
              const isResult = n.node.isNumberedResult;

              const fill =
                isSelected || isAncestor || isDescendant || isRoot || isResult
                  ? "var(--wash)"
                  : "var(--panel)";

              const stroke = isSelected
                ? "var(--accent)"
                : isRoot
                  ? "var(--ink)"
                  : isResult
                    ? "var(--plot)"
                    : "var(--line)";

              const badgeFill = isSelected
                ? "var(--accent)"
                : isRoot
                  ? "var(--ink)"
                  : isResult
                    ? "var(--plot)"
                    : "var(--muted)";

              const badgeText = isRoot ? "POSTULATE" : isResult ? "RESULT" : "EQUATION";

              return (
                <g
                  key={n.id}
                  className="genealogy-node"
                  data-node-id={n.id}
                  data-layer={n.layer}
                  data-selected={isSelected}
                  data-lineage={isAncestor}
                  data-impact={isDescendant}
                  data-is-root={isRoot}
                  data-is-result={isResult}
                  transform={`translate(${n.x},${n.y})`}
                  onClick={() => handleSelect(n.id)}
                  style={{ cursor: "pointer" }}
                  role="treeitem"
                  tabIndex={0}
                  aria-selected={isSelected}
                  aria-label={`${badgeText}: ${n.node.label}`}
                >
                  <rect
                    width={n.width}
                    height={n.height}
                    rx={6}
                    ry={6}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                  <text
                    x={8}
                    y={18}
                    fontFamily="sans-serif"
                    fontSize={9}
                    fontWeight="bold"
                    fill={badgeFill}
                  >
                    {badgeText}
                  </text>
                  <text x={8} y={38} fontFamily="sans-serif" fontSize={12} fill="var(--ink)">
                    {n.node.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {showListFallback && (
        <GenealogyListFallback
          graph={graph}
          selectedNodeId={selectedId ?? undefined}
          onSelectNode={handleSelect}
        />
      )}
    </section>
  );
}
