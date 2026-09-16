import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../../ast.ts";
import { substituteRule } from "./substitute.ts";

const sym = (termId: string, quantityId: string): Expression => ({
  kind: "symbol",
  termId,
  quantityId,
});
const num = (value: string): Expression => ({ kind: "number", value });

test("substitute passes when to equals from with the target replaced under a cited equality", () => {
  const from: Expression = { kind: "sum", args: [sym("t", "q"), num("1")] };
  const to: Expression = {
    kind: "sum",
    args: [{ kind: "product", args: [sym("n", "q"), sym("tau", "q")] }, num("1")],
  };
  const result = substituteRule.check({
    from,
    to,
    params: {
      targetId: "t",
      replacement: { kind: "product", args: [sym("n", "q"), sym("tau", "q")] },
      citedEquality: "t = n*tau",
    },
  });
  assert.equal(result.outcome, "pass");
});

test("substitute fails without a citedEquality", () => {
  const from: Expression = sym("t", "q");
  const result = substituteRule.check({
    from,
    to: num("1"),
    params: { targetId: "t", replacement: num("1"), citedEquality: "" },
  });
  assert.equal(result.outcome, "fail");
  assert.match(result.reason ?? "", /citedEquality/);
});

test("substitute fails when to does not match the expected substitution", () => {
  const from: Expression = sym("t", "q");
  const result = substituteRule.check({
    from,
    to: num("999"),
    params: { targetId: "t", replacement: num("1"), citedEquality: "t = 1" },
  });
  assert.equal(result.outcome, "fail");
});
