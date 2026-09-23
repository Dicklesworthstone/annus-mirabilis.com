/**
 * A record's printed letters (dispatch 100): the density is printed f in two lessons, where the
 * table prints it p. The ruling's two conditions are held here with a real lesson record: the
 * override never changes what a term is bound to, and the legend shows the printed letter beside
 * the quantity's canonical name. The parser's refusals are planted negatives. This lane is the
 * unit lane; prepare:content compiles every real record through the same parser in the build.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToString } from "katex";
import { renderToStaticMarkup } from "react-dom/server";
import { QuantityLegendList } from "../reader/QuantityLegendList.tsx";
import { quantityBindings } from "./ast.ts";
import { paperQuantityColours, quantityLegend } from "./quantityColourView.ts";
import type { EquationRecord } from "./record.ts";
import { parseEquationRecord } from "./record.ts";
import { compileEquation } from "./render.ts";

const RECORD = JSON.parse(
  readFileSync(
    new URL(
      "../../content/equations/foundations/eq-model-fd-diffusion-density.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as EquationRecord;
const withLetters = (printedGlyphs: unknown) =>
  ({ ...RECORD, printedGlyphs }) as unknown as EquationRecord;
const glyphHtml = (glyph: string) =>
  renderToString(glyph, {
    output: "html",
    throwOnError: true,
    strict: "error",
    trust: false,
    maxExpand: 100,
    maxSize: 10,
  });

const plain = compileEquation(RECORD);
const printed = compileEquation(withLetters({ probabilityDensity: "f" }));

describe("a record's printed letters", () => {
  test("the record under test binds the density and prints it p by default", () => {
    expect(plain.terms.map((t) => t.quantityId)).toContain("probabilityDensity");
    expect(plain.plainLatex).toContain("\\partial p");
    expect(plain.printedGlyphHtml).toBeUndefined();
  });

  test("the formula prints the record's letter", () => {
    expect(printed.plainLatex).toContain("\\partial f");
    expect(printed.plainLatex).not.toContain("\\partial p");
    const densityTerm =
      /data-term="eq-model-fd-diffusion-density\.t\.density"><span class="enclosing am-role-result"><span class="mord mathnormal"[^>]*>(\w)<\/span>/;
    expect(printed.html.match(densityTerm)?.[1]).toBe("f");
    expect(plain.html.match(densityTerm)?.[1]).toBe("p");
  });

  test("the override never changes a bound quantity, nor anything the term carries", () => {
    const carried = (e: typeof plain) =>
      e.terms.map((t) => [
        t.termId,
        t.quantityId,
        t.quantity.id,
        t.quantity.name,
        t.quantity.glyph,
        JSON.stringify(t.quantity.dimension),
      ]);
    expect(carried(printed)).toEqual(carried(plain));
    expect(quantityBindings(printed.tree)).toEqual(quantityBindings(plain.tree));
    expect(printed.bindings).toEqual(plain.bindings);
    expect(printed.navigation).toEqual(plain.navigation);
  });

  test("the legend shows the printed letter beside the canonical name, in the paper's colour", () => {
    const paper = paperQuantityColours("foundations").probabilityDensity;
    expect(paper?.name).toBe("Probability density");
    const entry = quantityLegend([printed]).find((e) => e.quantityId === "probabilityDensity");
    expect(entry?.colour.glyphHtml).toBe(glyphHtml("f"));
    expect(entry?.colour.name).toBe(paper?.name as string);
    expect(entry?.colour.slot).toBe(paper?.slot as number);

    const html = renderToStaticMarkup(
      <QuantityLegendList legend={quantityLegend([printed])} label="Quantities in this formula" />,
    );
    const item = html.match(/<li[^>]*data-quantity-id="probabilityDensity"[^>]*>.*?<\/li>/)?.[0];
    expect(item).toContain(glyphHtml("f"));
    expect(item).toContain(">Probability density</span>");
    expect(item).not.toContain(glyphHtml("p"));
  });

  test("the other quantities' legend entries are the paper's own", () => {
    const others = (e: typeof plain) =>
      quantityLegend([e]).filter((x) => x.quantityId !== "probabilityDensity");
    expect(others(printed)).toEqual(others(plain));
    expect(others(printed).length).toBeGreaterThan(0);
  });

  test("one quantity printed two ways in one view is listed under both letters", () => {
    const legend = quantityLegend([plain, printed]).filter(
      (e) => e.quantityId === "probabilityDensity",
    );
    expect(legend.map((e) => e.colour.glyphHtml)).toEqual([glyphHtml("p"), glyphHtml("f")]);
  });

  test("a Greek letter, a subscript and a prime are admitted", () => {
    for (const glyph of ["\\rho", "n_0", "f'", "c_{A}"])
      expect(
        parseEquationRecord(withLetters({ probabilityDensity: glyph }), "ok").printedGlyphs,
      ).toEqual({ probabilityDensity: glyph });
  });
});

describe("planted: letters the parser refuses", () => {
  const refused = (printedGlyphs: unknown, reason: RegExp) =>
    expect(() => parseEquationRecord(withLetters(printedGlyphs), "planted")).toThrow(reason);

  test("a quantity the formula does not bind", () =>
    refused({ numberDensity: "c" }, /does not bind/));

  test("anything but one letter: markup, sizing, a link, two letters, an empty string", () => {
    for (const glyph of ["<b>f</b>", "\\huge f", "\\href{https://x.test}{f}", "ff", "", 7])
      refused({ probabilityDensity: glyph }, /not one letter/);
  });

  test("the letter the table already prints", () =>
    refused({ probabilityDensity: "p" }, /already prints; omit it/));

  test("a letter another quantity in the same formula prints", () => {
    refused({ probabilityDensity: "t" }, /elapsedTime already prints/);
    refused({ probabilityDensity: "D", elapsedTime: "s" }, /diffusionCoefficient already prints/);
  });

  test("two overrides that collide with each other", () =>
    refused({ probabilityDensity: "f", elapsedTime: "f" }, /already prints in this formula/));

  test("not a map, or an empty one", () => {
    refused(["f"], /must map a quantity id/);
    refused(null, /must map a quantity id/);
    refused({}, /between one and sixteen/);
  });
});
