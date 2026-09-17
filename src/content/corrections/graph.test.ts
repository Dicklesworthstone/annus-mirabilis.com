import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CorrectionGraph, CorrectionGraphError } from "./graph.ts";

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
    const report = graph.recordCorrection("s2-p3", 2, "source", "2026-09-17T00:00:00.000Z");

    assert.equal(report.correctedId, "s2-p3");
    assert.equal(report.edge.fromRevision, 1);
    assert.equal(report.edge.toRevision, 2);
    assert.equal(report.edge.layer, "source");
    assert.equal(graph.getNode("s2-p3")?.revision, 2);
    assert.equal(graph.getEdges().length, 1);
    assert.equal(report.staleNodeIds.includes("s2-p3-tr"), true);
    assert.equal(report.staleNodeIds.includes("reading-r1-s2-p3"), true);
    assert.equal(report.staleNodeIds.includes("bm-06"), false);

    assert.equal(report.staleReviewTypes.includes("german-source"), true);
    assert.equal(report.staleReviewTypes.includes("physics-math"), true);
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

    assert.equal(graph.getTranslationCorrections().length, 1);
    assert.equal(graph.getSourceCorrections().length, 0);
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
    assert.equal(report.staleNodeIds.length, 0);
    assert.equal(report.staleReviewTypes.length, 0);
    assert.equal(report.edge.fromRevision, 1);
    assert.equal(report.edge.toRevision, 2);
  });

  it("planted negative: adding a node twice fails rather than overwriting", () => {
    const graph = new CorrectionGraph();
    graph.addNode({
      id: "s1-p1",
      type: "source-block",
      layer: "source",
      revision: 1,
    });
    assert.throws(
      () =>
        graph.addNode({
          id: "s1-p1",
          type: "source-block",
          layer: "source",
          revision: 99,
        }),
      (err: unknown) => err instanceof CorrectionGraphError && err.code === "duplicate-node",
    );
    assert.equal(graph.getNode("s1-p1")?.revision, 1);
  });

  it("asymmetry: an instrument or visual change does not mark source or translation reviews stale", () => {
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

    graph.addNode({
      id: "bm-01",
      type: "instrument",
      layer: "instrument",
      revision: 1,
      dependencies: ["s1-p1-tr"],
    });

    // Correct instrument bm-01
    const report = graph.recordCorrection("bm-01", 2, "instrument");

    assert.equal(report.staleNodeIds.includes("s1-p1"), false);
    assert.equal(report.staleNodeIds.includes("s1-p1-tr"), false);
    assert.equal(report.staleReviewTypes.includes("german-source"), false);
  });

  it("planted negative: correcting an unknown node fails", () => {
    const graph = new CorrectionGraph();
    assert.throws(
      () => graph.recordCorrection("missing", 2, "source"),
      (err: unknown) => err instanceof CorrectionGraphError && err.code === "unknown-node",
    );
  });

  it("negative test: a source correction that wrongly invalidates unrelated visual work must fail validation", () => {
    const graph = new CorrectionGraph();

    // Source block
    graph.addNode({
      id: "s2-p3",
      type: "source-block",
      layer: "source",
      revision: 1,
    });

    // Unrelated visual / instrument node
    graph.addNode({
      id: "bm-06",
      type: "instrument",
      layer: "instrument",
      revision: 1,
    });

    const report = graph.recordCorrection("s2-p3", 2, "source");

    // The genuine report preserves unrelated visual work bm-06
    assert.equal(report.staleNodeIds.includes("bm-06"), false);
    assert.doesNotThrow(() => graph.validateStalenessBoundary(report, ["bm-06"]));

    // An invalid report that wrongly marks unrelated visual work bm-06 stale fails validation
    const invalidReport = {
      ...report,
      staleNodeIds: [...report.staleNodeIds, "bm-06"],
    };

    assert.throws(
      () => graph.validateStalenessBoundary(invalidReport, ["bm-06"]),
      (err: unknown) =>
        err instanceof CorrectionGraphError &&
        err.code === "unrelated-invalidation" &&
        err.message.includes('wrongly invalidated unrelated node "bm-06"'),
    );
  });
});
