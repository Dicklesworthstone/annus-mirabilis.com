import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { getQuantityRegistry } from "../../content/quantities/registry.ts";
import { evaluateExpression } from "../derivations/spotCheck.ts";
import { type CheckedDisplay, compilePrintedDisplay } from "./displayTerms.ts";
import { checkPaperDisplays, printedDisplays } from "./paperDisplays.ts";
import { compilePrintedSourceSemantics } from "./sourceSemantics.ts";

const paper = "special-relativity";
const checked = await checkPaperDisplays(process.cwd(), paper);
assert(checked && !checked.problems.length);
const ids = ["eq-s5-d1", "eq-s5-d2"];
const source = ids.map((id) => {
  const item = checked.displays.find((display) => display.display === id);
  assert(item);
  return item;
});
const quantities = getQuantityRegistry().quantities;
function compile(display: CheckedDisplay) {
  const result = compilePrintedSourceSemantics(display, compilePrintedDisplay(display), quantities);
  assert(result);
  return result;
}

describe("the two printed planar velocity maps of section 5", () => {
  test("both guides are published with the three coordinate lengths and selectable operations", async () => {
    const published = await printedDisplays(process.cwd(), [paper], []);
    expect(published.problems).toEqual([]);
    for (const display of source) {
      const payload = published.displays.find((item) => item.display === display.display);
      const semantics = payload?.semantics;
      assert(payload && semantics);
      expect(semantics.dimensionStatus).toBe("consistent");
      expect(semantics.rows).toHaveLength(3);
      expect(semantics.next.href).toBe("/lab/sr-06/cases/transverse/");
      const original = compilePrintedDisplay(display);
      expect(payload.html.split('<span class="katex-html"')[0]).toBe(
        original.html.split('<span class="katex-html"')[0],
      );
      for (const op of semantics.operations) expect(payload.html).toContain('data-op="' + op.id + '"');
      for (const term of display.terms) expect(payload.html).toContain('data-term="' + term.termId + '"');
      const wholeRows = semantics.operations.filter((op) => /^row[123]$/.test(op.path));
      expect(wholeRows).toHaveLength(3);
      for (const op of wholeRows) {
        expect(op.primary).toBe(true);
        expect(op.dimensionExponents).toEqual(["1", "0", "0", "0", "0", "0"]);
      }
    }
  });

  test("both source maps locate the same events as a direct inverse Lorentz map", () => {
    const maps = source.map((display) => ({ display, rows: compile(display).semantics.rows }));
    const V = 5;
    for (const v of [-3, 0, 3]) {
      const gamma = 1 / Math.sqrt(1 - (v / V) ** 2);
      // Includes a transverse trajectory, a light ray, and the origin of the moving frame.
      for (const [wx, wy] of [[2, -1], [-2, 1], [0, 3], [3, 4], [0, 0]] as const) {
        for (const tau of [0, 4]) {
          const xi = wx * tau;
          const eta = wy * tau;
          const t = gamma * (tau + (v * xi) / V ** 2);
          const x = gamma * (xi + v * tau);
          const byGlyph: Record<string, number> = { "w_\\xi": wx, "w_\\eta": wy, "\\tau": tau, v, V, t };
          for (const [i, { display, rows }] of maps.entries()) {
            const bindings = Object.fromEntries(
              display.terms.map((term) => [term.termId, byGlyph[term.glyph]!]),
            );
            const expected = i === 0 ? [xi, eta, 0] : [x, eta, 0];
            rows.forEach((row, axis) => {
              assert(row.kind === "relation");
              expect(evaluateExpression(row.right, bindings)).toBeCloseTo(expected[axis]!, 12);
            });
          }
        }
      }
    }
  });

  test("the common denominator must use the longitudinal velocity in the transverse row too", () => {
    const display = source[1]!;
    const misplaced = display.terms.filter((term) => term.glyph === "w_\\xi").at(-1);
    assert(misplaced);
    const other = display.terms.find((term) => term.glyph === "w_\\eta");
    assert(other);
    const end = misplaced.start + misplaced.glyph.length;
    assert(display.latex.slice(misplaced.start, end) === misplaced.glyph);
    const delta = other.glyph.length - misplaced.glyph.length;
    const changed: CheckedDisplay = {
      ...display,
      latex: display.latex.slice(0, misplaced.start) + other.glyph + display.latex.slice(end),
      terms: display.terms.map((term) =>
        term === misplaced
          ? { ...term, glyph: other.glyph, quantityId: other.quantityId, end: term.end + delta }
          : term.start >= end
            ? { ...term, start: term.start + delta, end: term.end + delta }
            : term,
      ),
    };
    expect(() => compile(changed)).toThrow(/no longer matches the source/);
  });
});
