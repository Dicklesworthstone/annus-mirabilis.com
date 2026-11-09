import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../ast.ts";
import { expressionToSpokenText } from "./a11yText.ts";
import { expressionToDerivationLatex, renderExpressionMarkup } from "./mathRenderer.ts";

const time: Expression = { kind: "symbol", termId: "τ", quantityId: "movingTime" };
const operator: Expression = {
  kind: "partialOperator",
  opId: "sr-field-test.op.time",
  variable: time,
};

test("a partial operator renders its variable and retains its independent operation identity", () => {
  assert.equal(expressionToDerivationLatex(operator), "\\frac{\\partial}{\\partial τ}");
  assert.equal(
    expressionToDerivationLatex(operator, new Set(["sr-field-test.op.time"])),
    "\\mathbf{\\frac{\\partial}{\\partial τ}}",
  );
  const { html, plainLatex } = renderExpressionMarkup(operator);
  assert.ok(html.includes("<math"));
  assert.ok(html.includes("<mfrac>"));
  assert.ok(!html.includes("katex-error"));
  assert.ok(!plainLatex.includes("\\dots"));
});

test("operator sums and scalar products preserve every derivative in the chain rule", () => {
  const identity: Expression = {
    kind: "relation",
    operator: "=",
    left: {
      kind: "partialOperator",
      variable: { kind: "symbol", termId: "t", quantityId: "stationaryTime" },
    },
    right: {
      kind: "product",
      args: [
        { kind: "symbol", termId: "β", quantityId: "lorentzFactor" },
        {
          kind: "sum",
          args: [
            operator,
            {
              kind: "negate",
              argument: {
                kind: "product",
                args: [
                  { kind: "symbol", termId: "v", quantityId: "frameSpeed" },
                  {
                    kind: "partialOperator",
                    variable: { kind: "symbol", termId: "ξ", quantityId: "movingPosition" },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  };
  const { html, plainLatex } = renderExpressionMarkup(identity);
  for (const variable of ["t", "τ", "ξ"]) {
    assert.ok(plainLatex.includes(`\\frac{\\partial}{\\partial ${variable}}`));
  }
  assert.ok(html.includes("<math"));
  assert.ok(!html.includes("katex-error"));
  assert.ok(!plainLatex.includes("\\dots"));
  const spoken = expressionToSpokenText(identity);
  assert.ok(spoken.includes("partial derivative with respect to t equals"));
  assert.ok(spoken.includes("partial derivative with respect to τ"));
  assert.ok(spoken.includes("partial derivative with respect to ξ"));
  assert.ok(!spoken.includes("\\"));
});

test("a partial operator stays distinct from a derivative of a field", () => {
  const derivative: Expression = {
    kind: "derivative",
    expression: { kind: "symbol", termId: "X", quantityId: "electricFieldStationary" },
    variable: time,
    order: 1,
    partial: true,
  };
  assert.notEqual(expressionToDerivationLatex(operator), expressionToDerivationLatex(derivative));
  assert.equal(expressionToSpokenText(operator), "partial derivative with respect to τ");
  assert.equal(expressionToSpokenText(derivative), "partial derivative of X with respect to τ");
});
