/**
 * Unit tests for semantic equation tree validation.
 * Specified in am-eq-expression-tree-8kl (Test Plan: validate.test.ts).
 */

import { describe, expect, test } from "bun:test";
import type { EquationTree } from "./types.ts";
import { validateEquationTreeSemantics } from "./validate.ts";

describe("Equation Tree Semantic Validation (validate.test.ts)", () => {
  test("rejects unbound symbol (missing or empty quantityId)", () => {
    const tree: EquationTree = {
      treeSchemaVersion: 1,
      root: {
        kind: "symbol",
        termId: "eq-1.t.unbound",
        quantityId: "",
      },
    };
    const res = validateEquationTreeSemantics(tree, { equationId: "eq-1" });
    expect(res.ok).toBe(false);
    expect(
      res.diagnostics.some((d) => d.rule === "unbound-symbol" && d.nodeId === "eq-1.t.unbound"),
    ).toBe(true);
  });

  test("rejects duplicate selectable id", () => {
    const tree: EquationTree = {
      treeSchemaVersion: 1,
      root: {
        kind: "sum",
        args: [
          { kind: "symbol", termId: "eq-1.t.dup", quantityId: "temperature" },
          { kind: "symbol", termId: "eq-1.t.dup", quantityId: "temperature" },
        ],
      },
    };
    const res = validateEquationTreeSemantics(tree, { equationId: "eq-1" });
    expect(res.ok).toBe(false);
    expect(
      res.diagnostics.some((d) => d.rule === "duplicate-id" && d.nodeId === "eq-1.t.dup"),
    ).toBe(true);
  });

  test("rejects unknown quantity id", () => {
    const tree: EquationTree = {
      treeSchemaVersion: 1,
      root: {
        kind: "symbol",
        termId: "eq-1.t.unknown",
        quantityId: "completelyInventedQuantity",
      },
    };
    const res = validateEquationTreeSemantics(tree, { equationId: "eq-1" });
    expect(res.ok).toBe(false);
    expect(
      res.diagnostics.some(
        (d) => d.rule === "unknown-quantity-id" && d.nodeId === "eq-1.t.unknown",
      ),
    ).toBe(true);
  });

  test("rejects legacy spelling gasConstant naming molarGasConstant in message", () => {
    const tree: EquationTree = {
      treeSchemaVersion: 1,
      root: {
        kind: "symbol",
        termId: "eq-1.t.r",
        quantityId: "gasConstant",
      },
    };
    const res = validateEquationTreeSemantics(tree, { equationId: "eq-1" });
    expect(res.ok).toBe(false);
    const diag = res.diagnostics.find((d) => d.rule === "rejected-quantity-spelling");
    expect(diag).toBeDefined();
    expect(diag?.nodeId).toBe("eq-1.t.r");
    expect(diag?.message).toContain("molarGasConstant");
  });

  test("rejects printed symbol binding avogadroNumberEstimate", () => {
    const tree: EquationTree = {
      treeSchemaVersion: 1,
      root: {
        kind: "symbol",
        termId: "eq-1.t.n",
        quantityId: "avogadroNumberEstimate",
      },
    };
    const res = validateEquationTreeSemantics(tree, { equationId: "eq-1", isPrinted: true });
    expect(res.ok).toBe(false);
    expect(res.diagnostics.some((d) => d.rule === "invalid-estimate-binding")).toBe(true);
  });

  test("rejects dangling opId in operation explanations", () => {
    const tree: EquationTree = {
      treeSchemaVersion: 1,
      root: {
        kind: "symbol",
        termId: "eq-1.t.x",
        quantityId: "temperature",
      },
    };
    const res = validateEquationTreeSemantics(tree, {
      equationId: "eq-1",
      operationExplanations: [
        { opId: "eq-1.op.nonexistent", explanation: "Explaining non-existent step" },
      ],
    });
    expect(res.ok).toBe(false);
    expect(
      res.diagnostics.some(
        (d) => d.rule === "dangling-op-id" && d.nodeId === "eq-1.op.nonexistent",
      ),
    ).toBe(true);
  });

  test("rejects a group of non-factor members (term inside sum and term inside exponent)", () => {
    const tree: EquationTree = {
      treeSchemaVersion: 1,
      root: {
        kind: "sum",
        args: [
          { kind: "symbol", termId: "eq-1.t.inSum", quantityId: "temperature" },
          {
            kind: "power",
            base: { kind: "number", value: "2" },
            exponent: {
              kind: "symbol",
              termId: "eq-1.t.inExp",
              quantityId: "frequency",
            },
          },
        ],
      },
      groups: [
        {
          id: "group-invalid",
          memberTermIds: ["eq-1.t.inSum", "eq-1.t.inExp"],
          quantityId: "planckConstant",
        },
      ],
    };
    const res = validateEquationTreeSemantics(tree, { equationId: "eq-1" });
    expect(res.ok).toBe(false);
    expect(
      res.diagnostics.some(
        (d) => d.rule === "invalid-group-monomial" && d.nodeId === "group-invalid",
      ),
    ).toBe(true);
  });

  test("rejects unit-conversion alternate without unitSystem or chain", () => {
    const tree: EquationTree = {
      treeSchemaVersion: 1,
      root: {
        kind: "symbol",
        termId: "eq-1.t.a",
        quantityId: "temperature",
      },
      alternateForms: [
        {
          id: "eq-1.alt.si",
          relation: "unit-conversion",
          label: "SI units form",
          tree: { kind: "symbol", termId: "eq-1.t.a", quantityId: "temperature" },
          // Missing unitSystem and derivationChainId
        },
      ],
    };
    const res = validateEquationTreeSemantics(tree, { equationId: "eq-1" });
    expect(res.ok).toBe(false);
    expect(
      res.diagnostics.some((d) => d.rule === "missing-unit-system" && d.nodeId === "eq-1.alt.si"),
    ).toBe(true);
    expect(
      res.diagnostics.some(
        (d) => d.rule === "missing-derivation-chain" && d.nodeId === "eq-1.alt.si",
      ),
    ).toBe(true);
  });

  test("rejects modernization alternate without modernLensId or historicalStatus", () => {
    const tree: EquationTree = {
      treeSchemaVersion: 1,
      root: {
        kind: "symbol",
        termId: "eq-1.t.a",
        quantityId: "mass",
      },
      alternateForms: [
        {
          id: "eq-1.alt.modern",
          relation: "modernization",
          label: "Modern lens",
          tree: { kind: "symbol", termId: "eq-1.t.a", quantityId: "mass" },
          // Missing modernLensId and historicalStatus
        },
      ],
    };
    const res = validateEquationTreeSemantics(tree, { equationId: "eq-1" });
    expect(res.ok).toBe(false);
    expect(
      res.diagnostics.some(
        (d) => d.rule === "missing-modern-lens" && d.nodeId === "eq-1.alt.modern",
      ),
    ).toBe(true);
    expect(
      res.diagnostics.some(
        (d) => d.rule === "invalid-historical-status" && d.nodeId === "eq-1.alt.modern",
      ),
    ).toBe(true);
  });

  test("rejects alternate-is-rename (an alternate that only renames symbols)", () => {
    const primaryTree: EquationTree = {
      treeSchemaVersion: 1,
      root: {
        kind: "symbol",
        termId: "eq-1.t.vUpper",
        quantityId: "speedOfLight",
      },
      alternateForms: [
        {
          id: "eq-1.alt.renameOnly",
          relation: "modernization",
          label: "Modern notation",
          modernLensId: "lens-test",
          historicalStatus: "later-development",
          tree: {
            kind: "symbol",
            termId: "eq-1.t.vUpper",
            quantityId: "speedOfLight", // Exactly same quantity, pure rename
          },
        },
      ],
    };
    const res = validateEquationTreeSemantics(primaryTree, { equationId: "eq-1" });
    expect(res.ok).toBe(false);
    expect(
      res.diagnostics.some(
        (d) => d.rule === "alternate-is-rename" && d.nodeId === "eq-1.alt.renameOnly",
      ),
    ).toBe(true);
  });

  test("rejects semantic-kind conflict (cyclic plus angular frequency)", () => {
    // Both are frequency dimension [0,0,-1,0,0,0], but cyclic-frequency vs angular-frequency
    const tree: EquationTree = {
      treeSchemaVersion: 1,
      root: {
        kind: "sum",
        args: [
          { kind: "symbol", termId: "eq-1.t.nu", quantityId: "frequency" }, // cyclic-frequency
          { kind: "symbol", termId: "eq-1.t.omega", quantityId: "angularFrequency" }, // angular-frequency
        ],
      },
    };
    const res = validateEquationTreeSemantics(tree, { equationId: "eq-1" });
    expect(res.ok).toBe(false);
    expect(res.diagnostics.some((d) => d.rule === "semantic-kind-conflict")).toBe(true);
  });
});
