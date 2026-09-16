import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../ast.ts";
import {
  DEFAULT_SPOT_CHECK_TOLERANCE,
  evaluateExpression,
  sampleAdmissiblePoint,
  spotCheckEquivalence,
} from "./spotCheck.ts";

const sym = (termId: string, quantityId: string): Expression => ({
  kind: "symbol",
  termId,
  quantityId,
});
const num = (value: string): Expression => ({ kind: "number", value });

test("sampleAdmissiblePoint is deterministic for a given seed and draws within range", () => {
  const a = sampleAdmissiblePoint(["x", "y"], 42n);
  const b = sampleAdmissiblePoint(["x", "y"], 42n);
  assert.deepEqual(a, b);
  assert.equal(a.seed, "42");
  for (const value of Object.values(a.bindings)) {
    assert.ok(value >= 0.5 && value <= 5);
  }
});

test("different seeds draw different points", () => {
  const a = sampleAdmissiblePoint(["x"], 1n);
  const b = sampleAdmissiblePoint(["x"], 2n);
  assert.notEqual(a.bindings.x, b.bindings.x);
});

test("evaluateExpression handles sum, product, quotient, power, root, negate, function", () => {
  const bindings = { x: 4, y: 2 };
  assert.equal(
    evaluateExpression({ kind: "sum", args: [sym("x", "q"), sym("y", "q")] }, bindings),
    6,
  );
  assert.equal(
    evaluateExpression({ kind: "product", args: [sym("x", "q"), sym("y", "q")] }, bindings),
    8,
  );
  assert.equal(
    evaluateExpression(
      { kind: "quotient", numerator: sym("x", "q"), denominator: sym("y", "q") },
      bindings,
    ),
    2,
  );
  assert.equal(
    evaluateExpression(
      { kind: "power", base: sym("y", "q"), exponent: { num: 2, den: 1 } },
      bindings,
    ),
    4,
  );
  assert.equal(
    evaluateExpression({ kind: "root", radicand: sym("x", "q"), degree: 2 }, bindings),
    2,
  );
  assert.equal(evaluateExpression({ kind: "negate", argument: sym("x", "q") }, bindings), -4);
  assert.equal(
    evaluateExpression({ kind: "function", name: "exp", argument: num("0") }, bindings),
    1,
  );
});

test("evaluateExpression throws SpotCheckDomainError on division by zero and negative even root", () => {
  assert.throws(() =>
    evaluateExpression({ kind: "quotient", numerator: num("1"), denominator: num("0") }, {}),
  );
  assert.throws(() => evaluateExpression({ kind: "root", radicand: num("-1"), degree: 2 }, {}));
  assert.throws(() =>
    evaluateExpression({ kind: "function", name: "ln", argument: num("-1") }, {}),
  );
});

test("evaluateExpression refuses to evaluate a relation, derivative, or integral node directly", () => {
  const relation: Expression = { kind: "relation", operator: "=", left: num("1"), right: num("1") };
  assert.throws(() => evaluateExpression(relation, {}));
});

test("spotCheckEquivalence confirms two structurally different but numerically equal expressions agree", () => {
  // (x + x) and (2 * x) are the same value for any x.
  const left: Expression = { kind: "sum", args: [sym("x", "q"), sym("x", "q")] };
  const right: Expression = { kind: "product", args: [num("2"), sym("x", "q")] };
  const result = spotCheckEquivalence(left, right, ["x"], 7n, DEFAULT_SPOT_CHECK_TOLERANCE);
  assert.equal(result.ok, true);
  assert.equal(result.kind, "within");
});

test("spotCheckEquivalence reports disagreement for genuinely different expressions", () => {
  const left: Expression = sym("x", "q");
  const right: Expression = { kind: "product", args: [num("2"), sym("x", "q")] };
  const result = spotCheckEquivalence(left, right, ["x"], 7n, DEFAULT_SPOT_CHECK_TOLERANCE);
  assert.equal(result.ok, false);
  assert.equal(result.kind, "outside");
});

test("an outside-domain sample is redrawn up to a bounded count and then reported, never counted as agreement", () => {
  // ln(x - 10) with x sampled in [0.5, 5] is always out of domain for this evaluator's default range.
  const left: Expression = {
    kind: "function",
    name: "ln",
    argument: { kind: "sum", args: [sym("x", "q"), num("-10")] },
  };
  const right: Expression = num("0");
  const result = spotCheckEquivalence(left, right, ["x"], 99n, DEFAULT_SPOT_CHECK_TOLERANCE);
  assert.equal(result.ok, false);
  assert.equal(result.kind, "outside-domain");
  assert.equal(result.attempts, 8);
});
