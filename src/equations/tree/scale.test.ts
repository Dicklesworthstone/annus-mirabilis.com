/**
 * Unit tests for exact scale semantics, walker preservation, serialization, and validation.
 * Specified in am-eq-expression-tree-8kl (Test Plan: scale.test.ts).
 */

import { describe, expect, test } from "bun:test";
import { evaluateForSpotCheck } from "./evaluateForSpotCheck.ts";
import { FIXTURE_13_SCALE_RELATION } from "./fixtures.ts";
import { canonicalJsonStringify } from "./serialize.ts";
import type { EquationTree, Expression } from "./types.ts";
import { validateEquationTreeSemantics } from "./validate.ts";
import { quantityIdsReferenced, structuralEqual, substitute } from "./walk.ts";

describe("Exact Scale Semantics (scale.test.ts)", () => {
  const kappaTree: Expression = {
    kind: "symbol",
    termId: "eq-bm-s2-1.t.kappa",
    quantityId: "boltzmannConstant",
    scale: { num: 1, den: 2 },
  };

  test("a kappa fixture binds boltzmannConstant with { num: 1, den: 2 }", () => {
    expect(kappaTree.kind).toBe("symbol");
    if (kappaTree.kind === "symbol") {
      expect(kappaTree.quantityId).toBe("boltzmannConstant");
      expect(kappaTree.scale).toEqual({ num: 1, den: 2 });
    }
  });

  test("quantityIdsReferenced returns the pair, not the bare id", () => {
    const refs = quantityIdsReferenced(FIXTURE_13_SCALE_RELATION.root);
    const kappaRef = refs.find(([q]) => q === "boltzmannConstant");
    expect(kappaRef).toBeDefined();
    expect(kappaRef?.[0]).toBe("boltzmannConstant");
    expect(kappaRef?.[1]).toEqual({ num: 1, den: 2 });
  });

  test("substitution preserves scale on replaced or surrounding nodes", () => {
    const root: Expression = {
      kind: "sum",
      args: [
        kappaTree,
        {
          kind: "symbol",
          termId: "eq-bm-s2-1.t.target",
          quantityId: "temperature",
        },
      ],
    };
    const replaced = substitute(root, "eq-bm-s2-1.t.target", {
      kind: "number",
      value: "300",
    });
    const refs = quantityIdsReferenced(replaced);
    const kappaRef = refs.find(([q]) => q === "boltzmannConstant");
    expect(kappaRef?.[1]).toEqual({ num: 1, den: 2 });
  });

  test("serialization preserves scale byte-for-byte", () => {
    const serialized = canonicalJsonStringify(kappaTree);
    expect(serialized).toContain('"scale":{"den":2,"num":1}');
  });

  test("two trees differing only in scale are not structurally equal", () => {
    const treeA: Expression = {
      kind: "symbol",
      termId: "eq-bm-s2-1.t.kappa",
      quantityId: "boltzmannConstant",
      scale: { num: 1, den: 2 },
    };
    const treeB: Expression = {
      kind: "symbol",
      termId: "eq-bm-s2-1.t.kappa",
      quantityId: "boltzmannConstant",
      scale: { num: 1, den: 1 },
    };
    expect(structuralEqual(treeA, treeB)).toBe(false);
  });

  test("evaluateForSpotCheck returns half the active set's Boltzmann constant for that binding", () => {
    const kbVal = 1.380649e-23;
    const res = evaluateForSpotCheck(kappaTree, { boltzmannConstant: kbVal });
    expect(res.status).toBe("value");
    if (res.status === "value") {
      expect(res.value).toBe(kbVal / 2);
    }
  });

  test("{ num: 0, den: 1 }, { num: 1, den: 0 }, and { num: 2, den: 4 } are each rejected with the term id", () => {
    // 1. num = 0
    const treeZeroNum: EquationTree = {
      treeSchemaVersion: 1,
      root: {
        kind: "symbol",
        termId: "eq-bm-s2-1.t.badZero",
        quantityId: "boltzmannConstant",
        scale: { num: 0, den: 1 },
      },
    };
    const resZero = validateEquationTreeSemantics(treeZeroNum, { equationId: "eq-bm-s2-1" });
    expect(resZero.ok).toBe(false);
    expect(
      resZero.diagnostics.some(
        (d) => d.nodeId === "eq-bm-s2-1.t.badZero" && d.rule === "zero-scale",
      ),
    ).toBe(true);

    // 2. den = 0
    const treeZeroDen: EquationTree = {
      treeSchemaVersion: 1,
      root: {
        kind: "symbol",
        termId: "eq-bm-s2-1.t.badDen",
        quantityId: "boltzmannConstant",
        scale: { num: 1, den: 0 },
      },
    };
    const resDen = validateEquationTreeSemantics(treeZeroDen, { equationId: "eq-bm-s2-1" });
    expect(resDen.ok).toBe(false);
    expect(
      resDen.diagnostics.some(
        (d) => d.nodeId === "eq-bm-s2-1.t.badDen" && d.rule === "invalid-scale-denominator",
      ),
    ).toBe(true);

    // 3. non-reduced { num: 2, den: 4 }
    const treeNonReduced: EquationTree = {
      treeSchemaVersion: 1,
      root: {
        kind: "symbol",
        termId: "eq-bm-s2-1.t.nonReduced",
        quantityId: "boltzmannConstant",
        scale: { num: 2, den: 4 },
      },
    };
    const resRed = validateEquationTreeSemantics(treeNonReduced, { equationId: "eq-bm-s2-1" });
    expect(resRed.ok).toBe(false);
    expect(
      resRed.diagnostics.some(
        (d) => d.nodeId === "eq-bm-s2-1.t.nonReduced" && d.rule === "non-reduced-scale",
      ),
    ).toBe(true);
  });
});
