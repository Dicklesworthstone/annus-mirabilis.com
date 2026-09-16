import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../../ast.ts";
import { cancelCommonFactorRule } from "./cancelCommonFactor.ts";

const sym = (termId: string, quantityId: string): Expression => ({
  kind: "symbol",
  termId,
  quantityId,
});

test("cancel-common-factor passes when the cited factor is removed from both numerator and denominator", () => {
  const c = sym("c", "q");
  const from: Expression = {
    kind: "quotient",
    numerator: { kind: "product", args: [sym("a", "q"), c] },
    denominator: { kind: "product", args: [sym("b", "q"), c] },
  };
  const to: Expression = { kind: "quotient", numerator: sym("a", "q"), denominator: sym("b", "q") };
  const result = cancelCommonFactorRule.check({
    from,
    to,
    params: { factor: c, nonzeroCondition: "c != 0" },
  });
  assert.equal(result.outcome, "pass");
});

test("cancel-common-factor fails without a nonzeroCondition, recording it as a required side condition", () => {
  const c = sym("c", "q");
  const from: Expression = {
    kind: "quotient",
    numerator: { kind: "product", args: [sym("a", "q"), c] },
    denominator: { kind: "product", args: [sym("b", "q"), c] },
  };
  const to: Expression = { kind: "quotient", numerator: sym("a", "q"), denominator: sym("b", "q") };
  const result = cancelCommonFactorRule.check({
    from,
    to,
    params: { factor: c, nonzeroCondition: "" },
  });
  assert.equal(result.outcome, "fail");
  assert.match(result.reason ?? "", /nonzeroCondition/);
});

test("cancel-common-factor fails when the cited factor is not present in both sides (division by a possibly-absent factor)", () => {
  const c = sym("c", "q");
  const d = sym("d", "q");
  const from: Expression = {
    kind: "quotient",
    numerator: { kind: "product", args: [sym("a", "q"), c] },
    denominator: { kind: "product", args: [sym("b", "q"), d] },
  };
  const result = cancelCommonFactorRule.check({
    from,
    to: { kind: "quotient", numerator: sym("a", "q"), denominator: sym("b", "q") },
    params: { factor: c, nonzeroCondition: "c != 0" },
  });
  assert.equal(result.outcome, "fail");
});

test("cancel-common-factor fails when from is not a quotient", () => {
  const result = cancelCommonFactorRule.check({
    from: sym("a", "q"),
    to: sym("a", "q"),
    params: { factor: sym("a", "q"), nonzeroCondition: "a != 0" },
  });
  assert.equal(result.outcome, "fail");
});
