/**
 * Deterministic layered graph layout for Equation Genealogy (am-eq-genealogy-hmm).
 *
 * Implements:
 * 1. Longest-path layering from root nodes ($L(v) = \max_{(u,v) \in E} (L(u) + 1)$).
 * 2. 4-sweep barycentric ordering with deterministic node ID tie-breaking.
 * 3. Exact coordinate calculation and bezier edge routing.
 * 4. Byte-identical SVG markup generation.
 */

import type {
  GenealogyGraph,
  GenealogyLayoutResult,
  GenealogyNode,
  LayoutEdge,
  LayoutNode,
} from "./types.ts";

export const LAYOUT_CONSTANTS = {
  NODE_WIDTH: 180,
  NODE_HEIGHT: 56,
  NODE_GAP_X: 24,
  LAYER_GAP_Y: 64,
  PADDING: 32,
  MIN_WIDTH: 800,
} as const;

/**
 * Assigns each node to a layer using longest path from roots in a DAG.
 */
export function assignLayers(graph: GenealogyGraph): Map<string, number> {
  const layerMap = new Map<string, number>();
  const inEdges = new Map<string, string[]>();
  const outEdges = new Map<string, string[]>();

  for (const node of graph.nodes) {
    layerMap.set(node.id, 0);
    inEdges.set(node.id, []);
    outEdges.set(node.id, []);
  }

  for (const edge of graph.edges) {
    if (edge.isPremise) {
      inEdges.get(edge.to)?.push(edge.from);
      outEdges.get(edge.from)?.push(edge.to);
    }
  }

  // Topological sorting / longest path
  const inDegree = new Map<string, number>();
  for (const [id, list] of inEdges.entries()) {
    inDegree.set(id, list.length);
  }

  const queue: string[] = [];
  for (const node of graph.nodes) {
    if (node.isRoot || inDegree.get(node.id) === 0) {
      layerMap.set(node.id, 0);
      queue.push(node.id);
    }
  }

  // Deterministic queue processing
  queue.sort((a, b) => a.localeCompare(b));

  const processed = new Set<string>();
  while (queue.length > 0) {
    const u = queue.shift();
    if (u === undefined) break;
    processed.add(u);
    const uLayer = layerMap.get(u) ?? 0;

    const neighbors = outEdges.get(u) ?? [];
    for (const v of neighbors) {
      const currentVLayer = layerMap.get(v) ?? 0;
      if (uLayer + 1 > currentVLayer) {
        layerMap.set(v, uLayer + 1);
      }
      const remaining = (inDegree.get(v) ?? 1) - 1;
      inDegree.set(v, remaining);
      if (remaining <= 0 && !processed.has(v) && !queue.includes(v)) {
        queue.push(v);
        queue.sort((a, b) => a.localeCompare(b));
      }
    }
  }

  // Ensure any unreachable or unvisited nodes have valid layer
  for (const node of graph.nodes) {
    if (!layerMap.has(node.id)) {
      layerMap.set(node.id, 0);
    }
  }

  return layerMap;
}

/**
 * 4-sweep barycentric ordering:
 * 1. Downward sweep
 * 2. Upward sweep
 * 3. Downward sweep
 * 4. Upward sweep
 * With string ID tie-breaking.
 */
export function orderLayersBarycentric(
  graph: GenealogyGraph,
  layerMap: Map<string, number>,
): GenealogyNode[][] {
  let maxLayer = 0;
  for (const l of layerMap.values()) {
    if (l > maxLayer) maxLayer = l;
  }

  const layers: GenealogyNode[][] = Array.from({ length: maxLayer + 1 }, () => []);

  const nodeLookup = new Map<string, GenealogyNode>();
  for (const node of graph.nodes) {
    nodeLookup.set(node.id, node);
    const l = layerMap.get(node.id) ?? 0;
    layers[l]?.push(node);
  }

  // Initial deterministic sort
  for (const layer of layers) {
    layer.sort((a, b) => a.id.localeCompare(b.id));
  }

  const inAdj = new Map<string, string[]>();
  const outAdj = new Map<string, string[]>();
  for (const node of graph.nodes) {
    inAdj.set(node.id, []);
    outAdj.set(node.id, []);
  }
  for (const edge of graph.edges) {
    inAdj.get(edge.to)?.push(edge.from);
    outAdj.get(edge.from)?.push(edge.to);
  }

  const getPositionMap = (layer: GenealogyNode[]): Map<string, number> => {
    const pos = new Map<string, number>();
    for (let i = 0; i < layer.length; i++) {
      const node = layer[i];
      if (node) {
        pos.set(node.id, i);
      }
    }
    return pos;
  };

  const sweepDown = () => {
    for (let l = 1; l < layers.length; l++) {
      const prevLayer = layers[l - 1];
      const currentLayer = layers[l];
      if (!prevLayer || !currentLayer) continue;
      const prevPos = getPositionMap(prevLayer);

      currentLayer.sort((a, b) => {
        const aPreds = inAdj.get(a.id) ?? [];
        const bPreds = inAdj.get(b.id) ?? [];

        const aBary =
          aPreds.length > 0
            ? aPreds.reduce((sum, p) => sum + (prevPos.get(p) ?? 0), 0) / aPreds.length
            : prevPos.size;
        const bBary =
          bPreds.length > 0
            ? bPreds.reduce((sum, p) => sum + (prevPos.get(p) ?? 0), 0) / bPreds.length
            : prevPos.size;

        if (Math.abs(aBary - bBary) > 1e-6) {
          return aBary - bBary;
        }
        return a.id.localeCompare(b.id);
      });
    }
  };

  const sweepUp = () => {
    for (let l = layers.length - 2; l >= 0; l--) {
      const nextLayer = layers[l + 1];
      const currentLayer = layers[l];
      if (!nextLayer || !currentLayer) continue;
      const nextPos = getPositionMap(nextLayer);

      currentLayer.sort((a, b) => {
        const aSuccs = outAdj.get(a.id) ?? [];
        const bSuccs = outAdj.get(b.id) ?? [];

        const aBary =
          aSuccs.length > 0
            ? aSuccs.reduce((sum, s) => sum + (nextPos.get(s) ?? 0), 0) / aSuccs.length
            : nextPos.size;
        const bBary =
          bSuccs.length > 0
            ? bSuccs.reduce((sum, s) => sum + (nextPos.get(s) ?? 0), 0) / bSuccs.length
            : nextPos.size;

        if (Math.abs(aBary - bBary) > 1e-6) {
          return aBary - bBary;
        }
        return a.id.localeCompare(b.id);
      });
    }
  };

  // 4 sweeps
  sweepDown();
  sweepUp();
  sweepDown();
  sweepUp();

  return layers;
}

/**
 * Computes exact deterministic layout coordinates for nodes and edges.
 */
export function layoutGenealogyGraph(graph: GenealogyGraph): GenealogyLayoutResult {
  const layerMap = assignLayers(graph);
  const orderedLayers = orderLayersBarycentric(graph, layerMap);

  const { NODE_WIDTH, NODE_HEIGHT, NODE_GAP_X, LAYER_GAP_Y, PADDING, MIN_WIDTH } = LAYOUT_CONSTANTS;

  let maxNodesInLayer = 0;
  for (const layer of orderedLayers) {
    if (layer.length > maxNodesInLayer) {
      maxNodesInLayer = layer.length;
    }
  }

  const contentWidth =
    2 * PADDING + maxNodesInLayer * NODE_WIDTH + Math.max(0, maxNodesInLayer - 1) * NODE_GAP_X;
  const width = Math.max(MIN_WIDTH, contentWidth);

  const totalLayers = Math.max(1, orderedLayers.length);
  const height = 2 * PADDING + totalLayers * NODE_HEIGHT + (totalLayers - 1) * LAYER_GAP_Y;

  const layoutNodesMap = new Map<string, LayoutNode>();
  const layersResult: LayoutNode[][] = [];

  for (let l = 0; l < orderedLayers.length; l++) {
    const layer = orderedLayers[l];
    if (!layer) continue;
    const layerNodeCount = layer.length;
    const layerWidth = layerNodeCount * NODE_WIDTH + Math.max(0, layerNodeCount - 1) * NODE_GAP_X;
    const startX = Math.round((width - layerWidth) / 2);
    const y = PADDING + l * (NODE_HEIGHT + LAYER_GAP_Y);

    const layerLayoutNodes: LayoutNode[] = [];
    for (let order = 0; order < layer.length; order++) {
      const node = layer[order];
      if (!node) continue;
      const x = startX + order * (NODE_WIDTH + NODE_GAP_X);

      const lNode: LayoutNode = Object.freeze({
        id: node.id,
        layer: l,
        order,
        x,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        node,
      });

      layoutNodesMap.set(node.id, lNode);
      layerLayoutNodes.push(lNode);
    }
    layersResult.push(layerLayoutNodes);
  }

  // Build layout edges
  const layoutEdges: LayoutEdge[] = [];
  for (const edge of graph.edges) {
    const u = layoutNodesMap.get(edge.from);
    const v = layoutNodesMap.get(edge.to);
    if (!u || !v) continue;

    const fromPoint = Object.freeze({
      x: Math.round(u.x + u.width / 2),
      y: u.y + u.height,
    });
    const toPoint = Object.freeze({
      x: Math.round(v.x + v.width / 2),
      y: v.y,
    });

    const dy = Math.round((toPoint.y - fromPoint.y) / 2);
    const cy1 = fromPoint.y + dy;
    const cy2 = toPoint.y - dy;

    const path = `M ${fromPoint.x} ${fromPoint.y} C ${fromPoint.x} ${cy1}, ${toPoint.x} ${cy2}, ${toPoint.x} ${toPoint.y}`;

    layoutEdges.push(
      Object.freeze({
        from: edge.from,
        to: edge.to,
        edge,
        path,
        fromPoint,
        toPoint,
      }),
    );
  }

  layoutEdges.sort((a, b) => `${a.from}->${a.to}`.localeCompare(`${b.from}->${b.to}`));

  const allLayoutNodes = Array.from(layoutNodesMap.values()).sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  const svgMarkup = generateDeterministicSvg({
    nodes: allLayoutNodes,
    edges: layoutEdges,
    layers: layersResult,
    width,
    height,
    svgMarkup: "",
  });

  return Object.freeze({
    nodes: Object.freeze(allLayoutNodes),
    edges: Object.freeze(layoutEdges),
    layers: Object.freeze(layersResult),
    width,
    height,
    svgMarkup,
  });
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generates byte-identical, deterministic SVG markup.
 */
export function generateDeterministicSvg(layout: GenealogyLayoutResult): string {
  const { width, height, edges, nodes } = layout;

  const lines: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="genealogy-graph-svg" role="img" aria-label="Equation genealogy graph">`,
    `  <defs>`,
    `    <marker id="genealogy-arrow-default" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">`,
    `      <path d="M 0 1 L 8 4 L 0 7 z" fill="#5c5346" />`,
    `    </marker>`,
    `    <marker id="genealogy-arrow-crosspaper" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">`,
    `      <path d="M 0 1 L 8 4 L 0 7 z" fill="#c25e00" />`,
    `    </marker>`,
    `    <marker id="genealogy-arrow-oracle" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">`,
    `      <path d="M 0 1 L 8 4 L 0 7 z" fill="#2d6a9f" />`,
    `    </marker>`,
    `  </defs>`,
    `  <g class="genealogy-edges">`,
  ];

  for (const e of edges) {
    const isCross = e.edge.crossPaper;
    const isOracle = e.edge.edgeType === "modern-verification-oracle";
    const markerId = isCross
      ? "genealogy-arrow-crosspaper"
      : isOracle
        ? "genealogy-arrow-oracle"
        : "genealogy-arrow-default";
    const strokeColor = isCross ? "#c25e00" : isOracle ? "#2d6a9f" : "#8c8273";
    const strokeDash = isCross ? `stroke-dasharray="4 3" ` : "";

    lines.push(
      `    <path d="${e.path}" class="genealogy-edge" data-from="${escapeXml(e.from)}" data-to="${escapeXml(e.to)}" data-cross-paper="${isCross}" fill="none" stroke="${strokeColor}" stroke-width="2" ${strokeDash}marker-end="url(#${markerId})" />`,
    );
  }

  lines.push(`  </g>`);
  lines.push(`  <g class="genealogy-nodes">`);

  for (const n of nodes) {
    const isRoot = n.node.isRoot;
    const isResult = n.node.isNumberedResult;
    const fill = isRoot ? "#f4ebd0" : isResult ? "#e8efe9" : "#ffffff";
    const stroke = isRoot ? "#9b6b27" : isResult ? "#3d7a5a" : "#b0a898";
    const badgeText = isRoot ? "POSTULATE" : isResult ? "RESULT" : "EQUATION";
    const label = escapeXml(n.node.label);

    lines.push(
      `    <g class="genealogy-node" data-node-id="${escapeXml(n.id)}" data-layer="${n.layer}" data-is-root="${isRoot}" data-is-result="${isResult}" transform="translate(${n.x},${n.y})">`,
    );
    lines.push(
      `      <rect width="${n.width}" height="${n.height}" rx="6" ry="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />`,
    );
    lines.push(
      `      <text x="8" y="18" font-family="sans-serif" font-size="9" font-weight="bold" fill="${stroke}">${badgeText}</text>`,
    );
    lines.push(
      `      <text x="8" y="38" font-family="sans-serif" font-size="12" fill="#1c1917">${label}</text>`,
    );
    lines.push(`    </g>`);
  }

  lines.push(`  </g>`);
  lines.push(`</svg>`);

  return lines.join("\n");
}
