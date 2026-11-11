import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../ast.ts";
import { checkRationalSimplification } from "./rationalSimplification.ts";

const sym = (termId: string, quantityId = termId): Expression => ({
  kind: "symbol",
  termId,
  quantityId,
});
const num = (value: string): Expression => ({ kind: "number", value });
const mul = (...args: Expression[]): Expression => ({ kind: "product", args });
const add = (...args: Expression[]): Expression => ({ kind: "sum", args });
const neg = (argument: Expression): Expression => ({ kind: "negate", argument });
const div = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
const pow = (base: Expression, exponent : number): Expression =>
  ({ kind: "power", base, exponent: { num: exponent, den: 1 } });
const [x, y, z] = ["x", "y", "z"].map((name) => sym(name)) as [Expression, Expression, Expression];
const outcome = (from: Expression, to: Expression) =>
  checkRationalSimplification(from, to).outcome;

test("rational simplification cancels a common factor while retaining the input domain", () => {
  assert.equal(outcome(div(mul(x, y), x), y), "equal");
  assert.equal(outcome(div(add(pow(x, 2), neg(pow(y, 2))), add(x, neg(y))), add(x, y)), "equal");
  assert.equal(outcome(div(x, x), num("1")), "equal");
});

test("nested fractions retain every original nonzero denominator", () => {
  assert.equal(outcome(div(x, div(y, z)), div(mul(x, z), y)), "equal");
  assert.equal(outcome(div(div(x, y), z), div(x, mul(y, z))), "equal");
  assert.equal(outcome(div(x, mul(num("2"), y)), mul(num("0.5"), div(x, y))), "equal");
});

test("a proposed denominator may reorder existing factors but may not narrow the domain", () => {
  assert.equal(outcome(div(x, mul(y, z)), div(x, mul(z, y))), "equal");
  assert.equal(outcome(x, div(pow(x, 2), x)), "domain-change");
  assert.equal(outcome(num("1"), div(x, x)), "domain-change");
});

test("zero divisors are refused before cancellation, including algebraic and hidden zeros", () => {
  for (const zero of [num("0"), add(x, neg(x)), mul(num("0"), x)])
    assert.equal(outcome(div(zero, zero), num("1")), "undefined");
  assert.equal(outcome(mul(num("0"), div(x, num("0"))), num("0")), "undefined");
  assert.equal(outcome(div(x, y), div(x, num("0"))), "undefined");
});

test("exact decimals distinguish changes far below a floating-point tolerance", () => {
  assert.equal(outcome(add(num("0.1"), num("0.2")), num("0.3")), "equal");
  assert.equal(outcome(add(num("1"), num("1e-100")), num("1")), "different");
  assert.equal(outcome(div(num("1"), num("3")), num("0.3333333333333333")), "different");
});

test("same-quantity occurrences, indices and function arguments never collapse", () => {
  assert.equal(outcome(div(sym("a", "q"), sym("b", "q")), num("1")), "different");
  const a = { kind: "symbol", termId: "v", quantityId: "volume", index: "0" } as const;
  const b = { ...a, index: "1" };
  assert.equal(outcome(div(a, b), num("1")), "different");
  const p = { kind: "symbol", termId: "p", quantityId: "density", args: [x, y] } as const;
  assert.notEqual(outcome(div(p, { ...p, args: [y, x] }), num("1")), "equal");
});

test("exact symbol scales are coefficients, including a zero-scaled divisor", () => {
  const twice = { ...sym("x"), scale: { num: 2, den: 1 } } as Expression;
  assert.equal(outcome(twice, mul(num("2"), x)), "equal");
  const zero = { ...sym("x"), scale: { num: 0, den: 1 } } as Expression;
  assert.equal(outcome(div(zero, zero), num("1")), "undefined");
});

test("a nonzero derivative cancels as an opaque value without inferring calculus", () => {
  const gradient: Expression = {
    kind: "derivative",
    expression: sym("n"),
    variable: x,
    order: 1,
    partial: true,
    heldFixed: [y],
  };
  assert.equal(outcome(div(mul(z, gradient), gradient), z), "equal");
  assert.notEqual(outcome(gradient, { ...gradient, heldFixed: [z] }), "equal");
  assert.notEqual(outcome(gradient, num("0")), "equal");
});

test("logarithms and roots keep their arguments and do not create a hidden new domain", () => {
  const log: Expression = { kind: "function", name: "ln", argument: div(x, y) };
  assert.equal(outcome(div(mul(z, log), log), z), "equal");
  assert.notEqual(outcome(log, { ...log, argument: div(y, x) }), "equal");
  const root: Expression = { kind: "root", degree: 2, radicand: pow(x, 2) };
  assert.equal(outcome(root, x), "unsupported");
  assert.equal(outcome(num("0"), mul(num("0"), log)), "unsupported");
});

test("infinity never becomes a finite arithmetic atom", () => {
  assert.equal(outcome(div(x, { kind: "constant", name: "infinity" }), num("0")), "undefined");
});

test("bounded expressions refuse excessive depth and exact expansion", () => {
  let nested = x;
  for (let i = 0; i < 40; i++) nested = { kind: "group", argument: nested };
  assert.equal(outcome(nested, x), "unsupported");
  const wide = pow(add(...Array.from({ length: 10 }, (_, i) => sym("v" + i))), 16);
  assert.equal(outcome(wide, num("1")), "unsupported");
});

test("new applied symbols cannot hide their argument domain behind zero or cancellation", () => {
  const at: Expression = {
    kind: "symbol",
    termId: "n",
    quantityId: "numberDensity",
    at: div(num("1"), x),
  };
  const args: Expression = {
    kind: "symbol",
    termId: "p",
    quantityId: "probabilityDensity",
    args: [x, div(num("1"), y)],
  };
  for (const application of [at, args]) {
    assert.equal(outcome(num("0"), mul(num("0"), application)), "unsupported");
    assert.equal(outcome(num("0"), add(application, neg(application))), "unsupported");
    assert.equal(outcome(div(application, application), num("1")), "equal");
  }
});
