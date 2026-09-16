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
