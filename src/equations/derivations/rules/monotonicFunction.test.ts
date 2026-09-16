import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../../ast.ts";
import { monotonicFunctionRule } from "./monotonicFunction.ts";

const sym = (termId: string, quantityId: string): Expression => ({
  kind: "symbol",
  termId,
  quantityId,
});

const FROM: Expression = {
  kind: "relation",
  operator: "=",
  left: { kind: "power", base: sym("lambda", "q"), exponent: { num: 2, den: 1 } },
  right: sym("twoDt", "q"),
};

test("monotonic-function (square root, positive branch) passes with a branch condition and produces the expected relation", () => {
  const to: Expression = {
    kind: "relation",
    operator: "=",
    left: {
      kind: "root",
      radicand: { kind: "power", base: sym("lambda", "q"), exponent: { num: 2, den: 1 } },
      degree: 2,
    },
    right: { kind: "root", radicand: sym("twoDt", "q"), degree: 2 },
  };
  const result = monotonicFunctionRule.check({
    from: FROM,
    to,
    params: {
      function: "square-root",
      domain: "twoDt >= 0",
      branch: "positive",
      branchCondition: "lambda is a physical distance, taken nonnegative",
    },
  });
  assert.equal(result.outcome, "pass");
});

test("a square root without a branch condition fails", () => {
  const result = monotonicFunctionRule.check({
    from: FROM,
    to: FROM,
    params: { function: "square-root", domain: "twoDt >= 0" },
  });
  assert.equal(result.outcome, "fail");
  assert.match(result.reason ?? "", /branch/);
});

test("a square root without a domain fails", () => {
  const result = monotonicFunctionRule.check({
    from: FROM,
    to: FROM,
    params: { function: "square-root", branch: "positive", branchCondition: "continuity" },
  });
  assert.equal(result.outcome, "fail");
  assert.match(result.reason ?? "", /domain/);
});

test("monotonic-function fails when to does not match applying the function to both sides", () => {
  const result = monotonicFunctionRule.check({
    from: FROM,
    to: FROM, // unchanged: wrong
    params: {
      function: "square-root",
      domain: "twoDt >= 0",
      branch: "positive",
      branchCondition: "continuity",
    },
  });
  assert.equal(result.outcome, "fail");
});
