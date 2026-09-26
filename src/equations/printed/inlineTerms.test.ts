/**
 * The inline resolver (dispatch 272): an inline formula's LaTeX, its paper and its scope in, a
 * term-marked KaTeX render out, with every glyph bound through the notation concordance of that
 * scope or refused with its location. Read against the real concordance files, so a scope that
 * binds a letter one way in one paper and another way in the next is tested where it is printed.
 */
import { describe, expect, test } from "bun:test";
import { renderToString } from "katex";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import { isRegisteredQuantityId } from "../../content/quantities/registry.ts";
import type { ConcordanceEntry } from "../../content/schemas/concordance.ts";
import {
  compileInlineFormula,
  INLINE_KATEX,
  type InlineException,
  type InlineScope,
  type InlineTermsContext,
  resolveInlineTerms,
} from "./inlineTerms.ts";

const contextFor = (paper: string, exceptions: readonly InlineException[] = []) =>
  ({
    concordance: loadConcordanceForPaper(paper).entries,
    isRegistered: isRegisteredQuantityId,
    exceptions,
  }) satisfies InlineTermsContext;
const scope = (paper: string, where: string, section: string): InlineScope => ({
  paper,
  where,
  anchor: where,
  section,
});
const bound = (latex: string, at: InlineScope, context = contextFor(at.paper)) =>
  resolveInlineTerms(latex, at, context).terms.map((t) => [t.glyph, t.quantityId]);

describe("each glyph binds the quantity the concordance gives in its scope", () => {
  test("the same letter binds different quantities in different papers and sections", () => {
    // Paper 1's β is Wien's constant; paper 3's is today's γ.
    expect(bound("\\beta", scope("light-quanta", "s2-p1", "s2"))).toEqual([
      ["\\beta", "wienConstantBeta"],
    ]);
    expect(bound("\\beta", scope("special-relativity", "s3-p10", "s3"))).toEqual([
      ["\\beta", "lorentzFactor"],
    ]);
    // Brownian's k is the viscosity, never Boltzmann's constant.
    expect(bound("k", scope("brownian-motion", "s3-p1", "s3"))).toEqual([["k", "viscosity"]]);
    // Paper 1's L is the speed of light in § 1 and an absorbed energy in § 9.
    expect(bound("L", scope("light-quanta", "s1-p1", "s1"))).toEqual([["L", "speedOfLight"]]);
    expect(bound("L", scope("light-quanta", "s9-p1", "s9"))).toEqual([
      ["L", "absorbedLightEnergy"],
    ]);
  });

  test("a letter the concordance declares no quantity is left uncoloured and not refused", () => {
    // Paper 3's k names the moving system, a coordinate-system label.
    const r = resolveInlineTerms(
      "k",
      scope("special-relativity", "s1-p1", "s1"),
      contextFor("special-relativity"),
    );
    expect(r.problems).toEqual([]);
    expect(r.terms).toEqual([]);
    expect(r.declared).toBe(1);
  });

  test("atoms, not letters: the v of \\varphi and the 0 of E_0 are never bound on their own", () => {
    const r = resolveInlineTerms(
      "l^* = l \\cos \\varphi",
      scope("mass-energy", "s0-p5", "s0"),
      contextFor("mass-energy"),
    );
    expect(r.terms.map((t) => t.glyph)).toEqual(["l^*", "l", "\\varphi"]);
  });
});

describe("a glyph that resolves to nothing or to two quantities is refused with its location", () => {
  test("the plant: an unbound glyph names its block", () => {
    // Nothing on mass-energy's concordance reads q.
    const r = resolveInlineTerms(
      "q = V",
      scope("mass-energy", "s0-p9", "s0"),
      contextFor("mass-energy"),
    );
    expect(r.problems.map((p) => p.code)).toEqual(["inline-terms-unbound-glyph"]);
    expect(r.problems[0]?.message).toContain("s0-p9");
    expect(r.problems[0]?.message).toContain('"q"');
    // The rest of the formula still resolved: V is the speed of light there.
    expect(r.terms.map((t) => t.quantityId)).toEqual(["speedOfLight"]);
  });

  test("two readings at the same level are refused as ambiguous", () => {
    const entries = loadConcordanceForPaper("mass-energy").entries;
    const v = entries.find((e) => e.glyph.latex === "V");
    if (!v) throw new Error("mass-energy's concordance has no V");
    const rival: ConcordanceEntry = { ...v, id: "me.V.rival", binding: { quantityId: "volume" } };
    const r = resolveInlineTerms("V", scope("mass-energy", "s0-p5", "s0"), {
      ...contextFor("mass-energy"),
      concordance: [...entries, rival],
    });
    expect(r.problems.map((p) => p.code)).toEqual(["inline-terms-ambiguous-glyph"]);
    expect(r.problems[0]?.message).toContain("speedOfLight");
    expect(r.problems[0]?.message).toContain("volume");
  });

  test("a binding to an unregistered quantity is refused", () => {
    const entries = loadConcordanceForPaper("mass-energy").entries;
    const v = entries.find((e) => e.glyph.latex === "V");
    if (!v) throw new Error("mass-energy's concordance has no V");
    const r = resolveInlineTerms("V", scope("mass-energy", "s0-p5", "s0"), {
      ...contextFor("mass-energy"),
      concordance: entries.map((e) =>
        e.id === v.id ? { ...e, binding: { quantityId: "noSuchQuantity" } } : e,
      ),
    });
    expect(r.problems.map((p) => p.code)).toEqual(["inline-terms-unregistered-quantity"]);
  });

  test("a listed exception is neither coloured nor refused, and only where its scope says", () => {
    const pi: InlineException = {
      paper: "mass-energy",
      glyph: "\\pi",
      scope: ["s0"],
      reason: "The number π, a ratio, not a quantity of the argument.",
    };
    const at = scope("mass-energy", "s0-p5", "s0");
    const listed = resolveInlineTerms("2\\pi", at, contextFor("mass-energy", [pi]));
    expect(listed.problems).toEqual([]);
    expect(listed.exceptions).toBe(1);
    // Scoped to another section, it does not apply here.
    const elsewhere = resolveInlineTerms(
      "2\\pi",
      at,
      contextFor("mass-energy", [{ ...pi, scope: ["s9"] }]),
    );
    expect(elsewhere.problems.map((p) => p.code)).toEqual(["inline-terms-unbound-glyph"]);
  });
});

describe("the compiled render", () => {
  test("each bound atom carries its term and quantity id, and the MathML is what the face drew before", () => {
    const at = scope("mass-energy", "s0-p5", "s0");
    const latex =
      "l^* = l \\frac{1 - \\frac{v}{V} \\cos \\varphi}{\\sqrt{1 - \\left(\\frac{v}{V}\\right)^2}}";
    const compiled = compileInlineFormula(resolveInlineTerms(latex, at, contextFor("mass-energy")));
    expect(compiled.terms.map((t) => t.quantityId)).toEqual([
      "lightComplexEnergyMoving",
      "lightComplexEnergyStationary",
      "frameSpeed",
      "speedOfLight",
      "propagationAngleStationary",
      "frameSpeed",
      "speedOfLight",
    ]);
    for (const t of compiled.terms) {
      expect(compiled.html).toContain(`data-term="${t.termId}"`);
      expect(compiled.html).toContain(`data-quantity-id="${t.quantityId}"`);
    }
    const plain = renderToString(latex, INLINE_KATEX);
    const mathml = (html: string) => html.slice(0, html.indexOf('<span class="katex-html"'));
    expect(mathml(compiled.html)).toBe(mathml(plain));
    // Inline, not a display.
    expect(compiled.html).not.toContain("katex-display");
  });

  test("a formula with refusals does not compile", () => {
    const r = resolveInlineTerms(
      "q",
      scope("mass-energy", "s0-p9", "s0"),
      contextFor("mass-energy"),
    );
    expect(() => compileInlineFormula(r)).toThrow("inline-terms-refused");
  });

  test("inline-terms-term-dropped: a render that loses a marked term is refused", () => {
    const r = resolveInlineTerms(
      "V",
      scope("mass-energy", "s0-p5", "s0"),
      contextFor("mass-energy"),
    );
    const dropping: typeof renderToString = (latex, options) =>
      renderToString(latex, options).replace(/ data-term="[^"]*"/g, "");
    expect(() => compileInlineFormula(r, dropping)).toThrow("inline-terms-term-dropped");
  });

  test("inline-terms-mathml-changed: a marked render whose MathML differs is refused", () => {
    const r = resolveInlineTerms(
      "V",
      scope("mass-energy", "s0-p5", "s0"),
      contextFor("mass-energy"),
    );
    // The marked render (the one that carries \\htmlData) comes back with different MathML.
    const altering: typeof renderToString = (latex, options) => {
      const html = renderToString(latex, options);
      return latex.includes("htmlData") ? html.replace("<mi>V</mi>", "<mi>W</mi>") : html;
    };
    expect(() => compileInlineFormula(r, altering)).toThrow("inline-terms-mathml-changed");
  });
});

describe("a formula that cannot be read into atoms", () => {
  test("inline-terms-unreadable: it is refused, naming its block", () => {
    const r = resolveInlineTerms(
      "{V",
      scope("mass-energy", "s0-p5", "s0"),
      contextFor("mass-energy"),
    );
    expect(r.problems.map((p) => p.code)).toEqual(["inline-terms-unreadable"]);
    expect(r.problems[0]?.message).toContain("s0-p5");
  });
});
