/**
 * Unit tests for multi-line layout hints, validation, and hash impact.
 * Specified in am-eq-expression-tree-8kl (Test Plan: layoutHints.test.ts).
 */

import { describe, expect, test } from "bun:test";
import { evaluateForSpotCheck } from "./evaluateForSpotCheck.ts";
import { computeTreeHash } from "./serialize.ts";
import type { EquationTree } from "./types.ts";
import { validateEquationTreeSemantics } from "./validate.ts";
import { structuralEqual } from "./walk.ts";

describe("Layout Hints and Multi-Line Validation (layoutHints.test.ts)", () => {
  const validBaseTree: EquationTree = {
    treeSchemaVersion: 1,
    root: {
      kind: "relation",
      opId: "eq-1.op.rel",
      operator: "=",
      left: { kind: "symbol", termId: "eq-1.t.lhs", quantityId: "kineticEnergy" },
      right: {
        kind: "sum",
        opId: "eq-1.op.sum",
        args: [
          { kind: "symbol", termId: "eq-1.t.term1", quantityId: "kineticEnergy" },
          { kind: "symbol", termId: "eq-1.t.term2", quantityId: "kineticEnergy" },
          { kind: "symbol", termId: "eq-1.t.term3", quantityId: "kineticEnergy" },
        ],
      },
    },
  };

  test("a break after the relation and after a top-level summand validates", () => {
    const tree: EquationTree = {
      ...validBaseTree,
      layout: {
        breaks: ["eq-1.op.rel", "eq-1.t.term1"],
        alignAt: ["eq-1.op.rel"],
      },
    };
    const res = validateEquationTreeSemantics(tree, { equationId: "eq-1" });
    expect(res.ok).toBe(true);
  });

  test("a break inside a radicand is rejected as linebreak-inside-atom with the node id", () => {
    const tree: EquationTree = {
      treeSchemaVersion: 1,
      root: {
        kind: "relation",
        operator: "=",
        left: { kind: "symbol", termId: "eq-1.t.y", quantityId: "lengthMeasuredStationary" },
        right: {
          kind: "root",
          degree: 2,
          radicand: {
            kind: "sum",
            opId: "eq-1.op.radSum",
            args: [
              {
                kind: "symbol",
                termId: "eq-1.t.insideRad1",
                quantityId: "lengthMeasuredStationary",
              },
              {
                kind: "symbol",
                termId: "eq-1.t.insideRad2",
                quantityId: "lengthMeasuredStationary",
              },
            ],
          },
        },
      },
      layout: {
        breaks: ["eq-1.t.insideRad1"],
      },
    };
    const res = validateEquationTreeSemantics(tree, { equationId: "eq-1" });
    expect(res.ok).toBe(false);
    expect(
      res.diagnostics.some(
        (d) => d.rule === "linebreak-inside-atom" && d.nodeId === "eq-1.t.insideRad1",
      ),
    ).toBe(true);
  });

  test("a break inside a fraction numerator is rejected as linebreak-inside-atom with the node id", () => {
    const tree: EquationTree = {
      treeSchemaVersion: 1,
      root: {
        kind: "relation",
        operator: "=",
        left: { kind: "symbol", termId: "eq-1.t.y", quantityId: "lengthMeasuredStationary" },
        right: {
          kind: "quotient",
          style: "fraction",
          numerator: {
            kind: "sum",
            args: [
              { kind: "symbol", termId: "eq-1.t.inNum1", quantityId: "lengthMeasuredStationary" },
              { kind: "symbol", termId: "eq-1.t.inNum2", quantityId: "lengthMeasuredStationary" },
            ],
          },
          denominator: { kind: "number", value: "2" },
        },
      },
      layout: {
        breaks: ["eq-1.t.inNum1"],
      },
    };
    const res = validateEquationTreeSemantics(tree, { equationId: "eq-1" });
    expect(res.ok).toBe(false);
    expect(
      res.diagnostics.some(
        (d) => d.rule === "linebreak-inside-atom" && d.nodeId === "eq-1.t.inNum1",
      ),
    ).toBe(true);
  });

  test("a break as the last child is rejected", () => {
    const tree: EquationTree = {
      ...validBaseTree,
      layout: {
        breaks: ["eq-1.t.term3"], // Last child of right sum
      },
    };
    const res = validateEquationTreeSemantics(tree, { equationId: "eq-1" });
    expect(res.ok).toBe(false);
    expect(
      res.diagnostics.some(
        (d) => d.rule === "break-after-last-child" && d.nodeId === "eq-1.t.term3",
      ),
    ).toBe(true);
  });

  test("an unresolved alignAt id fails", () => {
    const tree: EquationTree = {
      ...validBaseTree,
      layout: {
        alignAt: ["eq-1.op.nonexistentRelation"],
      },
    };
    const res = validateEquationTreeSemantics(tree, { equationId: "eq-1" });
    expect(res.ok).toBe(false);
    expect(
      res.diagnostics.some(
        (d) => d.rule === "unresolved-align-at" && d.nodeId === "eq-1.op.nonexistentRelation",
      ),
    ).toBe(true);
  });

  test("adding a break changes the serialization hash, and leaves structural equality and evaluation unchanged", () => {
    const treeWithoutBreak: EquationTree = {
      treeSchemaVersion: 1,
      root: validBaseTree.root,
      layout: undefined,
    };
    const treeWithBreak: EquationTree = {
      treeSchemaVersion: 1,
      root: validBaseTree.root,
      layout: {
        breaks: ["eq-1.op.rel"],
        alignAt: ["eq-1.op.rel"],
      },
    };

    // 1. Serialization hash changes
    const hashWithout = computeTreeHash(treeWithoutBreak);
    const hashWith = computeTreeHash(treeWithBreak);
    expect(hashWithout).not.toBe(hashWith);

    // 2. Structural equality is preserved (structural equality checks semantics of root expression)
    expect(structuralEqual(treeWithoutBreak.root, treeWithBreak.root)).toBe(true);

    // 3. Evaluation is unchanged
    const assignment = {
      "eq-1.t.lhs": 100,
      "eq-1.t.term1": 40,
      "eq-1.t.term2": 30,
      "eq-1.t.term3": 30,
    };
    const valWithout = evaluateForSpotCheck(treeWithoutBreak.root, assignment);
    const valWith = evaluateForSpotCheck(treeWithBreak.root, assignment);
    expect(valWithout.status).toBe("value");
    expect(valWith.status).toBe("value");
    if (valWithout.status === "value" && valWith.status === "value") {
      expect(valWithout.value).toBe(valWith.value);
    }
  });
});
