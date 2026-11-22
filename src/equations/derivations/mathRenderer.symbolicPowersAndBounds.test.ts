import { expect, test } from "bun:test";
import { renderToString } from "katex";
import type { Expression } from "../ast.ts";
import { brownianOsmoticSteps, presentBrownianOsmoticExpression } from "./brownianOsmotic.ts";
import { closingQuantaExpressions, presentClosingQuantaExpression } from "./lightQuantaClosing.ts";
import { expressionToDerivationLatex } from "./mathRenderer.ts";

const f: Expression = { kind: "symbol", termId: "f", quantityId: "volumeRatio" };
const n: Expression = { kind: "symbol", termId: "n", quantityId: "particleCount" };
const symbolicPower = (base: Expression): Expression => ({
  kind: "symbolPower",
  base,
  exponent: n,
});

test("a symbolic exponent remains visible and a starred volume retains its grouping", () => {
  expect(expressionToDerivationLatex(symbolicPower(f))).toBe("f^{n}");
  const starred: Expression = { kind: "symbol", termId: "V^{*}", quantityId: "volume" };
  expect(expressionToDerivationLatex(symbolicPower(starred))).toBe("\\left(V^{*}\\right)^{n}");
  const ratio: Expression = {
    kind: "quotient",
    numerator: f,
    denominator: { kind: "number", value: "2" },
  };
  expect(expressionToDerivationLatex(symbolicPower(ratio))).toBe("\\left(\\frac{f}{2}\\right)^{n}");
  for (const base of [f, starred, ratio]) {
    const tex = expressionToDerivationLatex(symbolicPower(base));
    expect(tex).not.toContain("\\dots");
    expect(() => renderToString(tex, { throwOnError: true, trust: false })).not.toThrow();
  }
});

test("all Brownian volume steps render complete mathematical trees in both notations", () => {
  for (const perspective of ["historical", "modern"] as const)
    for (const step of brownianOsmoticSteps)
      for (const expression of step.expressions) {
        const tex = expressionToDerivationLatex(
          presentBrownianOsmoticExpression(expression, perspective),
        );
        expect(tex, step.id).not.toContain("\\dots");
        expect(
          () => renderToString(tex, { displayMode: true, throwOnError: true, trust: false }),
          step.id,
        ).not.toThrow();
      }
});

test("a conditional upper or lower bound is never printed as an equality", () => {
  for (const [operator, glyph] of [
    ["=", "="],
    ["approx", "\\approx"],
    ["define", ":="],
    ["le", "\\leq"],
    ["ge", "\\geq"],
  ] as const) {
    const relation: Expression = { kind: "relation", left: f, right: n, operator };
    expect(expressionToDerivationLatex(relation)).toBe(`f ${glyph} n`);
  }
  for (const [expression, glyph] of [
    [closingQuantaExpressions.fluorescenceBound, "\\leq"],
    [closingQuantaExpressions.ionizationThreshold, "\\geq"],
    [closingQuantaExpressions.ionCountBound, "\\leq"],
  ] as const) {
    const tex = expressionToDerivationLatex(presentClosingQuantaExpression(expression));
    expect(tex).toContain(glyph);
    expect(tex).not.toContain(" = ");
    expect(() => renderToString(tex, { throwOnError: true, trust: false })).not.toThrow();
  }
});
