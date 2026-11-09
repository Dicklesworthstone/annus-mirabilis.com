import assert from "node:assert/strict";
import test from "node:test";
import { renderToString } from "katex";
import type { Expression } from "../ast.ts";
import { expressionToSpokenText } from "./a11yText.ts";
import { expressionToDerivationLatex, renderExpressionMarkup } from "./mathRenderer.ts";

test("the transverse-scale alias matches the concordance glyph without leaking TeX into speech", () => {
  const scale: Expression = {
    kind: "symbol",
    termId: "a_perp",
    quantityId: "ansatzTransverseScale",
  };
  const latex = expressionToDerivationLatex(scale);
  assert.equal(latex, "a_{\\perp}");
  assert.doesNotThrow(() => renderToString(latex, { throwOnError: true, strict: "error" }));
  assert.equal(expressionToSpokenText(scale), "a perpendicular");
  const html = renderExpressionMarkup(scale, new Set(["a_perp"])).html;
  assert.ok(!html.includes("katex-error"));
  assert.ok(html.includes("<math"));
  assert.equal(
    expressionToDerivationLatex({ ...scale, termId: "a_parallel" }),
    "a_{\\mathrm{parallel}}",
  );
});
