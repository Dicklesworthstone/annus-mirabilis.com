import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../../ast.ts";
import { collectRule } from "./collect.ts";

const sym = (termId: string): Expression => ({ kind: "symbol", termId, quantityId: termId });
const num = (value: string): Expression => ({ kind: "number", value });
const mul = (...args: Expression[]): Expression => ({ kind: "product", args });
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const div = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
const eq = (left: Expression, right: Expression): Expression => ({
  kind: "relation",
  operator: "=",
  left,
  right,
});
const [x, y, z] = ["x", "y", "z"].map(sym) as [Expression, Expression, Expression];
const check = (from: Expression, to: Expression) =>
  collectRule.check({ from, to, params: { exact: true } }).outcome;

test("exact collection combines Stokes mobility with the thermal factor", () => {
  const R = sym("R"),
    T = sym("T"),
    N = sym("N"),
    eta = sym("eta"),
    a = sym("a");
  const drag = mul(num("6"), { kind: "constant", name: "pi" }, eta, a);
  const from = eq(x, mul(div(num("1"), drag), div(mul(R, T), N)));
  const to = eq(x, div(mul(R, T), mul(drag, N)));
  assert.equal(check(from, to), "pass");
  assert.equal(check(from, eq(x, div(mul(R, T), mul(num("2"), drag, N)))), "fail");
});

test("exact collection checks each equation side and never silently swaps it", () => {
  const from = eq(sum(x, x), sum(y, y));
  const to = eq(mul(num("2"), x), mul(num("2"), y));
  assert.equal(check(from, to), "pass");
  assert.equal(check(from, eq(mul(num("2"), y), mul(num("2"), x))), "fail");
  assert.equal(check(from, eq(mul(num("2"), x), mul(num("3"), y))), "fail");
  assert.equal(check(from, { kind: "relation", operator: "approx", left: x, right: y }), "fail");
});

test("exact collection refuses a tiny wrong coefficient and a new denominator", () => {
  assert.equal(check(sum(num("1"), num("1e-100")), num("1")), "fail");
  assert.equal(check(x, div(mul(x, z), z)), "fail");
  assert.equal(check(div(x, num("0")), num("0")), "fail");
});

test("an exact collection cannot claim an unsupported calculus identity or its own input", () => {
  const derivative: Expression = {
    kind: "derivative",
    expression: x,
    variable: x,
    order: 1,
    partial: false,
  };
  assert.equal(check(derivative, num("1")), "unverifiable");
  assert.equal(check(x, x), "fail");
  assert.equal(
    collectRule.check({ from: sum(x, x), to: mul(num("2"), x), params: { exact: "yes" } }).outcome,
    "fail",
  );
});

test("an unsupported left side cannot hide an independently wrong right side", () => {
  const derivative: Expression = {
    kind: "derivative",
    expression: x,
    variable: x,
    order: 1,
    partial: false,
  };
  assert.equal(check(eq(derivative, num("1")), eq(num("1"), num("2"))), "fail");
});
