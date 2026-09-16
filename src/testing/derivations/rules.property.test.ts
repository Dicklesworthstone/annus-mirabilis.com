import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../../equations/ast.ts";
import { getRule } from "../../equations/derivations/rules/index.ts";
import type { RuleCheckResult } from "../../equations/derivations/rules/types.ts";
import {
  evaluateExpression,
  sampleAdmissiblePoint,
} from "../../equations/derivations/spotCheck.ts";
import { withinTolerance } from "../../units/tolerance.ts";

const sym = (termId: string): Expression => ({ kind: "symbol", termId, quantityId: termId });
const num = (value: string): Expression => ({ kind: "number", value });

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("rules.property.test: 300 seeded tests for expand, collect, factor, and reorder", () => {
  const expandRule = getRule("expand");
  const collectRule = getRule("collect");
  const factorRule = getRule("factor");
  const reorderRule = getRule("reorder");

  assert.ok(expandRule && collectRule && factorRule && reorderRule);

  const baseSeed = 8675309;
  const rand = mulberry32(baseSeed);

  for (let i = 0; i < 300; i++) {
    const seedDecimal = String(baseSeed + i * 10007);
    const aVal = Math.floor(rand() * 5) + 1;
    const bVal = Math.floor(rand() * 5) + 1;

    // 1. Expand property test: (a*x + b)^2 = a^2*x^2 + 2*a*b*x + b^2
    const expandFrom: Expression = {
      kind: "power",
      base: {
        kind: "sum",
        args: [{ kind: "product", args: [num(String(aVal)), sym("x")] }, num(String(bVal))],
      },
      exponent: { num: 2, den: 1 },
    };

    const expandTo: Expression = {
      kind: "sum",
      args: [
        {
          kind: "product",
          args: [
            num(String(aVal * aVal)),
            { kind: "power", base: sym("x"), exponent: { num: 2, den: 1 } },
          ],
        },
        {
          kind: "product",
          args: [num(String(2 * aVal * bVal)), sym("x")],
        },
        num(String(bVal * bVal)),
      ],
    };

    const expandPerturbed: Expression = {
      kind: "sum",
      args: [
        {
          kind: "product",
          args: [
            num(String(aVal * aVal)),
            { kind: "power", base: sym("x"), exponent: { num: 2, den: 1 } },
          ],
        },
        {
          kind: "product",
          args: [num(String(2 * aVal * bVal + 1)), sym("x")], // perturbed coefficient
        },
        num(String(bVal * bVal)),
      ],
    };

    const expandPass: RuleCheckResult = expandRule.check({
      from: expandFrom,
      to: expandTo,
      params: { seed: BigInt(seedDecimal) },
    });
    assert.equal(expandPass.outcome, "pass", `expand should pass for seed ${seedDecimal}`);

    const expandFail: RuleCheckResult = expandRule.check({
      from: expandFrom,
      to: expandPerturbed,
      params: { seed: BigInt(seedDecimal) },
    });
    assert.equal(
      expandFail.outcome,
      "fail",
      `expand should reject perturbation for seed ${seedDecimal}`,
    );

    // Spot-check numerical equivalence directly with withinTolerance
    const pt = sampleAdmissiblePoint(["x"], BigInt(seedDecimal));
    const valFrom = evaluateExpression(expandFrom, pt.bindings);
    const valTo = evaluateExpression(expandTo, pt.bindings);
    const verdict = withinTolerance(valFrom, valTo, { relative: 1e-10, absolute: 1e-12 });
    assert.ok(verdict.ok, `evaluation at seed ${seedDecimal} within tolerance`);

    // 2. Reorder property test: a*x + b*y + c*z permuted
    const term0: Expression = {
      kind: "product",
      args: [num(String(aVal)), sym("x")],
    };
    const term1: Expression = {
      kind: "product",
      args: [num(String(bVal)), sym("y")],
    };
    const term2: Expression = num(String(aVal + bVal));

    const reorderFrom: Expression = { kind: "sum", args: [term0, term1, term2] };
    const reorderTo: Expression = { kind: "sum", args: [term2, term0, term1] };
    const reorderPerturbed: Expression = {
      kind: "sum",
      args: [term2, { kind: "product", args: [num(String(bVal + 1)), sym("y")] }, term0],
    };

    const reorderPass: RuleCheckResult = reorderRule.check({
      from: reorderFrom,
      to: reorderTo,
      params: {},
    });
    assert.equal(reorderPass.outcome, "pass", `reorder should pass for seed ${seedDecimal}`);

    const reorderFail: RuleCheckResult = reorderRule.check({
      from: reorderFrom,
      to: reorderPerturbed,
      params: {},
    });
    assert.equal(
      reorderFail.outcome,
      "fail",
      `reorder should reject perturbation for seed ${seedDecimal}`,
    );

    // 3. Collect property test: a*x + b*x = (a+b)*x
    const collectFrom: Expression = {
      kind: "sum",
      args: [
        { kind: "product", args: [num(String(aVal)), sym("x")] },
        { kind: "product", args: [num(String(bVal)), sym("x")] },
      ],
    };
    const collectTo: Expression = {
      kind: "product",
      args: [num(String(aVal + bVal)), sym("x")],
    };
    const collectPerturbed: Expression = {
      kind: "product",
      args: [num(String(aVal + bVal + 1)), sym("x")],
    };

    const collectPass: RuleCheckResult = collectRule.check({
      from: collectFrom,
      to: collectTo,
      params: { seed: BigInt(seedDecimal) },
    });
    assert.equal(collectPass.outcome, "pass", `collect should pass for seed ${seedDecimal}`);

    const collectFail: RuleCheckResult = collectRule.check({
      from: collectFrom,
      to: collectPerturbed,
      params: { seed: BigInt(seedDecimal) },
    });
    assert.equal(
      collectFail.outcome,
      "fail",
      `collect should reject perturbation for seed ${seedDecimal}`,
    );

    // 4. Factor property test: a*x^2 + a*x = a*(x^2 + x)
    const factorFrom: Expression = {
      kind: "sum",
      args: [
        {
          kind: "product",
          args: [
            num(String(aVal)),
            { kind: "power", base: sym("x"), exponent: { num: 2, den: 1 } },
          ],
        },
        { kind: "product", args: [num(String(aVal)), sym("x")] },
      ],
    };
    const factorTo: Expression = {
      kind: "product",
      args: [
        num(String(aVal)),
        {
          kind: "sum",
          args: [{ kind: "power", base: sym("x"), exponent: { num: 2, den: 1 } }, sym("x")],
        },
      ],
    };
    const factorPerturbed: Expression = {
      kind: "product",
      args: [
        num(String(aVal)),
        {
          kind: "sum",
          args: [{ kind: "power", base: sym("x"), exponent: { num: 2, den: 1 } }, num("1")],
        },
      ],
    };

    const factorPass: RuleCheckResult = factorRule.check({
      from: factorFrom,
      to: factorTo,
      params: { seed: BigInt(seedDecimal) },
    });
    assert.equal(factorPass.outcome, "pass", `factor should pass for seed ${seedDecimal}`);

    const factorFail: RuleCheckResult = factorRule.check({
      from: factorFrom,
      to: factorPerturbed,
      params: { seed: BigInt(seedDecimal) },
    });
    assert.equal(
      factorFail.outcome,
      "fail",
      `factor should reject perturbation for seed ${seedDecimal}`,
    );
  }
});
