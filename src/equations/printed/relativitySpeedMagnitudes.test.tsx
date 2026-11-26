import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { getQuantityRegistry } from "../../content/quantities/registry.ts";
import { PrintedOperationReference } from "../../reader/faces/PrintedOperationReference.tsx";
import { walk } from "../ast.ts";
import { evaluateExpression } from "../derivations/spotCheck.ts";
import { compilePrintedDisplay } from "./displayTerms.ts";
import { checkPaperDisplays, printedDisplays } from "./paperDisplays.ts";
import { parseSourceExpression } from "./sourceExpression.ts";
import { compilePrintedSourceSemantics } from "./sourceSemantics.ts";

const paper = "special-relativity";
const checked = await checkPaperDisplays(process.cwd(), paper);
assert(checked && !checked.problems.length);
const display = checked.displays.find((d) => d.display === "eq-s5-d3");
assert(display);
const quantities = getQuantityRegistry().quantities;
const original = compilePrintedDisplay(display);
const compiled = compilePrintedSourceSemantics(display, original, quantities);
assert(compiled);
const [stationary, moving] = compiled.semantics.rows;
assert(stationary?.kind === "relation" && moving?.kind === "relation");

describe("the two source definitions of squared speed", () => {
  test("the K row has ordinary trajectory derivatives and the k row is the squared norm of its own components", () => {
    const rates = walk(stationary.right).filter((n) => n.kind === "derivative");
    expect(rates.map((n) => [n.order, n.partial])).toEqual([[1, false], [1, false]]);
    expect(rates.map((n) => n.expression.kind === "symbol" && n.expression.index)).toEqual(["x", "y"]);
    expect(rates.map((n) => n.variable.kind === "symbol" && n.variable.quantityId)).toEqual(["coordinateTimeStationary", "coordinateTimeStationary"]);
    for (const [wx, wy] of [[0, 0], [3, -4], [-3, 4], [0, -2]] as const) {
      const values = Object.fromEntries(display.terms.map((t) => [t.termId, t.quantityId === "velocityComponentXMoving" ? wx : wy]));
      expect(evaluateExpression(moving.right, values)).toBeCloseTo(Math.hypot(wx, wy) ** 2, 12);
    }
  });

  test("the published operations retain the source MathML, term targets and both frames’ squared-speed dimensions", async () => {
    const result = await printedDisplays(process.cwd(), [paper], []);
    expect(result.problems).toEqual([]);
    const payload = result.displays.find((d) => d.display === display.display);
    assert(payload?.semantics);
    expect(payload.semantics.dimensionStatus).toBe("consistent");
    const relations = payload.semantics.operations.filter((op) => op.kind === "relation");
    expect(relations.map((op) => op.dimensionExponents)).toEqual(Array(2).fill(["2", "0", "-2", "0", "0", "0"]));
    expect(payload.html.split('<span class="katex-html"')[0]).toBe(original.html.split('<span class="katex-html"')[0]);
    const html = renderToStaticMarkup(<PrintedOperationReference reading={payload.semantics} spoken={payload.spoken} />);
    expect(html).toContain("Find the squared speed in K");
    expect(html).toContain("Find the squared speed in k");
    expect(html).toContain("/lab/sr-06/");
    for (const op of payload.semantics.operations) expect(payload.html).toContain('data-op="' + op.id + '"');
    for (const term of display.terms) expect(payload.html).toContain('data-term="' + term.termId + '"');
  });

  test("coordinate rates require explicit admission, matching d markers and their own coordinate axis", () => {
    expect(() => parseSourceExpression(display)).toThrow();
    const options = { allowTrajectoryDerivatives: true };
    expect(() => parseSourceExpression({ ...display, latex: display.latex.replace("{d t}", "{x t}") }, {}, false, options)).toThrow();
    const wrongGlyph = {
      ...display,
      latex: display.latex.replace("{d y}", "{d x}"),
      terms: display.terms.map((term) => term.glyph === "y" ? { ...term, glyph: "x" } : term),
    };
    expect(() => compilePrintedSourceSemantics(wrongGlyph, compilePrintedDisplay(wrongGlyph), quantities)).toThrow();
  });
});
