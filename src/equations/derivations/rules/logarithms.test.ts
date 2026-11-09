import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../../ast.ts";
import { monotonicFunctionRule } from "./monotonicFunction.ts";
import { registeredIdentityRule } from "./registeredIdentity.ts";

const x: Expression = { kind: "symbol", termId: "x", quantityId: "dimensionlessRatio" };
const y: Expression = { kind: "symbol", termId: "y", quantityId: "dimensionlessRatio" };
const exp: Expression = { kind: "function", name: "exp", argument: x };
const equation: Expression = { kind: "relation", operator: "=", left: y, right: exp };
const logged: Expression = {
  kind: "relation",
  operator: "=",
  left: { kind: "function", name: "ln", argument: y },
  right: { kind: "function", name: "ln", opId: "log-exponential", argument: exp },
};
const inverted: Expression = { ...logged, right: x };
const positive = {
  function: "ln",
  domain: "real x and strictly positive y",
  positiveArguments: { left: "y > 0", right: "exp(x) > 0 for every real x" },
};

test("taking the logarithm of both positive sides preserves the exact equation", () => {
  assert.equal(
    monotonicFunctionRule.check({ from: equation, to: logged, params: positive }).outcome,
    "pass",
  );
  const simplified = registeredIdentityRule.check({
    from: logged,
    to: inverted,
    params: { identityId: "log-exp-inverse", targetId: "log-exponential" },
  });
  assert.equal(simplified.outcome, "pass");
});

test("a logarithm needs both positivity obligations and the domain", () => {
  for (const params of [
    { function: "ln", domain: positive.domain },
    { ...positive, positiveArguments: { left: "", right: "exp(x) > 0" } },
    { ...positive, positiveArguments: { left: "y > 0", right: "" } },
    { ...positive, domain: "" },
  ]) {
    assert.equal(
      monotonicFunctionRule.check({ from: equation, to: logged, params }).outcome,
      "fail",
    );
  }
});

test("the logarithm rule rejects one-sided logs, changed signs, and a no-op", () => {
  for (const to of [
    { ...equation, left: logged.left },
    { ...logged, right: { kind: "negate", argument: logged.right } },
    equation,
  ] as Expression[]) {
    assert.equal(
      monotonicFunctionRule.check({ from: equation, to, params: positive }).outcome,
      "fail",
    );
  }
});

test("log-exp inversion only removes the declared exact pair and preserves the other side", () => {
  const params = { identityId: "log-exp-inverse", targetId: "log-exponential" };
  for (const to of [
    logged,
    { ...inverted, left: x },
    { ...inverted, right: { kind: "negate", argument: x } },
  ] as Expression[]) {
    assert.equal(registeredIdentityRule.check({ from: logged, to, params }).outcome, "fail");
  }
  for (const targetId of ["", "absent-node", "x"]) {
    assert.equal(
      registeredIdentityRule.check({
        from: logged,
        to: inverted,
        params: { ...params, targetId },
      }).outcome,
      "fail",
    );
  }
});

test("exp(ln(x)) and ln of a non-exponential are not admitted by this identity", () => {
  for (const candidate of [
    { kind: "function", name: "exp", argument: { kind: "function", name: "ln", argument: x } },
    { kind: "function", name: "ln", argument: x },
  ] as Expression[]) {
    const from = { ...candidate, opId: "candidate" } as Expression;
    assert.equal(
      registeredIdentityRule.check({
        from,
        to: x,
        params: { identityId: "log-exp-inverse", targetId: "candidate" },
      }).outcome,
      "fail",
    );
  }
});
