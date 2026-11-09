import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../ast.ts";
import { expressionToSpokenText } from "./a11yText.ts";
import { expressionToDerivationLatex, renderExpressionMarkup } from "./mathRenderer.ts";

const x: Expression = { kind: "symbol", termId: "x", quantityId: "positionCoordinate1d" };
const integrand: Expression = { kind: "power", base: x, exponent: { num: 2, den: 1 } };
const indefinite: Extract<Expression, { kind: "integral" }> = {
  kind: "integral",
  expression: integrand,
  variable: x,
};

test("finite integral bounds are visible in mathematical and spoken derivation readings", () => {
  const tree: Expression = {
    ...indefinite,
    lower: { kind: "number", value: "0" },
    upper: { kind: "symbol", termId: "l", quantityId: "columnLength" },
  };
  assert.equal(expressionToDerivationLatex(tree), "\\int_{0}^{l} x^{2}\\,\\mathrm{d}x");
  assert.match(expressionToSpokenText(tree), /integral from 0 to l/);
  const html = renderExpressionMarkup(tree).html;
  assert.match(html, /<m(?:subsup|underover)>/);
  assert.ok(!html.includes("katex-error"));
});

test("whole-line integrals retain both infinite bounds instead of becoming indefinite", () => {
  const tree: Expression = {
    ...indefinite,
    lower: { kind: "negate", argument: { kind: "constant", name: "infinity" } },
    upper: { kind: "constant", name: "infinity" },
  };
  assert.equal(
    expressionToDerivationLatex(tree),
    "\\int_{-\\left(\\infty\\right)}^{\\infty} x^{2}\\,\\mathrm{d}x",
  );
  assert.match(expressionToSpokenText(tree), /from minus infinity to infinity/);
  const html = renderExpressionMarkup(tree).html;
  assert.ok(html.includes("∞"));
  assert.ok(!html.includes("π"));
  assert.ok(!html.includes("katex-error"));
});

test("indefinite integrals and pi retain their original meaning", () => {
  assert.equal(expressionToDerivationLatex(indefinite), "\\int x^{2}\\,\\mathrm{d}x");
  assert.equal(expressionToDerivationLatex({ kind: "constant", name: "pi" }), "\\pi");
  assert.equal(expressionToDerivationLatex({ kind: "constant", name: "infinity" }), "\\infty");
});
