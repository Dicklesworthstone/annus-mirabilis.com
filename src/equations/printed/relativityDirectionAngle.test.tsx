import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { getQuantityRegistry } from "../../content/quantities/registry.ts";
import { PrintedOperationReference } from "../../reader/faces/PrintedOperationReference.tsx";
import { evaluateExpression } from "../derivations/spotCheck.ts";
import { compilePrintedDisplay } from "./displayTerms.ts";
import { checkPaperDisplays, printedDisplays } from "./paperDisplays.ts";
import { compilePrintedSourceSemantics } from "./sourceSemantics.ts";

const paper = "special-relativity";
const checked = await checkPaperDisplays(process.cwd(), paper);
assert(checked && !checked.problems.length);
const display = checked.displays.find((d) => d.display === "eq-s5-d4");
assert(display);
const quantities = getQuantityRegistry().quantities;
const original = compilePrintedDisplay(display);
const compiled = compilePrintedSourceSemantics(display, original, quantities);
assert(compiled);
const row = compiled.semantics.rows[0];
assert(row?.kind === "relation" && row.right.kind === "function");
const angleTree = row.right;

describe("the direction of the particle's velocity in the moving system", () => {
  test("arctg retains the principal-branch and axis limitations of the printed quotient", () => {
    expect(angleTree.name).toBe("atan");
    for (const [x, y] of [[1, 0], [1, 1], [1, -1], [-1, -1], [-1, 1]] as const) {
      const values = Object.fromEntries(display.terms.map((t) => [t.termId, t.glyph === "w_y" ? y : x]));
      expect(evaluateExpression(angleTree, values)).toBeCloseTo(Math.atan(y / x), 12);
    }
    const vertical = Object.fromEntries(display.terms.map((t) => [t.termId, t.glyph === "w_x" ? 0 : 1]));
    expect(() => evaluateExpression(angleTree, vertical)).toThrow();
    expect(compiled.semantics.premise).toContain("point at rest has no velocity direction");
    expect(compiled.semantics.operations.find((op) => op.path === "row1.right")?.why).toContain("quadrant");
  });

  test("the reader renders the original arctg and Latin subscripts with all term and operation targets", async () => {
    const result = await printedDisplays(process.cwd(), [paper], []);
    expect(result.problems).toEqual([]);
    const payload = result.displays.find((d) => d.display === display.display);
    assert(payload?.semantics);
    expect(payload.latex).toContain("\\operatorname{arctg} \\frac{w_y}{w_x}");
    expect(payload.semantics.dimensionStatus).toBe("consistent");
    expect(payload.html.split('<span class="katex-html"')[0]).toBe(original.html.split('<span class="katex-html"')[0]);
    const html = renderToStaticMarkup(<PrintedOperationReference reading={payload.semantics} spoken={payload.spoken} />);
    expect(html).toContain("Recover the direction from its slope");
    expect(html).toContain("/lab/sr-06/cases/oblique/");
    for (const op of payload.semantics.operations) expect(payload.html).toContain('data-op="' + op.id + '"');
    for (const term of display.terms) expect(payload.html).toContain('data-term="' + term.termId + '"');
  });

  test("swapping the physical component owners is refused even though the ratio remains dimensionless", () => {
    const swapped = {
      ...display,
      terms: display.terms.map((t) =>
        t.glyph === "w_x" || t.glyph === "w_y"
          ? { ...t, quantityId: t.glyph === "w_x" ? "velocityComponentYMoving" : "velocityComponentXMoving" }
          : t,
      ),
    };
    expect(() => compilePrintedSourceSemantics(swapped, compilePrintedDisplay(swapped), quantities)).toThrow(/no longer matches the source/);
  });
});
