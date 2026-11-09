import assert from "node:assert/strict";
import test from "node:test";
import type { Expression } from "../ast.ts";
import { expressionToDerivationLatex, renderExpressionMarkup } from "./mathRenderer.ts";

const volume: Expression = { kind: "symbol", termId: "V", quantityId: "volume", index: "0" };
const entropy: Expression = {
  kind: "symbol",
  termId: "S",
  quantityId: "radiationEntropy",
  at: volume,
};
const frequency: Expression = { kind: "symbol", termId: "\\nu", quantityId: "frequency" };

test("a derivation preserves a symbol's indexed argument and exact scale", () => {
  const tree: Expression = { ...entropy, scale: { num: 1, den: 2 } };
  assert.equal(
    expressionToDerivationLatex(tree),
    "\\frac{1}{2}\\left(S\\left(V_{\\mathrm{0}}\\right)\\right)",
  );
  const html = renderExpressionMarkup(tree).html;
  assert.ok(html.includes("<math"));
  assert.ok(html.includes("<msub>"));
  assert.ok(!html.includes("katex-error"));
});

test("several arguments of one quantity remain distinct and in order", () => {
  const tree: Expression = {
    kind: "symbol",
    termId: "f",
    quantityId: "frequencyEnergyDensity",
    args: [volume, frequency],
  };
  assert.equal(expressionToDerivationLatex(tree), "f\\left(V_{\\mathrm{0}}, \\nu\\right)");
  assert.ok(!renderExpressionMarkup(tree).html.includes("katex-error"));
});

test("a code-built index is literal text and cannot introduce a KaTeX command", () => {
  const tree: Expression = { ...volume, index: "}{\\htmlClass{injected}{X}" };
  const latex = expressionToDerivationLatex(tree);
  assert.ok(latex.includes("\\backslash htmlClass\\{injected\\}"));
  assert.ok(!latex.includes("\\htmlClass"));
  const html = renderExpressionMarkup(tree).html;
  assert.ok(!html.includes('class="injected"'));
  assert.ok(!html.includes("katex-error"));
  const alreadySubscripted: Expression = { ...volume, termId: "k_B" };
  assert.equal(expressionToDerivationLatex(alreadySubscripted), "{k_B}_{\\mathrm{0}}");
});

test("a partial derivative keeps its held-fixed frequency in its rendered equation", () => {
  const tree: Expression = {
    kind: "derivative",
    expression: { kind: "symbol", termId: "s", quantityId: "spectralEntropyDensity" },
    variable: { kind: "symbol", termId: "\\rho", quantityId: "frequencyEnergyDensity" },
    order: 1,
    partial: true,
    heldFixed: [frequency],
  };
  assert.match(expressionToDerivationLatex(tree), /\\right\)_\{\\nu\}$/);
  const html = renderExpressionMarkup(tree).html;
  assert.ok(html.includes("<msub>"));
  assert.ok(!html.includes("katex-error"));
  const withoutFixed: Expression = { ...tree, heldFixed: [] };
  assert.notEqual(expressionToDerivationLatex(withoutFixed), expressionToDerivationLatex(tree));
});
