import { beforeAll, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { getQuantityRegistry } from "../../content/quantities/registry.ts";
import { evaluateExpression } from "../derivations/spotCheck.ts";
import { type CheckedDisplay, compilePrintedDisplay } from "./displayTerms.ts";
import { checkPaperDisplays, printedDisplays } from "./paperDisplays.ts";
import { compilePrintedSourceSemantics } from "./sourceSemantics.ts";

const ids = Array.from({ length: 6 }, (_, i) => "eq-s4-d" + (i + 1));
const quantities = getQuantityRegistry().quantities;
let section: readonly CheckedDisplay[];

beforeAll(async () => {
  const checked = await checkPaperDisplays(process.cwd(), "special-relativity");
  assert(checked);
  expect(checked.problems).toEqual([]);
  section = checked.displays.filter((item) => ids.includes(item.display));
  expect(section.map((item) => item.display)).toEqual(ids);
});

function display(number: number) {
  const source = section[number - 1];
  assert(source);
  return source;
}

function compile(source: CheckedDisplay) {
  const result = compilePrintedSourceSemantics(source, compilePrintedDisplay(source), quantities);
  assert(result);
  return result;
}

function values(number: number, glyphs: Readonly<Record<string, number>>, side: "left" | "right" = "right") {
  const source = display(number);
  const byTerm = Object.fromEntries(source.terms.map((term) => [term.termId, glyphs[term.glyph]!]));
  return compile(source).semantics.rows.map((row) => evaluateExpression(row.kind === "relation" ? row[side] : row, byTerm));
}

describe("printed measuring procedures of relativity section 4", () => {
  test("all six displays reach the reader with selectable operations and their original MathML", async () => {
    const catalogue = await printedDisplays(process.cwd(), ["special-relativity"], []);
    expect(catalogue.problems).toEqual([]);
    for (const source of section) {
      const original = compilePrintedDisplay(source);
      const { html, semantics } = compile(source);
      expect(html.split('<span class="katex-html"')[0]).toBe(original.html.split('<span class="katex-html"')[0]);
      expect(semantics.dimensionStatus).toBe("consistent");
      expect(semantics.operations.some((op) => op.primary)).toBe(true);
      for (const op of semantics.operations) expect(html).toContain('data-op="' + op.id + '"');
      for (const term of source.terms) expect(html).toContain('data-term="' + term.termId + '"');
      expect(catalogue.displays.find((item) => item.display === source.display)?.semantics?.operations.length).toBe(semantics.operations.length);
    }
    expect(compile(display(3)).semantics.rows.map(row => row.kind)).toEqual(["product", "symbol", "symbol"]);
    expect(compile(display(6)).semantics.continuationRows).toEqual([1]);
  });

  test("a sphere with rest radius five has longitudinal semiaxis four at either signed speed", () => {
    for (const v of [-3, 3]) {
      const axes = values(3, { R: 5, v, V: 5 });
      expect(axes).toHaveLength(3);
      for (const [i, length] of [4, 5, 5].entries()) expect(axes[i]).toBeCloseTo(length, 12);
      for (const [x, y, z] of [[4, 0, 0], [0, 5, 0], [0, 0, 5]] as const)
        expect(values(2, { x, y, z, R: 5, v, V: 5 }, "left")[0]).toBeCloseTo(25, 12);
    }
    expect(values(3, { R: 5, v: 0, V: 5 })).toEqual([5, 5, 5]);
    expect(values(1, { "\\xi": 3, "\\eta": 4, "\\zeta": 0, R: 5 }, "left")).toEqual([25]);
  });

  test("the one-clock formula follows the selected clock path and both lag expressions agree", () => {
    for (const v of [-3, 0, 3]) {
      const [x] = values(5, { v, t: 10 });
      expect(x).toBe(10 * v);
      const [movingTime] = values(4, { t: 10, x: x!, v, V: 5 });
      const expected = v === 0 ? 10 : 8;
      expect(movingTime).toBeCloseTo(expected, 12);
      for (const form of values(6, { t: 10, v, V: 5 })) expect(form).toBeCloseTo(expected, 12);
    }
    // Reading a k clock at the K origin selects different events.
    expect(values(4, { t: 10, x: 0, v: 3, V: 5 })[0]).toBeCloseTo(12.5, 12);
  });

  test("refuses same-dimension swaps of longitudinal and transverse axes and of the two speeds", () => {
    function exchange(source: CheckedDisplay, a: string, b: string) {
      assert(a.length === b.length);
      let latex = source.latex;
      const terms = source.terms.map(term => {
        const glyph = term.glyph === a ? b : term.glyph === b ? a : term.glyph;
        if (glyph === term.glyph) return term;
        latex = latex.slice(0, term.start) + glyph + latex.slice(term.end);
        const binding = source.terms.find(item => item.glyph === glyph);
        assert(binding);
        return { ...term, glyph, quantityId: binding.quantityId };
      });
      return { ...source, terms, latex };
    }
    expect(() => compile(exchange(display(2), "x", "y"))).toThrow(/no longer matches the source/);
    expect(() => compile(exchange(display(3), "v", "V"))).toThrow(/no longer matches the source/);
  });
});
