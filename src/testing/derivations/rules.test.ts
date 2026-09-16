import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../../equations/ast.ts";
import {
  getRule,
  RULE_NAME_MAPPING,
  ruleLibrary,
} from "../../equations/derivations/rules/index.ts";

const sym = (termId: string): Expression => ({ kind: "symbol", termId, quantityId: termId });
const num = (value: string): Expression => ({ kind: "number", value });
const rel = (operator: "=" | "approx", left: Expression, right: Expression): Expression => ({
  kind: "relation",
  operator,
  left,
  right,
});

test("rule library exports all required rules and mappings", () => {
  assert.ok(ruleLibrary.length >= 6, "ruleLibrary should contain at least 6 rules");
  assert.equal(RULE_NAME_MAPPING.substitute, "substitute");
  assert.equal(RULE_NAME_MAPPING["expand to stated order"], "truncate-series");
  assert.equal(RULE_NAME_MAPPING["cancel with stated reason"], "cancel-common-factor");
  assert.equal(RULE_NAME_MAPPING["apply symmetry"], "registered-identity");
  assert.equal(RULE_NAME_MAPPING["apply normalization"], "registered-identity");
  assert.equal(RULE_NAME_MAPPING.integrate, "integrate");
  assert.equal(RULE_NAME_MAPPING["take square root"], "monotonic-function");
});

test("substitute rule: positive and negative checks", () => {
  const rule = getRule("substitute");
  assert.ok(rule);

  // Positive
  const from = sym("x");
  const to = sym("y");
  const posResult = rule.check({
    from,
    to,
    params: { targetId: "x", replacement: sym("y"), citedEquality: "x = y" },
  });
  assert.equal(posResult.outcome, "pass");

  // Missing cited equality
  const noCite = rule.check({
    from,
    to,
    params: { targetId: "x", replacement: sym("y"), citedEquality: "" },
  });
  assert.equal(noCite.outcome, "fail");
  assert.match(noCite.reason ?? "", /citedEquality/);

  // Missing target id
  const noTarget = rule.check({
    from,
    to,
    params: { targetId: "", replacement: sym("y"), citedEquality: "x = y" },
  });
  assert.equal(noTarget.outcome, "fail");

  // Mismatched substitution
  const mismatch = rule.check({
    from,
    to: sym("z"),
    params: { targetId: "x", replacement: sym("y"), citedEquality: "x = y" },
  });
  assert.equal(mismatch.outcome, "fail");
});

test("cancel-common-factor rule: positive and side-condition checks", () => {
  const rule = getRule("cancel-common-factor");
  assert.ok(rule);

  const from: Expression = {
    kind: "quotient",
    numerator: { kind: "product", args: [sym("a"), sym("b")] },
    denominator: { kind: "product", args: [sym("a"), sym("c")] },
  };
  const to: Expression = {
    kind: "quotient",
    numerator: sym("b"),
    denominator: sym("c"),
  };

  // Positive
  const pos = rule.check({
    from,
    to,
    params: { factor: sym("a"), nonzeroCondition: "a !== 0" },
  });
  assert.equal(pos.outcome, "pass");

  // Missing nonzeroCondition
  const noCond = rule.check({
    from,
    to,
    params: { factor: sym("a"), nonzeroCondition: "" },
  });
  assert.equal(noCond.outcome, "fail");
  assert.match(noCond.reason ?? "", /nonzeroCondition/);

  // Factor not present in both
  const noFactor = rule.check({
    from,
    to,
    params: { factor: sym("z"), nonzeroCondition: "z !== 0" },
  });
  assert.equal(noFactor.outcome, "fail");
});

test("monotonic-function rule: square root branch and domain checks", () => {
  const rule = getRule("monotonic-function");
  assert.ok(rule);

  const from = rel("=", sym("x2"), sym("4"));
  const to = rel(
    "=",
    { kind: "root", radicand: sym("x2"), degree: 2 },
    { kind: "root", radicand: sym("4"), degree: 2 },
  );

  // Positive
  const pos = rule.check({
    from,
    to,
    params: {
      function: "square-root",
      domain: "x >= 0",
      branch: "positive",
      branchCondition: "physical displacement is non-negative",
    },
  });
  assert.equal(pos.outcome, "pass");

  // Missing domain
  const noDomain = rule.check({
    from,
    to,
    params: {
      function: "square-root",
      domain: "",
      branch: "positive",
      branchCondition: "x >= 0",
    },
  });
  assert.equal(noDomain.outcome, "fail");

  // Missing branch
  const noBranch = rule.check({
    from,
    to,
    params: {
      function: "square-root",
      domain: "x >= 0",
      branchCondition: "x >= 0",
    },
  });
  assert.equal(noBranch.outcome, "fail");
  assert.match(noBranch.reason ?? "", /branch/);

  // Missing branch condition
  const noBranchCond = rule.check({
    from,
    to,
    params: {
      function: "square-root",
      domain: "x >= 0",
      branch: "positive",
      branchCondition: "",
    },
  });
  assert.equal(noBranchCond.outcome, "fail");
  assert.match(noBranchCond.reason ?? "", /condition/);
});

test("integrate rule: integration constant and boundary condition checks", () => {
  const rule = getRule("integrate");
  assert.ok(rule);

  const from = sym("df_dx");
  const toWithConst = { kind: "sum", args: [sym("f"), sym("C")] } as Expression;

  // Positive with constant appearing in to
  const withConst = rule.check({
    from,
    to: toWithConst,
    params: { variable: "x", integrationConstant: "C" },
  });
  assert.equal(withConst.outcome, "unverifiable");

  // Positive with boundary condition
  const withBc = rule.check({
    from,
    to: sym("f"),
    params: { variable: "x", boundaryCondition: "f(0) = 0" },
  });
  assert.equal(withBc.outcome, "unverifiable");

  // Missing both constant and boundary condition -> fails
  const missingBoth = rule.check({
    from,
    to: sym("f"),
    params: { variable: "x" },
  });
  assert.equal(missingBoth.outcome, "fail");
  assert.match(missingBoth.reason ?? "", /constant or cite the boundary condition/);

  // Named constant not in to -> fails
  const constNotInTo = rule.check({
    from,
    to: sym("f"),
    params: { variable: "x", integrationConstant: "C_absent" },
  });
  assert.equal(constNotInTo.outcome, "fail");
});

test("truncate-series rule: variable, order, domain, neglected checks", () => {
  const rule = getRule("truncate-series");
  assert.ok(rule);

  const from = sym("exp_x");
  const to = sym("1_plus_x");

  // Positive
  const pos = rule.check({
    from,
    to,
    params: { variable: "x", order: 1, domain: "x << 1", neglected: "O(x^2)" },
  });
  assert.equal(pos.outcome, "unverifiable");

  // Missing domain
  const noDomain = rule.check({
    from,
    to,
    params: { variable: "x", order: 1, domain: "", neglected: "O(x^2)" },
  });
  assert.equal(noDomain.outcome, "fail");

  // Missing neglected
  const noNeglected = rule.check({
    from,
    to,
    params: { variable: "x", order: 1, domain: "x << 1", neglected: "" },
  });
  assert.equal(noNeglected.outcome, "fail");
});

test("registered-identity rule: check identities and premise requirements", () => {
  const rule = getRule("registered-identity");
  assert.ok(rule);

  // Kernel normalization
  const posNorm = rule.check({
    from: sym("int_phi"),
    to: num("1"),
    params: { identityId: "kernel-normalization" },
  });
  assert.equal(posNorm.outcome, "pass");

  // Independent zero-mean product requires cited premises
  const posIndep = rule.check({
    from: sym("cross_term"),
    to: num("0"),
    params: {
      identityId: "independent-zero-mean-product-vanishes",
      citedPremises: ["premise-independence", "premise-zero-mean"],
    },
  });
  assert.equal(posIndep.outcome, "pass");

  // Missing cited premises for independent zero-mean product
  const failIndep = rule.check({
    from: sym("cross_term"),
    to: num("0"),
    params: {
      identityId: "independent-zero-mean-product-vanishes",
      citedPremises: [],
    },
  });
  assert.equal(failIndep.outcome, "fail");
  assert.match(failIndep.reason ?? "", /independence and zero-mean premises/);
});

test("add-subtract-multiply-divide rule: checks division nonzero condition", () => {
  const rule = getRule("add-subtract-multiply-divide");
  assert.ok(rule);

  const from = rel("=", sym("a"), sym("b"));
  const to = rel("=", sym("a_div_c"), sym("b_div_c"));

  // Division with nonzero condition -> pass
  const posDiv = rule.check({
    from,
    to,
    params: { operation: "divide", quantity: sym("c"), nonzeroCondition: "c !== 0" },
  });
  assert.equal(posDiv.outcome, "pass");

  // Division without nonzero condition -> fail
  const failDiv = rule.check({
    from,
    to,
    params: { operation: "divide", quantity: sym("c") },
  });
  assert.equal(failDiv.outcome, "fail");
  assert.match(failDiv.reason ?? "", /nonzeroCondition/);
});
