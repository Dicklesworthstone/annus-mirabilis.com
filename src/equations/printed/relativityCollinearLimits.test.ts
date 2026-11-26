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
const quantities = getQuantityRegistry().quantities;
const select = (id: string) => {
  const display = checked.displays.find((value) => value.display === id);
  assert(display);
  return display;
};
const limiting = select("eq-s5-d8");
const symmetric = select("eq-s5-d9");

function compile(display: CheckedDisplay) {
  const result = compilePrintedSourceSemantics(display, compilePrintedDisplay(display), quantities);
  assert(result);
  return result;
}

function evaluate(display: CheckedDisplay) {
  const { rows } = compile(display).semantics;
  return (v: number, w: number, V = 5) => {
    const glyphs: Record<string, number> = { v, w, V };
    const bindings = Object.fromEntries(display.terms.map((term) => [term.termId, glyphs[term.glyph]!]));
    return rows.map((row) => evaluateExpression(row.kind === "relation" ? row.right : row, bindings));
  };
}

describe("the closing collinear velocity displays of section 5", () => {
  test("the reader gets the chained light-speed equality and the standalone fraction", async () => {
    const result = await printedDisplays(process.cwd(), [paper], []);
    expect(result.problems).toEqual([]);
    for (const display of [limiting, symmetric]) {
      const record = result.displays.find((row) => row.display === display.display);
      assert(record?.semantics);
      expect(record.semantics.dimensionStatus).toBe("consistent");
      expect(record.semantics.next.href).toBe(display === limiting ? "/lab/sr-06/cases/light-ray/" : "/lab/sr-06/");
      expect(record.html.split('<span class="katex-html"')[0]).toBe(
        compilePrintedDisplay(display).html.split('<span class="katex-html"')[0],
      );
      for (const op of record.semantics.operations) expect(record.html).toContain('data-op="' + op.id + '"');
      for (const term of display.terms) expect(record.html).toContain('data-term="' + term.termId + '"');
    }
    expect(compile(limiting).semantics.continuationRows).toEqual([1]);
    expect(compile(symmetric).semantics.rows.map(row => row.kind)).toEqual(["quotient"]);
    expect(compile(limiting).semantics.premise).toContain("A physical inertial frame must move below V");
  });

  test("the independent light-speed endpoint is unchanged for signed subluminal w", () => {
    const values = evaluate(limiting);
    for (const w of [-4.9, -3, 0, 3, 4.9]) {
      const sides = values(5, w);
      expect(sides).toHaveLength(2);
      for (const side of sides) expect(side).toBeCloseTo(5, 12);
    }
  });

  test("interchanging collinear inputs preserves the velocity and agrees with event coordinates", () => {
    const values = evaluate(symmetric);
    const V = 5;
    for (const v of [-4, -2, 0, 2, 4]) {
      const gamma = 1 / Math.sqrt(1 - (v / V) ** 2);
      for (const w of [-4, -2, 0, 2, 4]) {
        const [speed] = values(v, w, V);
        assert(speed !== undefined);
        expect(speed).toBeCloseTo(values(w, v, V)[0]!, 12);
        expect(Math.abs(speed)).toBeLessThan(V);
        // One interval of k time, with displacement w, mapped into K.
        const x = gamma * (w + v);
        const t = gamma * (1 + (v * w) / V ** 2);
        expect(speed).toBeCloseTo(x / t, 12);
      }
    }
  });

  test("the standalone guide refuses an inserted equality and an additional list entry", () => {
    for (const suffix of [" = 1", ", 1"]) {
      expect(() => compile({ ...symmetric, latex: symmetric.latex + suffix })).toThrow();
    }
  });
});
