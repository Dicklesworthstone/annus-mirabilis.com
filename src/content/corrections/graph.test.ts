import { describe, expect, it } from "bun:test";
import { CorrectionGraph } from "./graph.ts";

describe("CorrectionGraph", () => {
  it("propagates staleness from source correction to translation units and readings, but not unrelated instruments", () => {
    const graph = new CorrectionGraph();

    // Source block
    graph.addNode({
      id: "s2-p3",
      type: "source-block",
      layer: "source",
      revision: 1,
    });

    // Dependent translation unit
    graph.addNode({
      id: "s2-p3-tr",
      type: "translation-unit",
      layer: "translation",
      revision: 1,
      dependencies: ["s2-p3"],
    });

    // Dependent R1 reading
    graph.addNode({
      id: "reading-r1-s2-p3",
      type: "reading",
      layer: "reading",
      revision: 1,
      dependencies: ["s2-p3-tr"],
    });

    // Unrelated instrument
    graph.addNode({
      id: "bm-06",
      type: "instrument",
      layer: "instrument",
      revision: 1,
    });

    // Record typographical correction to source block s2-p3
    const report = graph.recordCorrection("s2-p3", 2, "source");

    expect(report.correctedId).toBe("s2-p3");
    expect(report.staleNodeIds).toContain("s2-p3-tr");
    expect(report.staleNodeIds).toContain("reading-r1-s2-p3");
    expect(report.staleNodeIds).not.toContain("bm-06");

    expect(report.staleReviewTypes).toContain("german-source");
    expect(report.staleReviewTypes).toContain("physics-math");
  });

  it("verifies translation-layer correction does not alter source correction history", () => {
    const graph = new CorrectionGraph();

    graph.addNode({
      id: "s1-p1",
      type: "source-block",
      layer: "source",
      revision: 1,
    });

    graph.addNode({
      id: "s1-p1-tr",
      type: "translation-unit",
      layer: "translation",
      revision: 1,
      dependencies: ["s1-p1"],
    });

    // Record translation correction
    graph.recordCorrection("s1-p1-tr", 2, "translation");

    expect(graph.getTranslationCorrections().length).toBe(1);
    expect(graph.getSourceCorrections().length).toBe(0);
  });

  it("verifies correction on an isolated block stales nothing", () => {
    const graph = new CorrectionGraph();

    graph.addNode({
      id: "isolated-block",
      type: "source-block",
      layer: "source",
      revision: 1,
    });

    const report = graph.recordCorrection("isolated-block", 2, "source");
    expect(report.staleNodeIds.length).toBe(0);
    expect(report.staleReviewTypes.length).toBe(0);
  });
});
