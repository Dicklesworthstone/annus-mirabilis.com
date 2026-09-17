import { describe, expect, test } from "bun:test";
import { getLogger } from "../../testing/log/logger.ts";
import {
  assignLayers,
  generateDeterministicSvg,
  LAYOUT_CONSTANTS,
  layoutGenealogyGraph,
  orderLayersBarycentric,
} from "./layoutLayers.ts";
import type { GenealogyGraph } from "./types.ts";

const logger = getLogger("equations-genealogy");

describe("am-eq-genealogy-hmm: layoutLayers", () => {
  const sampleGraph: GenealogyGraph = {
    paper: "special-relativity",
    perspective: "historical",
    nodes: [
      { id: "postulate-1", paper: "sr", label: "Postulate 1", type: "postulate", isRoot: true, isNumberedResult: false },
      { id: "postulate-2", paper: "sr", label: "Postulate 2", type: "postulate", isRoot: true, isNumberedResult: false },
      { id: "coord-boost", paper: "sr", label: "Lorentz Boost", type: "equation", isRoot: false, isNumberedResult: false },
      { id: "length-contraction", paper: "sr", label: "Length Contraction", type: "result", isRoot: false, isNumberedResult: true },
      { id: "time-dilation", paper: "sr", label: "Time Dilation", type: "result", isRoot: false, isNumberedResult: true },
      { id: "light-energy", paper: "sr", label: "Light Energy", type: "result", isRoot: false, isNumberedResult: true },
    ],
    edges: [
      { from: "postulate-1", to: "coord-boost", edgeType: "historical-derivation", isPremise: true, crossPaper: false },
      { from: "postulate-2", to: "coord-boost", edgeType: "historical-derivation", isPremise: true, crossPaper: false },
      { from: "coord-boost", to: "length-contraction", edgeType: "historical-derivation", isPremise: true, crossPaper: false },
      { from: "coord-boost", to: "time-dilation", edgeType: "historical-derivation", isPremise: true, crossPaper: false },
      { from: "coord-boost", to: "light-energy", edgeType: "historical-derivation", isPremise: true, crossPaper: false },
    ],
    roots: ["postulate-1", "postulate-2"],
    crossPaperEdges: [],
  };

  test("assignLayers places roots at layer 0 and enforces L(v) > L(u)", () => {
    const layerMap = assignLayers(sampleGraph);

    expect(layerMap.get("postulate-1")).toBe(0);
    expect(layerMap.get("postulate-2")).toBe(0);
    expect(layerMap.get("coord-boost")).toBe(1);
    expect(layerMap.get("length-contraction")).toBe(2);
    expect(layerMap.get("time-dilation")).toBe(2);
    expect(layerMap.get("light-energy")).toBe(2);
  });

  test("assignLayers computes longest path for diamond graphs", () => {
    const diamondGraph: GenealogyGraph = {
      paper: "special-relativity",
      perspective: "historical",
      nodes: [
        { id: "root", paper: "sr", label: "Root", type: "postulate", isRoot: true, isNumberedResult: false },
        { id: "direct-child", paper: "sr", label: "Direct", type: "equation", isRoot: false, isNumberedResult: false },
        { id: "long-1", paper: "sr", label: "Long 1", type: "equation", isRoot: false, isNumberedResult: false },
        { id: "long-2", paper: "sr", label: "Long 2", type: "equation", isRoot: false, isNumberedResult: false },
        { id: "sink", paper: "sr", label: "Sink", type: "result", isRoot: false, isNumberedResult: true },
      ],
      edges: [
        { from: "root", to: "direct-child", edgeType: "historical-derivation", isPremise: true, crossPaper: false },
        { from: "direct-child", to: "sink", edgeType: "historical-derivation", isPremise: true, crossPaper: false },
        { from: "root", to: "long-1", edgeType: "historical-derivation", isPremise: true, crossPaper: false },
        { from: "long-1", to: "long-2", edgeType: "historical-derivation", isPremise: true, crossPaper: false },
        { from: "long-2", to: "sink", edgeType: "historical-derivation", isPremise: true, crossPaper: false },
      ],
      roots: ["root"],
      crossPaperEdges: [],
    };

    const layerMap = assignLayers(diamondGraph);
    expect(layerMap.get("root")).toBe(0);
    expect(layerMap.get("long-1")).toBe(1);
    expect(layerMap.get("long-2")).toBe(2);
    expect(layerMap.get("sink")).toBe(3);
  });

  test("orderLayersBarycentric produces deterministic layers", () => {
    const layerMap = assignLayers(sampleGraph);
    const layers1 = orderLayersBarycentric(sampleGraph, layerMap);
    const layers2 = orderLayersBarycentric(sampleGraph, layerMap);

    expect(layers1.length).toBe(3);
    for (let i = 0; i < layers1.length; i++) {
      const ids1 = layers1[i]!.map((n) => n.id);
      const ids2 = layers2[i]!.map((n) => n.id);
      expect(ids1).toEqual(ids2);
    }
  });

  test("layoutGenealogyGraph produces byte-identical SVG markup across runs", () => {
    const layout1 = layoutGenealogyGraph(sampleGraph);
    const layout2 = layoutGenealogyGraph(sampleGraph);

    expect(layout1.svgMarkup).toBe(layout2.svgMarkup);
    expect(layout1.svgMarkup.length).toBeGreaterThan(100);
    expect(layout1.svgMarkup).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(layout1.svgMarkup).toContain('class="genealogy-graph-svg"');
    expect(layout1.svgMarkup).toContain('data-node-id="coord-boost"');
    expect(layout1.svgMarkup).toContain('data-from="postulate-1" data-to="coord-boost"');

    logger.log({
      testId: "layout-byte-identical-svg",
      beadId: "am-eq-genealogy-hmm",
      paper: "special-relativity",
      outcome: "passed",
      extra: {
        svgLength: layout1.svgMarkup.length,
        nodeCount: layout1.nodes.length,
        edgeCount: layout1.edges.length,
      },
    });
  });

  test("layout respects bounding constants and non-negative coordinates", () => {
    const layout = layoutGenealogyGraph(sampleGraph);

    expect(layout.width).toBeGreaterThanOrEqual(LAYOUT_CONSTANTS.MIN_WIDTH);
    expect(layout.height).toBeGreaterThan(0);

    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.width).toBe(LAYOUT_CONSTANTS.NODE_WIDTH);
      expect(node.height).toBe(LAYOUT_CONSTANTS.NODE_HEIGHT);
    }

    for (const edge of layout.edges) {
      expect(edge.fromPoint.x).toBeGreaterThanOrEqual(0);
      expect(edge.fromPoint.y).toBeGreaterThanOrEqual(0);
      expect(edge.toPoint.x).toBeGreaterThanOrEqual(0);
      expect(edge.toPoint.y).toBeGreaterThanOrEqual(0);
    }
  });
});
