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
const display = checked.displays.find((d) => d.display === "eq-s5-d5");
assert(display);
const original = compilePrintedDisplay(display);
const quantities = getQuantityRegistry().quantities;
const compiled = compilePrintedSourceSemantics(display, original, quantities);
assert(compiled);
const row = compiled.semantics.rows[0];
assert(row?.kind === "relation");

describe("the general speed of composition printed in section 5", () => {
  test("the printed expression agrees with the velocities of Lorentz-transformed events", () => {
    const V = 8;
    for (const v of [-3, 0, 3, 6]) {
      for (const [wx, wy] of [[0, 0], [3, 0], [2, -3], [-2, 3], [0, 3], [0, V], [V, 0], [-V, 0]] as const) {
        const w = Math.hypot(wx, wy);
        // Use two events one moving-frame time unit apart, independently of the printed expansion.
        const gamma = 1 / Math.sqrt(1 - (v / V) ** 2);
        const dx = gamma * (wx + v);
        const dt = gamma * (1 + v * wx / V ** 2);
        const alpha = Math.atan2(wy, wx);
        const glyphs: Record<string, number> = { v, w, V, "\\alpha": alpha };
        const bindings = Object.fromEntries(display.terms.map((t) => [t.termId, glyphs[t.glyph]!]));
        expect(evaluateExpression(row.right, bindings)).toBeCloseTo(Math.hypot(dx / dt, wy / dt), 12);
      }
    }
  });

  test("the actual reader publishes selectable roles, checked dimensions and unchanged source MathML", async () => {
    const result = await printedDisplays(process.cwd(), [paper], []);
    expect(result.problems).toEqual([]);
    const payload = result.displays.find((d) => d.display === display.display);
    assert(payload?.semantics);
    expect(payload.semantics.dimensionStatus).toBe("consistent");
    expect(payload.html.split('<span class="katex-html"')[0]).toBe(original.html.split('<span class="katex-html"')[0]);
    const html = renderToStaticMarkup(<PrintedOperationReference reading={payload.semantics} spoken={payload.spoken} />);
    expect(html).toContain("/lab/sr-06/");
    expect(html).toContain("Take the nonnegative square root");
    for (const op of payload.semantics.operations) expect(payload.html).toContain('data-op="' + op.id + '"');
    for (const term of display.terms) expect(payload.html).toContain('data-term="' + term.termId + '"');
  });

  test("the two trigonometric projections cannot silently exchange roles", () => {
    const changed = { ...display, latex: display.latex.replace("\\sin", "\\cos") };
    expect(() => compilePrintedSourceSemantics(changed, compilePrintedDisplay(changed), quantities)).toThrow(/no longer matches the source/);
  });
});
