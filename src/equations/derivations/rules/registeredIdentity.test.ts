import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../../ast.ts";
import { registeredIdentityRule } from "./registeredIdentity.ts";

const sym = (termId: string, quantityId: string): Expression => ({
  kind: "symbol",
  termId,
  quantityId,
});

test("an unregistered identity id fails", () => {
  const result = registeredIdentityRule.check({
    from: sym("a", "q"),
    to: sym("a", "q"),
    params: { identityId: "not-a-real-identity", premises: ["x"] },
  });
  assert.equal(result.outcome, "fail");
});

test("a registered identity with no cited premises fails", () => {
  const result = registeredIdentityRule.check({
    from: sym("a", "q"),
    to: sym("a", "q"),
    params: { identityId: "linearity-of-average", premises: [] },
  });
  assert.equal(result.outcome, "fail");
  assert.match(result.reason ?? "", /premise/);
});

test("linearity-of-average passes when to is the term-by-term average of from's summands", () => {
  const from: Expression = {
    kind: "average",
    argument: { kind: "sum", args: [sym("a", "q"), sym("b", "q")] },
  };
  const to: Expression = {
    kind: "sum",
    args: [
      { kind: "average", argument: sym("a", "q") },
      { kind: "average", argument: sym("b", "q") },
    ],
  };
  const result = registeredIdentityRule.check({
    from,
    to,
    params: { identityId: "linearity-of-average", premises: ["linearity"] },
  });
  assert.equal(result.outcome, "pass");
});

test("independent-zero-mean-product-vanishes removes exactly the cited cross terms", () => {
  // from = sum(a1^2 [op a1sq], a2^2 [op a2sq], cross [op cross]); to = sum(a1sq, a2sq).
  const a1sq: Expression = { kind: "group", opId: "s.op.a1sq", argument: sym("a1", "q") };
  const a2sq: Expression = { kind: "group", opId: "s.op.a2sq", argument: sym("a2", "q") };
  const cross: Expression = { kind: "group", opId: "s.op.cross", argument: sym("cross", "q") };
  const from: Expression = { kind: "sum", args: [a1sq, a2sq, cross] };
  const to: Expression = { kind: "sum", args: [a1sq, a2sq] };
  const result = registeredIdentityRule.check({
    from,
    to,
    params: {
      identityId: "independent-zero-mean-product-vanishes",
      premises: ["independence", "zero-mean"],
      vanishingTermIds: ["s.op.cross"],
    },
  });
  assert.equal(result.outcome, "pass");
});

test("independent-zero-mean-product-vanishes fails when to keeps a term that was supposed to vanish", () => {
  const a1sq: Expression = { kind: "group", opId: "s.op.a1sq", argument: sym("a1", "q") };
  const cross: Expression = { kind: "group", opId: "s.op.cross", argument: sym("cross", "q") };
  const from: Expression = { kind: "sum", args: [a1sq, cross] };
  const result = registeredIdentityRule.check({
    from,
    to: from, // cross term still present: wrong
    params: {
      identityId: "independent-zero-mean-product-vanishes",
      premises: ["independence", "zero-mean"],
      vanishingTermIds: ["s.op.cross"],
    },
  });
  assert.equal(result.outcome, "fail");
});

test("independent-zero-mean-product-vanishes requires vanishingTermIds", () => {
  const result = registeredIdentityRule.check({
    from: { kind: "sum", args: [sym("a", "q"), sym("b", "q")] },
    to: sym("a", "q"),
    params: { identityId: "independent-zero-mean-product-vanishes", premises: ["independence"] },
  });
  assert.equal(result.outcome, "fail");
  assert.match(result.reason ?? "", /vanishing term ids/);
});

test("kernel-normalization is checked only for its cited premise today and reports unverifiable", () => {
  const result = registeredIdentityRule.check({
    from: sym("a", "q"),
    to: sym("b", "q"),
    params: { identityId: "kernel-normalization", premises: ["kernel is a probability density"] },
  });
  assert.equal(result.outcome, "unverifiable");
});

/**
 * THE FOUR IDENTITIES THAT USED TO PASS ANYTHING (am-1lds).
 *
 * `kernel-normalization` inside a sum, `odd-moments-symmetric-kernel`, `spatial-isotropy` and the
 * fall-through of `linearity-of-average` each returned `pass` without reading the step, so a step
 * whose result equalled its own input was credited `verified`. Each now has a structural check,
 * and each is planted here in both directions: the licensed step passes, and a result the identity
 * does not license is refused.
 *
 * The licensed shapes are the ones the corpus uses, taken from the real steps rather than invented:
 * bm-src-step-3 (an integral set to 1 inside a sum), bm-src-step-4 (an odd moment set to 0),
 * sr-ped-step-4 (a coefficient replaced by its mirror) and bm-ped-step-2 (the average taken of both
 * sides of a relation).
 */
const prod = (...args: Expression[]): Expression => ({ kind: "product", args });
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const avg = (argument: Expression): Expression => ({ kind: "average", argument });
const rel = (left: Expression, right: Expression): Expression => ({
  kind: "relation",
  operator: "=",
  left,
  right,
});

/**
 * `changed` is the step's own `changedSubexpressionIds`, which verifyChain passes and which the
 * substitution checks read: the identity must verify the node the step DECLARED it changed, not
 * whichever node happens to disappear. The plants below pass it exactly as a step would.
 */
const identity = (
  identityId: string,
  from: Expression,
  to: Expression,
  changed: readonly string[] = [],
) =>
  registeredIdentityRule.check({
    from,
    to,
    params: { identityId, premises: ["premise-x"] },
    changed,
  });

test("kernel-normalization inside a sum: the integral set to 1 passes, and anything else does not", () => {
  const f = sym("f", "f");
  const dfdx = sym("df_dx", "df_dx");
  const intPhi = sym("int_phi", "int_phi");
  const intDeltaPhi = sym("int_Delta_phi", "int_Delta_phi");
  const from = sum(prod(f, intPhi), prod(dfdx, intDeltaPhi));
  const declared = ["int_phi"];

  assert.equal(
    identity("kernel-normalization", from, sum(f, prod(dfdx, intDeltaPhi)), declared).outcome,
    "pass",
  );
  // The step's own input as its result: the shape that used to pass.
  assert.equal(identity("kernel-normalization", from, from, declared).outcome, "unverifiable");
  // The integral set to something other than 1.
  const toTwo = sum(prod(f, { kind: "number", value: "2" }), prod(dfdx, intDeltaPhi));
  assert.equal(identity("kernel-normalization", from, toTwo, declared).outcome, "unverifiable");
  // The normalisation applied AND a second term quietly changed.
  assert.equal(
    identity("kernel-normalization", from, sum(f, dfdx), declared).outcome,
    "unverifiable",
  );
});

test("odd-moments-symmetric-kernel: the moment set to 0 passes, and the declaration is load-bearing", () => {
  const f = sym("f", "f");
  const dfdx = sym("df_dx", "df_dx");
  const intDeltaPhi = sym("int_Delta_phi", "int_Delta_phi");
  const from = sum(f, prod(dfdx, intDeltaPhi));
  const declared = ["int_Delta_phi"];

  assert.equal(identity("odd-moments-symmetric-kernel", from, f, declared).outcome, "pass");
  assert.equal(
    identity("odd-moments-symmetric-kernel", from, from, declared).outcome,
    "unverifiable",
  );
  // Dropping the term that is NOT the odd moment.
  assert.equal(
    identity("odd-moments-symmetric-kernel", from, prod(dfdx, intDeltaPhi), declared).outcome,
    "unverifiable",
  );
  // THE RESIDUE, asserted rather than hidden. The check reads the step's declaration and the
  // algebra; it does not know WHICH symbol is an odd moment of a symmetric kernel. A step that
  // declared `f` and printed the other term would satisfy it, because zeroing `f` does give that
  // result. What the check does establish is that the step's result follows from setting the one
  // thing it says it changed to zero, which is what the blind version could not tell at all.
  assert.equal(
    identity("odd-moments-symmetric-kernel", from, prod(dfdx, intDeltaPhi), ["f"]).outcome,
    "pass",
  );
  // And a step that declares nothing cannot be checked this way, which is the honest answer
  // rather than a pass.
  assert.equal(identity("odd-moments-symmetric-kernel", from, f, []).outcome, "unverifiable");
});

test("spatial-isotropy: a coefficient replaced by its mirror passes, an unrelated symbol does not", () => {
  const aV = sym("a_v", "a_v");
  const aMinusV = sym("a_minus_v", "a_minus_v");
  const bracket = sym("one_minus_beta2", "one_minus_beta2");
  const one: Expression = { kind: "number", value: "1" };
  const from = rel(prod(aV, aMinusV, bracket), one);
  const declared = ["a_minus_v"];

  assert.equal(
    identity("spatial-isotropy", from, rel(prod(aV, aV, bracket), one), declared).outcome,
    "pass",
  );
  assert.equal(identity("spatial-isotropy", from, from, declared).outcome, "unverifiable");
  // A replacement that is not the mirror: the coefficient swapped for the bracket.
  assert.equal(
    identity("spatial-isotropy", from, rel(prod(aV, bracket, bracket), one), declared).outcome,
    "unverifiable",
  );
});

test("linearity-of-average: both licensed forms pass, and a changed term does not", () => {
  const a = sym("A", "stepA");
  const b = sym("B", "stepB");

  // Form one, the identity itself.
  assert.equal(
    identity("linearity-of-average", avg(sum(a, b)), sum(avg(a), avg(b))).outcome,
    "pass",
  );
  // Form two, the average taken of both sides of a relation.
  const x2 = sym("x2", "x2");
  assert.equal(
    identity("linearity-of-average", rel(x2, prod(a, b)), rel(avg(x2), avg(prod(a, b)))).outcome,
    "pass",
  );
  // The result equal to the input, which used to pass.
  assert.equal(
    identity("linearity-of-average", avg(sum(a, b)), avg(sum(a, b))).outcome,
    "unverifiable",
  );
  // The averages taken and one term quietly replaced.
  assert.equal(
    identity("linearity-of-average", avg(sum(a, b)), sum(avg(a), avg(a))).outcome,
    "unverifiable",
  );
});
