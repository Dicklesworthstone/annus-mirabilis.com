import { describe, expect, test } from "bun:test";
import { getLogger } from "../../testing/log/logger.ts";
import { fixtureLorentzMapConstruction, fixturePaper4TwoLedgers } from "../derivations/fixtures.ts";
import type { DerivationChain } from "../derivations/types.ts";
import { buildGenealogy } from "./buildGenealogy.ts";
import { validateGenealogyConsistency } from "./consistency.ts";
import type { GenealogyEdge, GenealogyGraph } from "./types.ts";

const logger = getLogger("equations-genealogy");

describe("am-eq-genealogy-hmm: validateGenealogyConsistency", () => {
  test("detects missing premise edges when derivation chain cites premise absent from genealogy", () => {
    const srEquations = [
      {
        id: "eq-sr-03-lorentz-boost",
        paper: "special-relativity",
        title: "Lorentz Boost",
        meanings: { logicalRole: "derivation" },
      },
    ];

    // Build a graph without the chain's entry assumptions
    const incompleteGraph: GenealogyGraph = {
      paper: "special-relativity",
      perspective: "historical",
      nodes: [
        {
          id: "eq-sr-03-lorentz-boost",
          paper: "special-relativity",
          label: "Lorentz Boost",
          type: "result",
          isRoot: false,
          isNumberedResult: true,
        },
      ],
      edges: [],
      roots: [],
      crossPaperEdges: [],
    };

    const diagnostics = validateGenealogyConsistency(
      incompleteGraph,
      srEquations,
      [fixtureLorentzMapConstruction],
      { isPaper3: false },
    );

    const missing = diagnostics.filter((d) => d.code === "missing-premise-edge");
    expect(missing.length).toBeGreaterThan(0);
    const firstMissing = missing[0];
    expect(firstMissing?.code).toBe("missing-premise-edge");
    expect(firstMissing?.edge).toBeDefined();

    logger.log({
      testId: "consistency-missing-premise",
      beadId: "am-eq-genealogy-hmm",
      paper: "special-relativity",
      outcome: "passed",
      extra: {
        diagnosticCount: missing.length,
      },
    });
  });

  test("detects spurious genealogy edges not backed by chain premises or usedBy references", () => {
    const graph: GenealogyGraph = {
      paper: "special-relativity",
      perspective: "historical",
      nodes: [
        {
          id: "node-a",
          paper: "special-relativity",
          label: "A",
          type: "equation",
          isRoot: false,
          isNumberedResult: false,
        },
        {
          id: "node-b",
          paper: "special-relativity",
          label: "B",
          type: "equation",
          isRoot: false,
          isNumberedResult: false,
        },
      ],
      edges: [
        {
          from: "node-a",
          to: "node-b",
          edgeType: "historical-derivation",
          isPremise: true,
          crossPaper: false,
        },
      ],
      roots: ["node-a"],
      crossPaperEdges: [],
    };

    // No equations or chains authorizing node-a -> node-b
    const diagnostics = validateGenealogyConsistency(graph, [], [], { isPaper3: false });
    const spurious = diagnostics.filter((d) => d.code === "spurious-genealogy-edge");

    expect(spurious.length).toBe(1);
    expect(spurious[0]?.edge).toEqual({ from: "node-a", to: "node-b" });
  });

  test("detects orphan numbered results with no incoming premise lineage", () => {
    const orphanNode = {
      id: "eq-sr-10-electron-dynamics",
      paper: "special-relativity",
      label: "Dynamics of Electron",
      type: "result" as const,
      anchor: "ap-17-891-s10-e1",
      isRoot: false,
      isNumberedResult: true,
    };

    const graph: GenealogyGraph = {
      paper: "special-relativity",
      perspective: "historical",
      nodes: [orphanNode],
      edges: [],
      roots: ["eq-sr-10-electron-dynamics"],
      crossPaperEdges: [],
    };

    const diagnostics = validateGenealogyConsistency(graph, [], [], { isPaper3: false });
    const orphans = diagnostics.filter((d) => d.code === "genealogy-orphan-result");

    expect(orphans.length).toBe(1);
    expect(orphans[0]?.nodeId).toBe("eq-sr-10-electron-dynamics");
    expect(orphans[0]?.anchor).toBe("ap-17-891-s10-e1");
  });

  test("validates Paper 3 invariant: passes when exactly one outgoing cross-paper edge leaves to Paper 4", () => {
    const srEquations = [
      {
        id: "eq-sr-08-light-energy",
        paper: "special-relativity",
        title: "Energy of Light Complex",
        meanings: { logicalRole: "derivation" },
        derivationLinks: {
          chainIds: [],
          usedBy: [],
        },
      },
      {
        id: "eq-sr-03-lorentz-boost",
        paper: "special-relativity",
        title: "Lorentz Boost",
        meanings: { logicalRole: "derivation" },
      },
    ];

    const chains = [fixtureLorentzMapConstruction, fixturePaper4TwoLedgers];
    const graph = buildGenealogy("special-relativity", srEquations, chains, {
      declaredRoots: [
        "premise-relativity-principle",
        "premise-constancy-light-speed",
        "premise-spatial-isotropy",
      ],
    });

    const diagnostics = validateGenealogyConsistency(graph, srEquations, chains, {
      isPaper3: true,
    });

    const crossErrors = diagnostics.filter((d) => d.code === "invalid-cross-paper-edge-set");
    expect(crossErrors.length).toBe(0);
  });

  test("negative plant: Paper 3 with 0 cross-paper edges fails validation", () => {
    const graph: GenealogyGraph = {
      paper: "special-relativity",
      perspective: "historical",
      nodes: [
        {
          id: "sr-postulate-1",
          paper: "special-relativity",
          label: "Postulate 1",
          type: "postulate",
          isRoot: true,
          isNumberedResult: false,
        },
        {
          id: "sr-eq-1",
          paper: "special-relativity",
          label: "Equation 1",
          type: "result",
          isRoot: false,
          isNumberedResult: true,
        },
      ],
      edges: [
        {
          from: "sr-postulate-1",
          to: "sr-eq-1",
          edgeType: "historical-derivation",
          isPremise: true,
          crossPaper: false,
        },
      ],
      roots: ["sr-postulate-1"],
      crossPaperEdges: [],
    };

    const diagnostics = validateGenealogyConsistency(
      graph,
      [{ id: "sr-postulate-1", derivationLinks: { usedBy: ["sr-eq-1"] } }],
      [],
      { isPaper3: true },
    );

    const crossErrors = diagnostics.filter((d) => d.code === "invalid-cross-paper-edge-set");
    expect(crossErrors.length).toBe(1);
    expect(crossErrors[0]?.message).toContain("found 0");
  });

  test("negative plant: Paper 3 with extra / spurious cross-paper edge fails validation", () => {
    const customEdges: GenealogyEdge[] = [
      {
        from: "premise-sr-light-energy-transformation",
        to: "me-step-1",
        edgeType: "historical-derivation",
        isPremise: true,
        crossPaper: true,
        targetPaper: "mass-energy",
        provenance: {
          sourcePaper: "special-relativity",
          sourceSection: "8",
          sourceEquationId: "eq-sr-08-light-energy",
          admissionRule: "Doppler and aberration transformation",
        },
      },
      // Spurious extra cross-paper edge!
      {
        from: "eq-sr-04-length-contraction",
        to: "bm-step-1",
        edgeType: "historical-derivation",
        isPremise: true,
        crossPaper: true,
        targetPaper: "brownian-motion",
        provenance: {
          sourcePaper: "special-relativity",
          sourceSection: "4",
          sourceEquationId: "eq-sr-04-length-contraction",
          admissionRule: "Spurious cross link",
        },
      },
    ];

    const graph: GenealogyGraph = {
      paper: "special-relativity",
      perspective: "historical",
      nodes: [
        {
          id: "premise-sr-light-energy-transformation",
          paper: "special-relativity",
          label: "Light Energy",
          type: "equation",
          isRoot: true,
          isNumberedResult: false,
        },
        {
          id: "me-step-1",
          paper: "mass-energy",
          label: "Mass Energy Step 1",
          type: "equation",
          isRoot: false,
          isNumberedResult: false,
        },
        {
          id: "eq-sr-04-length-contraction",
          paper: "special-relativity",
          label: "Contraction",
          type: "equation",
          isRoot: true,
          isNumberedResult: false,
        },
        {
          id: "bm-step-1",
          paper: "brownian-motion",
          label: "Brownian Step 1",
          type: "equation",
          isRoot: false,
          isNumberedResult: false,
        },
      ],
      edges: customEdges,
      roots: ["premise-sr-light-energy-transformation", "eq-sr-04-length-contraction"],
      crossPaperEdges: customEdges,
    };

    const diagnostics = validateGenealogyConsistency(graph, [], [], {
      isPaper3: true,
      admittedCustomEdges: customEdges,
    });

    const crossErrors = diagnostics.filter((d) => d.code === "invalid-cross-paper-edge-set");
    expect(crossErrors.length).toBeGreaterThanOrEqual(1);
    expect(crossErrors[0]?.message).toContain("found 2 edges");
  });

  test("detects modern-oracle-in-historical-view when modern oracle is present in historical perspective", () => {
    const graph: GenealogyGraph = {
      paper: "special-relativity",
      perspective: "historical",
      nodes: [
        {
          id: "n1",
          paper: "special-relativity",
          label: "N1",
          type: "equation",
          isRoot: true,
          isNumberedResult: false,
        },
        {
          id: "n2",
          paper: "special-relativity",
          label: "N2",
          type: "equation",
          isRoot: false,
          isNumberedResult: false,
        },
      ],
      edges: [
        {
          from: "n1",
          to: "n2",
          edgeType: "modern-verification-oracle",
          isPremise: true,
          crossPaper: false,
        },
      ],
      roots: ["n1"],
      crossPaperEdges: [],
    };

    const diagnostics = validateGenealogyConsistency(graph, [], [], {
      isPaper3: false,
      admittedCustomEdges: graph.edges,
    });

    const oracleErrors = diagnostics.filter((d) => d.code === "modern-oracle-in-historical-view");
    expect(oracleErrors.length).toBe(1);
    expect(oracleErrors[0]?.code).toBe("modern-oracle-in-historical-view");
  });

  test("detects premise cycles in directed graph", () => {
    const cyclicEdges: GenealogyEdge[] = [
      { from: "a", to: "b", edgeType: "historical-derivation", isPremise: true, crossPaper: false },
      { from: "b", to: "c", edgeType: "historical-derivation", isPremise: true, crossPaper: false },
      { from: "c", to: "a", edgeType: "historical-derivation", isPremise: true, crossPaper: false },
    ];

    const graph: GenealogyGraph = {
      paper: "special-relativity",
      perspective: "historical",
      nodes: [
        {
          id: "a",
          paper: "sr",
          label: "A",
          type: "equation",
          isRoot: false,
          isNumberedResult: false,
        },
        {
          id: "b",
          paper: "sr",
          label: "B",
          type: "equation",
          isRoot: false,
          isNumberedResult: false,
        },
        {
          id: "c",
          paper: "sr",
          label: "C",
          type: "equation",
          isRoot: false,
          isNumberedResult: false,
        },
      ],
      edges: cyclicEdges,
      roots: [],
      crossPaperEdges: [],
    };

    const diagnostics = validateGenealogyConsistency(graph, [], [], {
      isPaper3: false,
      admittedCustomEdges: cyclicEdges,
    });

    const cycleErrors = diagnostics.filter((d) => d.code === "genealogy-cycle-detected");
    expect(cycleErrors.length).toBe(1);
    expect(cycleErrors[0]?.message).toContain("Cycle detected");
  });

  describe("consistency refusal throw sites (am-muyh)", () => {
    const sampleChains: readonly DerivationChain[] | undefined = [fixtureLorentzMapConstruction];

    const entryAssumptionEdges: readonly GenealogyEdge[] = [
      {
        from: "premise-relativity-principle",
        to: "sr-ped-step-1",
        edgeType: "pedagogical-reconstruction",
        isPremise: true,
        crossPaper: false,
      },
      {
        from: "premise-constancy-light-speed",
        to: "sr-ped-step-1",
        edgeType: "pedagogical-reconstruction",
        isPremise: true,
        crossPaper: false,
      },
      {
        from: "premise-spatial-isotropy",
        to: "sr-ped-step-1",
        edgeType: "pedagogical-reconstruction",
        isPremise: true,
        crossPaper: false,
      },
    ];

    const baseGraph: GenealogyGraph = {
      paper: "special-relativity",
      perspective: "historical",
      nodes: [
        {
          id: "sr-ped-step-1",
          paper: "special-relativity",
          label: "Step 1",
          type: "equation",
          isRoot: false,
          isNumberedResult: false,
        },
        {
          id: "sr-ped-step-2",
          paper: "special-relativity",
          label: "Step 2",
          type: "equation",
          isRoot: false,
          isNumberedResult: false,
        },
        {
          id: "sr-ped-step-4",
          paper: "special-relativity",
          label: "Step 4",
          type: "equation",
          isRoot: false,
          isNumberedResult: false,
        },
        {
          id: "sr-ped-step-6",
          paper: "special-relativity",
          label: "Step 6",
          type: "equation",
          isRoot: false,
          isNumberedResult: false,
        },
        {
          id: "premise-relativity-principle",
          paper: "special-relativity",
          label: "Relativity",
          type: "premise",
          isRoot: true,
          isNumberedResult: false,
        },
        {
          id: "premise-constancy-light-speed",
          paper: "special-relativity",
          label: "Light Speed",
          type: "premise",
          isRoot: true,
          isNumberedResult: false,
        },
        {
          id: "premise-spatial-isotropy",
          paper: "special-relativity",
          label: "Spatial Isotropy",
          type: "premise",
          isRoot: true,
          isNumberedResult: false,
        },
        {
          id: "eq-sr-03-lorentz-boost",
          paper: "special-relativity",
          label: "Lorentz Boost",
          type: "result",
          isRoot: false,
          isNumberedResult: true,
        },
      ],
      edges: entryAssumptionEdges,
      roots: [
        "premise-relativity-principle",
        "premise-constancy-light-speed",
        "premise-spatial-isotropy",
      ],
      crossPaperEdges: [],
    };

    test("refusal (consistency.ts:135): missing-premise-edge reports missing sequential step edge", () => {
      if (!sampleChains || sampleChains.length === 0) {
        throw new Error("sampleChains must be defined and non-empty");
      }
      const chain = sampleChains[0];
      if (!chain) {
        throw new Error("chain at index 0 must be defined");
      }

      // Accept: sequential edge present with valid PremiseEdgeType
      const acceptedGraph: GenealogyGraph = {
        ...baseGraph,
        edges: [
          ...entryAssumptionEdges,
          {
            from: "sr-ped-step-1",
            to: "sr-ped-step-2",
            edgeType: "pedagogical-reconstruction",
            isPremise: false,
            crossPaper: false,
          },
        ],
      };
      const passDiags = validateGenealogyConsistency(acceptedGraph, [], [chain], {
        isPaper3: false,
      });
      expect(
        passDiags.some(
          (d) =>
            d.code === "missing-premise-edge" &&
            d.edge?.from === "sr-ped-step-1" &&
            d.edge?.to === "sr-ped-step-2",
        ),
      ).toBe(false);

      // Reject: sequential edge missing
      const failDiags = validateGenealogyConsistency(baseGraph, [], [chain], { isPaper3: false });
      const missing = failDiags.find(
        (d) =>
          d.code === "missing-premise-edge" &&
          d.edge?.from === "sr-ped-step-1" &&
          d.edge?.to === "sr-ped-step-2",
      );
      expect(missing).toBeDefined();
      expect(missing?.message).toContain(
        'sequential step "sr-ped-step-1" -> "sr-ped-step-2" is missing',
      );
    });

    test("refusal (consistency.ts:149): missing-premise-edge reports missing premise reference edge", () => {
      if (!sampleChains || sampleChains.length === 0) {
        throw new Error("sampleChains must be defined and non-empty");
      }
      const chain = sampleChains[0];
      if (!chain) {
        throw new Error("chain at index 0 must be defined");
      }

      // Accept: step premise edge present with valid PremiseEdgeType
      const acceptedGraph: GenealogyGraph = {
        ...baseGraph,
        edges: [
          ...entryAssumptionEdges,
          {
            from: "premise-spatial-isotropy",
            to: "sr-ped-step-4",
            edgeType: "pedagogical-reconstruction",
            isPremise: true,
            crossPaper: false,
          },
        ],
      };
      const passDiags = validateGenealogyConsistency(acceptedGraph, [], [chain], {
        isPaper3: false,
      });
      expect(
        passDiags.some(
          (d) =>
            d.code === "missing-premise-edge" &&
            d.edge?.from === "premise-spatial-isotropy" &&
            d.edge?.to === "sr-ped-step-4",
        ),
      ).toBe(false);

      // Reject: step premise edge missing
      const failDiags = validateGenealogyConsistency(baseGraph, [], [chain], { isPaper3: false });
      const missing = failDiags.find(
        (d) =>
          d.code === "missing-premise-edge" &&
          d.edge?.from === "premise-spatial-isotropy" &&
          d.edge?.to === "sr-ped-step-4",
      );
      expect(missing).toBeDefined();
      expect(missing?.message).toContain(
        'step "sr-ped-step-4" cites premise "premise-spatial-isotropy" but no genealogy edge exists',
      );
    });

    test("refusal (consistency.ts:166): missing-premise-edge reports missing last-step to target edge", () => {
      if (!sampleChains || sampleChains.length === 0) {
        throw new Error("sampleChains must be defined and non-empty");
      }
      const chain = sampleChains[0];
      if (!chain) {
        throw new Error("chain at index 0 must be defined");
      }

      // Accept: target edge present with valid PremiseEdgeType
      const acceptedGraph: GenealogyGraph = {
        ...baseGraph,
        edges: [
          ...entryAssumptionEdges,
          {
            from: "sr-ped-step-6",
            to: "eq-sr-03-lorentz-boost",
            edgeType: "pedagogical-reconstruction",
            isPremise: false,
            crossPaper: false,
          },
        ],
      };
      const passDiags = validateGenealogyConsistency(acceptedGraph, [], [chain], {
        isPaper3: false,
      });
      expect(
        passDiags.some(
          (d) =>
            d.code === "missing-premise-edge" &&
            d.edge?.from === "sr-ped-step-6" &&
            d.edge?.to === "eq-sr-03-lorentz-boost",
        ),
      ).toBe(false);

      // Reject: target edge missing
      const failDiags = validateGenealogyConsistency(baseGraph, [], [chain], { isPaper3: false });
      const missing = failDiags.find(
        (d) =>
          d.code === "missing-premise-edge" &&
          d.edge?.from === "sr-ped-step-6" &&
          d.edge?.to === "eq-sr-03-lorentz-boost",
      );
      expect(missing).toBeDefined();
      expect(missing?.message).toContain(
        'target connection "sr-ped-step-6" -> "eq-sr-03-lorentz-boost" is missing',
      );
    });
  });
});
