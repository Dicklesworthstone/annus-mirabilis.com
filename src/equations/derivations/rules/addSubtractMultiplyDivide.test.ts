import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../../ast.ts";
import { addSubtractMultiplyDivideRule } from "./addSubtractMultiplyDivide.ts";

const sym = (termId: string): Expression => ({ kind: "symbol", termId, quantityId: termId });
const num = (value: string): Expression => ({ kind: "number", value });
const add = (...args: Expression[]): Expression => ({ kind: "sum", args });
const mul = (...args: Expression[]): Expression => ({ kind: "product", args });
const neg = (argument: Expression): Expression => ({ kind: "negate", argument });
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
const check = (from: Expression, to: Expression, params: Record<string, unknown>) =>
  addSubtractMultiplyDivideRule.check({ from, to, params }).outcome;

test("literal arithmetic stays compatible and exact simplification is opt-in", () => {
  const from = eq(add(x, z), y);
  const params = { operation: "subtract", quantity: z };
  const literal = eq(add(add(x, z), neg(z)), add(y, neg(z)));
  const simplified = eq(x, add(y, neg(z)));
  assert.equal(check(from, literal, params), "pass");
  assert.equal(check(from, simplified, params), "unverifiable");
  assert.equal(check(from, simplified, { ...params, simplify: true }), "pass");
});

test("pressure balance adds the same force to both sides and declares their exchange", () => {
  const force = mul(sym("density"), sym("force"));
  const gradient: Expression = {
    kind: "derivative",
    expression: sym("density"),
    variable: x,
    order: 1,
    partial: true,
  };
  const pressure = mul(sym("thermalCoefficient"), gradient);
  const from = eq(add(neg(force), pressure), num("0"));
  const to = eq(force, pressure);
  const params = { operation: "add", quantity: force, simplify: true, swapSides: true };
  assert.equal(check(from, to, params), "pass");
  assert.notEqual(check(from, to, { ...params, swapSides: false }), "pass");
  assert.notEqual(check(from, to, { ...params, quantity: sym("unrelated") }), "pass");
});

test("a nonzero derivative may cancel as an opaque value without checking its physics", () => {
  const gradient: Expression = {
    kind: "derivative",
    expression: sym("density"),
    variable: x,
    order: 1,
    partial: true,
  };
  const from = eq(mul(x, gradient), mul(y, z, gradient));
  const to = eq(x, mul(y, z));
  const params = {
    operation: "divide",
    quantity: gradient,
    simplify: true,
    nonzeroCondition: "The selected equilibrium has a nonzero density gradient.",
  };
  assert.equal(check(from, to, params), "pass");
  assert.equal(check(from, to, { ...params, nonzeroCondition: "" }), "fail");
  assert.equal(check(from, to, { ...params, nonzeroCondition: " \n " }), "fail");
  assert.notEqual(check(from, eq(x, y), params), "pass");
});

test("coefficient division and its declared side exchange are checked exactly", () => {
  const R = sym("R"),
    N = sym("N"),
    E = sym("E"),
    B = sym("B"),
    nu = sym("nu");
  const coefficient = div(R, N);
  const from = eq(div(E, mul(B, nu)), mul(coefficient, x));
  const to = eq(x, div(mul(N, E), mul(R, B, nu)));
  const params = {
    operation: "divide",
    quantity: coefficient,
    nonzeroCondition: "R > 0 and N > 0.",
    simplify: true,
    swapSides: true,
  };
  assert.equal(check(from, to, params), "pass");
  assert.equal(check(from, to, { ...params, swapSides: false }), "fail");
  assert.equal(check(from, eq(x, div(mul(R, E), mul(N, B, nu))), params), "fail");
});

test("changed operation, changed divisor and a change on only one side cannot pass", () => {
  const from = eq(mul(num("2"), x), mul(num("2"), y));
  const to = eq(x, y);
  const params = {
    operation: "divide",
    quantity: num("2"),
    nonzeroCondition: "2 is nonzero.",
    simplify: true,
  };
  assert.equal(check(from, to, params), "pass");
  assert.equal(check(from, to, { ...params, quantity: num("3") }), "fail");
  assert.equal(check(from, to, { ...params, operation: "multiply" }), "fail");
  assert.equal(check(from, eq(x, mul(num("2"), y)), params), "fail");
});

test("a sampled-looking near equality and a new denominator are both refused", () => {
  const from = eq(x, y);
  const params = { operation: "add", quantity: num("1"), simplify: true };
  assert.equal(check(from, eq(add(x, num("1"), num("1e-100")), add(y, num("1"))), params), "fail");
  assert.equal(check(from, eq(div(mul(add(x, num("1")), z), z), add(y, num("1"))), params), "fail");
});

test("a written nonzero condition cannot make an identically zero divisor valid", () => {
  const from = eq(x, y);
  for (const zero of [num("0"), add(z, neg(z))]) {
    const params = {
      operation: "divide",
      quantity: zero,
      nonzeroCondition: "The divisor is nonzero.",
      simplify: true,
    };
    assert.equal(check(from, eq(div(x, zero), div(y, zero)), params), "fail");
    assert.equal(check(from, eq(num("1"), num("1")), params), "fail");
  }
});

test("the operator is preserved and multiplying an inequality needs a separate sign owner", () => {
  const from = { kind: "relation", operator: "le", left: x, right: y } as const;
  const addParams = { operation: "add", quantity: z, simplify: true };
  const to = { ...from, left: add(x, z), right: add(y, z) };
  assert.equal(check(from, to, addParams), "pass");
  assert.equal(check(from, { ...to, operator: "=" }, addParams), "fail");
  assert.equal(check(from, to, { ...addParams, swapSides: true }), "fail");
  assert.equal(
    check(
      from,
      { ...from, left: mul(x, neg(z)), right: mul(y, neg(z)) },
      { operation: "multiply", quantity: neg(z), simplify: true },
    ),
    "unverifiable",
  );
});

test("no unchanged step and no unsupported calculus identity can claim a check", () => {
  const from = eq(x, y);
  assert.equal(check(from, from, { operation: "add", quantity: num("0"), simplify: true }), "fail");
  const root: Expression = {
    kind: "root",
    degree: 2,
    radicand: { kind: "power", base: x, exponent: { num: 2, den: 1 } },
  };
  assert.equal(
    check(eq(root, y), from, { operation: "multiply", quantity: num("1"), simplify: true }),
    "unverifiable",
  );
});

test("invalid options and expressions beyond the exact budget do not pass", () => {
  const from = eq(x, y);
  const to = eq(add(x, z), add(y, z));
  const params = { operation: "add", quantity: z, simplify: true };
  assert.equal(check(from, to, { ...params, operation: "power" }), "fail");
  assert.equal(check(from, to, { ...params, simplify: "yes" }), "fail");
  assert.equal(check(from, to, { ...params, swapSides: "yes" }), "fail");
  let nested = z;
  for (let i = 0; i < 40; i++) nested = { kind: "group", argument: nested };
  assert.equal(check(from, to, { ...params, quantity: nested }), "unverifiable");
});
