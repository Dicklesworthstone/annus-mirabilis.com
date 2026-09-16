import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../ast.ts";
import { containsId, structurallyEqual, substituteNode } from "./treeUtils.ts";

const sym = (termId: string, quantityId: string): Expression => ({
  kind: "symbol",
  termId,
  quantityId,
});
const num = (value: string): Expression => ({ kind: "number", value });

test("structurallyEqual is true for identical trees and false for different ones", () => {
  const a: Expression = { kind: "sum", args: [sym("x", "q"), num("1")] };
  const b: Expression = { kind: "sum", args: [sym("x", "q"), num("1")] };
  const c: Expression = { kind: "sum", args: [sym("x", "q"), num("2")] };
  assert.equal(structurallyEqual(a, b), true);
  assert.equal(structurallyEqual(a, c), false);
});

test("structurallyEqual treats an absent scale as 1/1", () => {
  const a: Expression = { kind: "symbol", termId: "x", quantityId: "q" };
  const b: Expression = { kind: "symbol", termId: "x", quantityId: "q", scale: { num: 1, den: 1 } };
  assert.equal(structurallyEqual(a, b), true);
});

test("substituteNode replaces exactly the named node and leaves the rest of the tree unchanged", () => {
  const tree: Expression = {
    kind: "sum",
    args: [{ kind: "symbol", termId: "x", quantityId: "q" }, num("1")],
  };
  const replaced = substituteNode(tree, "x", num("42"));
  assert.deepEqual(replaced, { kind: "sum", args: [num("42"), num("1")] });
});

test("substituteNode reaches into nested quotient, power, root, negate, function, relation, and integral nodes", () => {
  const target = sym("x", "q");
  const cases: Expression[] = [
    { kind: "quotient", numerator: target, denominator: num("2") },
    { kind: "power", base: target, exponent: { num: 2, den: 1 } },
    { kind: "root", radicand: target, degree: 2 },
    { kind: "negate", argument: target },
    { kind: "function", name: "exp", argument: target },
    { kind: "relation", operator: "=", left: target, right: num("0") },
    { kind: "integral", expression: target, variable: sym("t", "q") },
  ];
  for (const tree of cases) {
    const replaced = substituteNode(tree, "x", num("7"));
    assert.equal(containsId(replaced, "x"), false, `expected "x" to be gone from ${tree.kind}`);
  }
});

test("containsId finds a node anywhere in the tree, including deeply nested", () => {
  const tree: Expression = {
    kind: "quotient",
    numerator: { kind: "sum", args: [sym("a", "q"), sym("b", "q")] },
    denominator: sym("c", "q"),
  };
  assert.equal(containsId(tree, "a"), true);
  assert.equal(containsId(tree, "c"), true);
  assert.equal(containsId(tree, "zzz"), false);
});
