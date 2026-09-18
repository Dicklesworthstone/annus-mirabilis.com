/**
 * Pipeline integration test for semantic expression tree compilation.
 *
 * Requirements from am-eq-expression-tree-8kl:
 * "tree.compiler.integration.test.ts: pipeline test compiling an authored paper with
 *  semantic equations through to the reading payload, asserting tree, term bindings,
 *  layout hints, and group metadata are present on the emitted record and neither the
 *  evaluator nor sampler is referenced in the output."
 */

import { describe, expect, it } from "bun:test";
import { validateSemanticEquation } from "../../content/schemas/argument.ts";
import { FIXTURE_1_PRINTED_DIFFUSION, FIXTURE_2_MODERN_DIFFUSION } from "./fixtures.ts";
import type { EquationTree } from "./types.ts";

describe("Semantic Equation Tree Compiler Integration (tree.compiler.integration.test.ts)", () => {
  const baseEquationInput = {
    id: "eq-bm-s3-d4",
    paper: "brownian-motion",
    tree: FIXTURE_1_PRINTED_DIFFUSION.root,
    spokenForm: "D equals R times T over N times one over six pi k a",
    readings: "rs-eq-bm-s3-d4",
    notationForms: {
      source: {
        mode: "authored",
        unitSystem: "gaussian-cgs",
        latex: "D = \\frac{RT}{N} \\frac{1}{6 \\pi k a}",
        termBindings: [
          "eq-bm-s3-d4.t.d",
          "eq-bm-s3-d4.t.r",
          "eq-bm-s3-d4.t.t",
          "eq-bm-s3-d4.t.n",
          "eq-bm-s3-d4.t.k",
          "eq-bm-s3-d4.t.a",
        ],
      },
      modern: {
        mode: "generated",
        unitSystem: "si",
      },
    },
    terms: [
      {
        termId: "eq-bm-s3-d4.t.d",
        quantityId: "diffusionCoefficient",
        role: "subject",
      },
      {
        termId: "eq-bm-s3-d4.t.r",
        quantityId: "molarGasConstant",
        role: "gas-constant",
      },
      {
        termId: "eq-bm-s3-d4.t.t",
        quantityId: "temperature",
        role: "temperature",
      },
      {
        termId: "eq-bm-s3-d4.t.n",
        quantityId: "avogadroConstant",
        role: "avogadro-count",
      },
      {
        termId: "eq-bm-s3-d4.t.k",
        quantityId: "viscosity",
        role: "dynamic-viscosity",
      },
      {
        termId: "eq-bm-s3-d4.t.a",
        quantityId: "particleRadius",
        role: "particle-radius",
      },
    ],
    operations: [
      {
        opId: "eq-bm-s3-d4.op.thermalFactor",
        kind: "quotient",
        explanation: "Thermal energy per molecule (RT/N)",
      },
      {
        opId: "eq-bm-s3-d4.op.stokesFactor",
        kind: "quotient",
        explanation: "Stokes drag mobility factor 1/(6*pi*k*a)",
      },
    ],
    layout: {
      breaks: ["eq-bm-s3-d4.op.stokesFactor"],
      alignAt: ["eq-bm-s3-d4.op.rel"],
    },
    groups: [
      {
        id: "group-thermal",
        memberTermIds: ["eq-bm-s3-d4.t.r", "eq-bm-s3-d4.t.n"],
        quantityId: "boltzmannConstant",
        modernSymbol: "k_B",
      },
      {
        id: "group-stokes",
        memberTermIds: ["eq-bm-s3-d4.t.k", "eq-bm-s3-d4.t.a"],
        quantityId: "viscosity",
      },
    ],
    alternateForms: [
      {
        id: "eq-bm-s3-d4.alt.modern",
        label: "Modern form with Boltzmann constant and SI units",
        relation: "modernization",
        tree: FIXTURE_2_MODERN_DIFFUSION.root,
        modernLensId: "lens-modern-stokes",
        historicalStatus: "later-development",
      },
    ],
    meanings: {
      logicalRole: "derivation",
      historicalStatus: "introduced-in-current-paper",
      modelStatus: "exact-within-model",
      executionStatus: "static-illustration",
    },
    authorship: {
      draftedBy: [
        {
          id: "albert-einstein",
          name: "Albert Einstein",
          kind: "human",
        },
      ],
    },
  };

  it("compiles authored semantic equation record retaining tree, layout hints, and group metadata", () => {
    const compiled = validateSemanticEquation(baseEquationInput);

    // 1. Core identification and tree
    expect(compiled.id).toBe("eq-bm-s3-d4");
    expect(compiled.paper).toBe("brownian-motion");
    expect(compiled.tree).toBeDefined();

    // 2. Term bindings
    expect(compiled.terms).toHaveLength(6);
    expect(compiled.terms[0]!.termId).toBe("eq-bm-s3-d4.t.d");
    expect(compiled.terms[0]!.quantityId).toBe("diffusionCoefficient");

    // 3. Layout hints
    expect(compiled.layout).toBeDefined();
    expect(compiled.layout?.breaks).toContain("eq-bm-s3-d4.op.stokesFactor");
    expect(compiled.layout?.alignAt).toContain("eq-bm-s3-d4.op.rel");

    // 4. Group metadata
    expect(compiled.groups).toBeDefined();
    expect(compiled.groups).toHaveLength(2);
    expect(compiled.groups![0]!.id).toBe("group-thermal");
    expect(compiled.groups![1]!.id).toBe("group-stokes");

    // 5. Alternate forms
    expect(compiled.alternateForms).toBeDefined();
    expect(compiled.alternateForms).toHaveLength(1);
    expect(compiled.alternateForms![0]!.relation).toBe("modernization");

    // 6. Serializability & pure data payload
    const jsonStr = JSON.stringify(compiled);
    expect(typeof jsonStr).toBe("string");
    expect(jsonStr.length).toBeGreaterThan(0);

    // Neither evaluator nor sampler is referenced or bundled in payload
    expect(jsonStr).not.toContain("evaluateForSpotCheck");
    expect(jsonStr).not.toContain("sampleAdmissiblePoint");
    expect((compiled as Record<string, unknown>).evaluateForSpotCheck).toBeUndefined();
    expect((compiled as Record<string, unknown>).sampleAdmissiblePoint).toBeUndefined();

    // Re-parse from JSON produces identical representation
    const roundtripped = JSON.parse(jsonStr);
    expect(roundtripped.id).toBe(compiled.id);
    expect(roundtripped.groups.length).toBe(compiled.groups!.length);
    expect(roundtripped.layout.breaks).toEqual(compiled.layout!.breaks);
  });

  it("planted negative: rejects equation with malformed layout hints", () => {
    const invalidLayoutInput = {
      ...baseEquationInput,
      layout: {
        breaks: [123], // invalid break id, must be string
      },
    };

    expect(() => validateSemanticEquation(invalidLayoutInput)).toThrow();
  });

  it("planted negative: rejects equation with malformed composite groups", () => {
    const invalidGroupInput = {
      ...baseEquationInput,
      groups: [
        {
          id: "bad-group",
          // memberTermIds with only 1 member is invalid for a composite group
          memberTermIds: ["eq-bm-s3-d4.t.d"],
          quantityId: "boltzmannConstant",
        },
      ],
    };

    expect(() => validateSemanticEquation(invalidGroupInput)).toThrow();
  });

  it("planted negative: rejects equation with malformed alternate forms", () => {
    const invalidAlternateInput = {
      ...baseEquationInput,
      alternateForms: [
        {
          id: "eq-bm-s3-d4.alt.bad",
          relation: "unsupported-relation",
          tree: FIXTURE_2_MODERN_DIFFUSION.root,
        },
      ],
    };

    expect(() => validateSemanticEquation(invalidAlternateInput)).toThrow();
  });
});
