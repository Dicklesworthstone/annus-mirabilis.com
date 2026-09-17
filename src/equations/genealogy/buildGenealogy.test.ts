import { describe, expect, test } from "bun:test";
import { getLogger } from "../../testing/log/logger.ts";
import { fixtureLorentzMapConstruction, fixturePaper4TwoLedgers } from "../derivations/fixtures.ts";
import type { DerivationChain } from "../derivations/types.ts";
import { buildGenealogy } from "./buildGenealogy.ts";
import type { GenealogyEdge } from "./types.ts";

const logger = getLogger("equations-genealogy");

describe("am-eq-genealogy-hmm: buildGenealogy", () => {
  test("builds graph from equation usedBy links", () => {
    const equations = [
      {
        id: "eq-sr-01-definition",
        paper: "special-relativity",
        title: "Definition of Simultaneity",
        meanings: { logicalRole: "definition" },
        derivationLinks: {
          chainIds: [],
          usedBy: ["eq-sr-03-lorentz-boost"],
        },
      },
      {
        id: "eq-sr-03-lorentz-boost",
        paper: "special-relativity",
        title: "Lorentz Transformation",
        meanings: { logicalRole: "derivation" },
      },
    ];

    const graph = buildGenealogy("special-relativity", equations, [], {
      declaredRoots: ["eq-sr-01-definition"],
    });

    expect(graph.paper).toBe("special-relativity");
    expect(graph.perspective).toBe("historical");
    expect(graph.nodes.length).toBe(2);
    expect(graph.edges.length).toBe(1);

    const edge = graph.edges[0]!;
    expect(edge.from).toBe("eq-sr-01-definition");
    expect(edge.to).toBe("eq-sr-03-lorentz-boost");
    expect(edge.edgeType).toBe("historical-derivation");
    expect(edge.isPremise).toBe(true);
    expect(edge.crossPaper).toBe(false);

    logger.log({
      testId: "buildGenealogy-usedBy",
      beadId: "am-eq-genealogy-hmm",
      paper: "special-relativity",
      outcome: "passed",
      extra: {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
      },
    });
  });

  test("builds Paper 3 graph with 2 postulates at roots, coordinate transforms in middle, and §8 light energy edge to Paper 4", () => {
    // Construct Paper 3 Special Relativity equations and chains
    const srEquations = [
      {
        id: "eq-sr-03-lorentz-boost",
        paper: "special-relativity",
        title: "Lorentz Transformation Equations",
        section: "§3",
        meanings: { logicalRole: "derivation" },
        derivationLinks: {
          chainIds: ["chain-sr-lorentz-boost-construction"],
          usedBy: [
            "eq-sr-04-length-contraction",
            "eq-sr-05-time-dilation",
            "eq-sr-06-maxwell-hertz",
            "eq-sr-07-doppler-aberration",
          ],
        },
      },
      {
        id: "eq-sr-04-length-contraction",
        paper: "special-relativity",
        title: "Physical Meaning of Moving Rods",
        section: "§4",
        meanings: { logicalRole: "derivation" },
      },
      {
        id: "eq-sr-05-time-dilation",
        paper: "special-relativity",
        title: "Clock Retardation",
        section: "§4",
        meanings: { logicalRole: "derivation" },
      },
      {
        id: "eq-sr-06-maxwell-hertz",
        paper: "special-relativity",
        title: "Transformation of Maxwell-Hertz Equations",
        section: "§6",
        meanings: { logicalRole: "derivation" },
        derivationLinks: {
          chainIds: [],
          usedBy: ["eq-sr-08-light-energy", "eq-sr-10-electron-dynamics"],
        },
      },
      {
        id: "eq-sr-07-doppler-aberration",
        paper: "special-relativity",
        title: "Theory of Doppler Effect and Aberration",
        section: "§7",
        meanings: { logicalRole: "derivation" },
        derivationLinks: {
          chainIds: [],
          usedBy: ["eq-sr-08-light-energy"],
        },
      },
      {
        id: "eq-sr-08-light-energy",
        paper: "special-relativity",
        title: "Transformation of Energy of Light Rays",
        section: "§8",
        meanings: { logicalRole: "derivation" },
      },
      {
        id: "eq-sr-10-electron-dynamics",
        paper: "special-relativity",
        title: "Dynamics of the Slowly Accelerated Electron",
        section: "§10",
        meanings: { logicalRole: "derivation" },
      },
    ];

    const chains: DerivationChain[] = [
      fixtureLorentzMapConstruction,
      fixturePaper4TwoLedgers,
    ];

    const graph = buildGenealogy("special-relativity", srEquations, chains, {
      declaredRoots: [
        "premise-relativity-principle",
        "premise-constancy-light-speed",
        "premise-spatial-isotropy",
      ],
    });

    // 1. Postulates at roots
    expect(graph.roots).toContain("premise-relativity-principle");
    expect(graph.roots).toContain("premise-constancy-light-speed");

    // 2. Middle layers have coordinate transformation
    const lorentzNode = graph.nodes.find((n) => n.id === "eq-sr-03-lorentz-boost");
    expect(lorentzNode).toBeDefined();

    // 3. Bottom layers have field, doppler, energy, electron results
    const lightEnergyNode = graph.nodes.find((n) => n.id === "eq-sr-08-light-energy");
    expect(lightEnergyNode).toBeDefined();

    // 4. Cross-paper edge leaving Paper 3 to Paper 4
    expect(graph.crossPaperEdges.length).toBe(1);
    const crossEdge = graph.crossPaperEdges[0]!;
    expect(crossEdge.crossPaper).toBe(true);
    expect(crossEdge.from).toBe("premise-sr-light-energy-transformation");
    expect(crossEdge.to).toBe("me-step-1");
    expect(crossEdge.targetPaper).toBe("mass-energy");
    expect(crossEdge.provenance?.sourcePaper).toBe("special-relativity");
    expect(crossEdge.provenance?.sourceSection).toBe("8");
    expect(crossEdge.provenance?.sourceEquationId).toBe("eq-sr-08-light-energy");

    logger.log({
      testId: "buildGenealogy-paper3",
      beadId: "am-eq-genealogy-hmm",
      paper: "special-relativity",
      outcome: "passed",
      extra: {
        roots: graph.roots,
        crossPaperCount: graph.crossPaperEdges.length,
      },
    });
  });

  test("filters modern verification oracle edges in historical perspective and includes them in modern perspective", () => {
    const customEdges: GenealogyEdge[] = [
      {
        from: "sr-e1",
        to: "sr-e2",
        edgeType: "historical-derivation",
        isPremise: true,
        crossPaper: false,
      },
      {
        from: "modern-oracle-poincare-group",
        to: "sr-e2",
        edgeType: "modern-verification-oracle",
        isPremise: true,
        crossPaper: false,
      },
    ];

    const historicalGraph = buildGenealogy(
      "special-relativity",
      [{ id: "sr-e1" }, { id: "sr-e2" }],
      [],
      {
        perspective: "historical",
        customEdges,
      },
    );

    expect(historicalGraph.edges.length).toBe(1);
    expect(historicalGraph.edges[0]!.edgeType).toBe("historical-derivation");

    const modernGraph = buildGenealogy(
      "special-relativity",
      [{ id: "sr-e1" }, { id: "sr-e2" }, { id: "modern-oracle-poincare-group" }],
      [],
      {
        perspective: "modern",
        customEdges,
      },
    );

    expect(modernGraph.edges.length).toBe(2);
    expect(modernGraph.edges.some((e) => e.edgeType === "modern-verification-oracle")).toBe(true);
  });
});
