import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getLogger } from "../../testing/log/logger.ts";
import { Genealogy, GenealogyListFallback, handleGenealogyKeyDown } from "./Genealogy.tsx";
import { layoutGenealogyGraph } from "./layoutLayers.ts";
import type { GenealogyGraph } from "./types.ts";

const logger = getLogger("equations-genealogy");

describe("am-eq-genealogy-hmm: Genealogy component rendering and navigation", () => {
  const sampleGraph: GenealogyGraph = {
    paper: "special-relativity",
    perspective: "historical",
    nodes: [
      {
        id: "postulate-1",
        paper: "sr",
        label: "Relativity Principle",
        type: "postulate",
        isRoot: true,
        isNumberedResult: false,
      },
      {
        id: "postulate-2",
        paper: "sr",
        label: "Constancy of Light Speed",
        type: "postulate",
        isRoot: true,
        isNumberedResult: false,
      },
      {
        id: "coord-boost",
        paper: "sr",
        label: "Lorentz Boost",
        type: "equation",
        isRoot: false,
        isNumberedResult: false,
      },
      {
        id: "light-energy",
        paper: "sr",
        label: "Light Energy §8",
        type: "result",
        isRoot: false,
        isNumberedResult: true,
      },
      {
        id: "mass-energy-premise",
        paper: "mass-energy",
        label: "Paper 4 Premise",
        type: "external",
        isRoot: false,
        isNumberedResult: false,
      },
    ],
    edges: [
      {
        from: "postulate-1",
        to: "coord-boost",
        edgeType: "historical-derivation",
        isPremise: true,
        crossPaper: false,
      },
      {
        from: "postulate-2",
        to: "coord-boost",
        edgeType: "historical-derivation",
        isPremise: true,
        crossPaper: false,
      },
      {
        from: "coord-boost",
        to: "light-energy",
        edgeType: "historical-derivation",
        isPremise: true,
        crossPaper: false,
      },
      {
        from: "light-energy",
        to: "mass-energy-premise",
        edgeType: "historical-derivation",
        isPremise: true,
        crossPaper: true,
        targetPaper: "mass-energy",
        provenance: {
          sourcePaper: "special-relativity",
          sourceSection: "8",
          sourceEquationId: "eq-sr-08-light-energy",
          admissionRule: "Doppler and aberration transformation of plane light wave energy",
        },
      },
    ],
    roots: ["postulate-1", "postulate-2"],
    crossPaperEdges: [
      {
        from: "light-energy",
        to: "mass-energy-premise",
        edgeType: "historical-derivation",
        isPremise: true,
        crossPaper: true,
        targetPaper: "mass-energy",
        provenance: {
          sourcePaper: "special-relativity",
          sourceSection: "8",
          sourceEquationId: "eq-sr-08-light-energy",
          admissionRule: "Doppler and aberration transformation of plane light wave energy",
        },
      },
    ],
  };

  test("renders static SVG and accessible nested list fallback", () => {
    const html = renderToStaticMarkup(<Genealogy graph={sampleGraph} />);

    // SVG elements
    expect(html).toContain('class="genealogy-container"');
    expect(html).toContain('class="genealogy-graph-svg"');
    expect(html).toContain('data-node-id="postulate-1"');
    expect(html).toContain('data-node-id="coord-boost"');
    expect(html).toContain('data-node-id="light-energy"');

    // Badges
    expect(html).toContain("POSTULATE");
    expect(html).toContain("EQUATION");
    expect(html).toContain("RESULT");

    // Cross-paper banner
    expect(html).toContain('class="genealogy-cross-paper-banner"');
    expect(html).toContain("Leaves special-relativity");
    expect(html).toContain("mass-energy");

    // Accessible nested list fallback
    expect(html).toContain('<nav class="genealogy-list-nav" aria-label="Equation genealogy list">');
    expect(html).toContain('class="genealogy-roots-list"');
    expect(html).toContain('class="genealogy-children-list"');

    logger.log({
      testId: "genealogy-static-render",
      beadId: "am-eq-genealogy-hmm",
      paper: "special-relativity",
      outcome: "passed",
      extra: {
        markupLength: html.length,
      },
    });
  });

  test("nested list fallback deduplicates shared children with 'see above'", () => {
    const html = renderToStaticMarkup(<GenealogyListFallback graph={sampleGraph} />);

    // Both postulate-1 and postulate-2 point to coord-boost.
    // The second time coord-boost is encountered, it should be rendered with 'see above'.
    expect(html).toContain("see above for");
    expect(html).toContain("Lorentz Boost");
  });

  test("keyboard navigation: ArrowDown, ArrowUp, ArrowLeft, ArrowRight, Enter, Escape", () => {
    const layout = layoutGenealogyGraph(sampleGraph);

    let focusedId: string | null = null;
    let selectedId: string | null = null;
    let cleared = false;

    const callbacks = {
      onFocusNode: (id: string) => {
        focusedId = id;
      },
      onSelectNode: (id: string) => {
        selectedId = id;
      },
      onClearSelection: () => {
        cleared = true;
      },
    };

    // 1. Initial state (null) -> ArrowDown selects first root
    handleGenealogyKeyDown({ key: "ArrowDown" }, null, sampleGraph, layout, callbacks);
    expect(selectedId).toBe("postulate-1");

    // 2. From postulate-1 -> ArrowDown moves to child (coord-boost)
    handleGenealogyKeyDown({ key: "ArrowDown" }, "postulate-1", sampleGraph, layout, callbacks);
    expect(selectedId).toBe("coord-boost");

    // 3. From coord-boost -> ArrowUp moves to parent (postulate-1)
    handleGenealogyKeyDown({ key: "ArrowUp" }, "coord-boost", sampleGraph, layout, callbacks);
    expect(selectedId).toBe("postulate-1");

    // 4. From postulate-1 -> ArrowRight moves to next sibling in layer (postulate-2)
    handleGenealogyKeyDown({ key: "ArrowRight" }, "postulate-1", sampleGraph, layout, callbacks);
    expect(selectedId).toBe("postulate-2");

    // 5. From postulate-2 -> ArrowLeft moves back to postulate-1
    handleGenealogyKeyDown({ key: "ArrowLeft" }, "postulate-2", sampleGraph, layout, callbacks);
    expect(selectedId).toBe("postulate-1");

    // 6. Enter selects current node
    selectedId = null;
    handleGenealogyKeyDown({ key: "Enter" }, "light-energy", sampleGraph, layout, callbacks);
    expect(selectedId).toBe("light-energy");

    // 7. Escape clears selection
    handleGenealogyKeyDown({ key: "Escape" }, "light-energy", sampleGraph, layout, callbacks);
    expect(cleared).toBe(true);
  });

  test("renders selected, lineage, and impact highlighting", () => {
    // Select coord-boost: postulate-1 & postulate-2 should have lineage, light-energy & mass-energy-premise should have impact
    const html = renderToStaticMarkup(
      <Genealogy graph={sampleGraph} selectedNodeId="coord-boost" />,
    );

    expect(html).toContain('data-node-id="coord-boost" data-layer="1" data-selected="true"');
    expect(html).toContain(
      'data-node-id="postulate-1" data-layer="0" data-selected="false" data-lineage="true"',
    );
    expect(html).toContain(
      'data-node-id="light-energy" data-layer="2" data-selected="false" data-lineage="false" data-impact="true"',
    );
  });
});
