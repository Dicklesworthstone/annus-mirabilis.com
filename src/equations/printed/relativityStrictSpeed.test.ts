import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PrintedOperationReference } from "../../reader/faces/PrintedOperationReference.tsx";
import { getQuantityRegistry } from "../../content/quantities/registry.ts";
import type { Expression } from "../ast.ts";
import { expressionToSpokenText } from "../derivations/a11yText.ts";
import { expressionToDerivationLatex } from "../derivations/mathRenderer.ts";
import { addSubtractMultiplyDivideRule, monotonicFunctionRule, registeredIdentityRule } from "../derivations/rules/index.ts";
import { evaluateExpression } from "../derivations/spotCheck.ts";
import { type CheckedDisplay, compilePrintedDisplay } from "./displayTerms.ts";
import { checkPaperDisplays, printedDisplays } from "./paperDisplays.ts";
import { parseSourceExpression } from "./sourceExpression.ts";
import { compilePrintedSourceSemantics } from "./sourceSemantics.ts";

const paper = "special-relativity";
const checked = await checkPaperDisplays(process.cwd(), paper);
assert(checked && !checked.problems.length);
const source = checked.displays.find((display) => display.display === "eq-s5-d7");
assert(source);
const quantities = getQuantityRegistry().quantities;
function compile(display: CheckedDisplay) {
  const result = compilePrintedSourceSemantics(display, compilePrintedDisplay(display), quantities);
  assert(result);
  return result;
}

describe("the strict speed bound printed in relativity section 5", () => {
  test("the source, permanently rendered operation reference, LaTeX and speech preserve strictness", async () => {
    const published = await printedDisplays(process.cwd(), [paper], []);
    expect(published.problems).toEqual([]);
    const display = published.displays.find((value) => value.display === source.display);
    assert(display?.semantics);
    const { rows, operations, continuationRows, next, roundTrip } = display.semantics;
    expect(rows.map((row) => row.kind === "relation" && row.operator)).toEqual(["=", "<"]);
    expect(continuationRows).toEqual([1]);
    expect(roundTrip.canonicalLatex).toContain("U < V");
    expect(next.href).toBe("/lab/sr-06/");
    const upper = rows[1]!;
    expect(expressionToDerivationLatex(upper)).toContain(" < ");
    expect(expressionToSpokenText(upper)).toContain(" is less than ");
    expect(display.html.split('<span class="katex-html"')[0]).toBe(
      compilePrintedDisplay(source).html.split('<span class="katex-html"')[0],
    );
    const bound = operations.find((op) => op.path === "row2");
    assert(bound);
    expect(bound.title).toBe("Read the strict upper bound");
    const reference = renderToStaticMarkup(createElement(PrintedOperationReference, {
      reading: display.semantics, spoken: display.spoken,
    }));
    expect(reference).toContain('id="operation-' + bound.id + '"');
    expect(reference).toContain("U is strictly less than V");
    expect(reference).toContain('href="/lab/sr-06/"');
    expect(bound.dimensionExponents).toEqual(["1", "0", "-1", "0", "0", "0"]);
    for (const op of operations) expect(display.html).toContain('data-op="' + op.id + '"');
    for (const term of source.terms) expect(display.html).toContain('data-term="' + term.termId + '"');
  });

  test("the shortfall expression agrees with composition and remains below V", () => {
    const { rows } = compile(source).semantics;
    const [equality, strict] = rows;
    assert(equality?.kind === "relation" && strict?.kind === "relation");
    const V = 5;
    for (const v of [0, 0.01, 1, 4, 4.999]) {
      for (const w of [0, 0.01, 1, 4, 4.999]) {
        const glyphs: Record<string, number> = { "\\varkappa": V - v, "\\lambda": V - w, V };
        const bindings = Object.fromEntries(source.terms.map((term) => [term.termId, glyphs[term.glyph]!]));
        const U = evaluateExpression(equality.right, bindings);
        expect(U).toBeCloseTo((v + w) / (1 + (v * w) / V ** 2), 12);
        expect(U).toBeLessThan(evaluateExpression(strict.right, bindings));
      }
    }
  });

  test("the final bound is opt-in, must be strict, and must be terminal", () => {
    expect(() => parseSourceExpression(source, {}, true)).toThrow();
    for (const replacement of [" = ", " ≤ "]) {
      expect(() => compile({ ...source, latex: source.latex.replace(" < ", replacement) })).toThrow();
    }
    expect(() => compile({ ...source, latex: source.latex.replace(" + ", " - ") })).toThrow();
    expect(() => compile({ ...source, latex: source.latex.replace(" .", " = 1 .") })).toThrow();
  });

  test("uncertified order changes cannot acquire verified proof steps", () => {
    const n = (value: string): Expression => ({ kind: "number", value });
    const bound = (left: Expression, right: Expression): Expression => ({
      kind: "relation", operator: "<", left, right,
    });
    const from = bound(n("-3"), n("-2"));
    const square = (base: Expression): Expression => ({ kind: "power", base, exponent: { num: 2, den: 1 } });
    expect(monotonicFunctionRule.check({
      from, to: bound(square(n("-3")), square(n("-2"))), params: { function: "square", domain: "negative reals" },
    }).outcome).toBe("unverifiable");
    const multiply = (a: Expression): Expression => ({ kind: "product", args: [a, n("-1")] });
    expect(addSubtractMultiplyDivideRule.check({
      from, to: bound(multiply(n("-3")), multiply(n("-2"))), params: { operation: "multiply", quantity: n("-1") },
    }).outcome).toBe("unverifiable");
    const average = (argument: Expression): Expression => ({ kind: "average", argument });
    expect(registeredIdentityRule.check({
      from, to: bound(average(n("-3")), average(n("-2"))),
      params: { identityId: "linearity-of-average", premises: ["an equality identity"] },
    }).outcome).toBe("unverifiable");
    const add = (a: Expression): Expression => ({ kind: "sum", args: [a, n("1")] });
    expect(addSubtractMultiplyDivideRule.check({
      from, to: bound(add(n("-3")), add(n("-2"))), params: { operation: "add", quantity: n("1") },
    }).outcome).toBe("pass");
  });
});
