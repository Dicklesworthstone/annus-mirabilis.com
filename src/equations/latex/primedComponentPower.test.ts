import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToString } from "katex";
import type { Expression } from "../ast.ts";
import { parseEquationRecord } from "../record.ts";
import { compileEquation } from "../render.ts";
import { SPECIAL_RELATIVITY_QUANTITIES } from "../specialRelativityQuantities.ts";
import { renderLatex } from "./render.ts";

const coordinate = (index?: string): Expression => ({
  kind: "symbol",
  termId: "eq-model-component.t.position",
  quantityId: "coordinatePositionMoving",
  ...(index === undefined ? {} : { index }),
});
const square = (base: Expression): Expression => ({
  kind: "power",
  base,
  exponent: { num: 2, den: 1 },
});
const options = { registry: SPECIAL_RELATIVITY_QUANTITIES, strictConcordance: false };

describe("powers of indexed primed coordinates", () => {
  for (const index of ["y", "z"]) {
    test(`the ${index} component keeps its prime, index and square in plain mathematics`, () => {
      const latex = renderLatex(square(coordinate(index)), options);
      // The prime already occupies a superscript. Appending the index before a second
      // superscript produces x'_{y}^{2}, which KaTeX refuses in the unmarked MathML face.
      expect(latex).toBe(`{x'}_{${index}}^{2}`);
      expect(latex).not.toContain("\\left(");
      expect(() => renderToString(latex, { output: "mathml", throwOnError: true })).not.toThrow();
    });
  }

  test("the same grouping works for a symbolic exponent", () => {
    const tree: Expression = {
      kind: "symbolPower",
      base: coordinate("y"),
      exponent: { kind: "number", value: "3" },
    };
    const latex = renderLatex(tree, options);
    expect(latex).toBe("{x'}_{y}^{3}");
    expect(() => renderToString(latex, { throwOnError: true })).not.toThrow();
  });

  test("an unindexed prime and a component-specific glyph keep their notation", () => {
    expect(renderLatex(square(coordinate()), options)).toBe("x'^{2}");
    expect(
      renderLatex(square(coordinate("y")), {
        ...options,
        componentGlyphs: { "coordinatePositionMoving#y": "\\eta" },
      }),
    ).toBe("\\eta^{2}");
  });

  test("the actual spherical-wave record compiles both selectable HTML and plain MathML", () => {
    const path = "content/equations/special-relativity/eq-model-sr-spherical-wave-moving.json";
    const record = parseEquationRecord(JSON.parse(readFileSync(path, "utf8")), path);
    const compiled = compileEquation(record);
    const expected = "x'^{2} + {x'}_{y}^{2} + {x'}_{z}^{2} = c^{2}\\,t'^{2}";
    expect(compiled.plainLatex).toBe(expected);
    // An independently written expression fixes which coordinate the square applies to;
    // merely accepting some valid TeX would also accept dropping the prime or the index.
    expect(compiled.mathml).toBe(
      renderToString(expected, {
        displayMode: true,
        output: "mathml",
        throwOnError: true,
        strict: "error",
        trust: false,
      }),
    );
    for (const component of ["xMoving", "yMoving", "zMoving"]) {
      expect(compiled.html).toContain(`data-term="${record.id}.t.${component}"`);
    }
  });
});
