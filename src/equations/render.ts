import { createHash } from "node:crypto";
import { renderToString } from "katex";
import type { ConcordanceEntry } from "../content/schemas/concordance.ts";
import { canonical, quantityBindings } from "./ast.ts";
import { expressionLatex } from "./latex.ts";
import { navigationTree } from "./navigation.ts";
import { type PrintedForm, printedForm } from "./notationForms.ts";
import { recordQuantities } from "./printedGlyphs.ts";
import type { QuantityRegistry } from "./quantities.ts";
import { type EquationRecord, parseEquationRecord } from "./record.ts";
import { layoutLatex } from "./rowLayout.ts";
import { teachingProfile } from "./teachingProfiles.ts";
import type { CompiledEquation } from "./viewTypes.ts";
/**
 * The concordance a record's printed form is read from, and the section its argument sits in: the
 * same letter can name different quantities in different sections.
 */
export type NotationContext = Readonly<{
  entries: readonly ConcordanceEntry[];
  section: string;
}>;

/** A letter as a sentence says it: gamma for \gamma, t′ for t'. */
const spoken = (latex: string): string => latex.replace(/^\\/, "").replace(/'/g, "′");

export function compileEquation(input: EquationRecord): CompiledEquation {
  return compile(input, undefined);
}

/**
 * The same compilation, with the record also drawn in Einstein's letters for the notation toggle.
 * A function of its own rather than a second parameter: `records.map(compileEquation)` passes the
 * index as a second argument.
 */
export function compileEquationWithNotation(
  input: EquationRecord,
  notation: NotationContext,
): CompiledEquation {
  return compile(input, notation);
}

function compile(input: EquationRecord, notation: NotationContext | undefined): CompiledEquation {
  const eq = parseEquationRecord(input, input.id),
    nav = navigationTree(eq.tree),
    allowed = new Set(nav.map((n) => n.id));
  const quantities = teachingProfile(eq.paper)!.quantities;
  // The formula prints the record's letters; the terms below keep the table's quantities, so a
  // printed letter never reaches the paper's colour map or a binding.
  const printed = recordQuantities(quantities, eq.printedGlyphs);
  // An authored layout (rowLayout.ts: "rows", "break", "terms") sets the formula on aligned rows;
  // without one, one line. The parser has already refused a layout the tree cannot take.
  const latexWith = (table: QuantityRegistry, components: Readonly<Record<string, string>>) => {
    const one = (e: typeof eq.tree, marked: boolean) =>
      expressionLatex(e, {
        registry: table,
        componentGlyphs: components,
        marked,
        strictConcordance: false,
      });
    return (withMarkers: boolean) =>
      layoutLatex(eq.layout, eq.tree, (e) => one(e, withMarkers), withMarkers) ??
      one(eq.tree, withMarkers);
  };
  const { html, mathml, plain } = draw(latexWith(printed, {}));
  const bindings = quantityBindings(eq.tree);
  // The legend shows the letter the formula prints, beside the quantity's canonical name.
  const printedGlyphHtml = eq.printedGlyphs
    ? Object.fromEntries(
        Object.entries(eq.printedGlyphs).map(([quantityId, glyph]) => [
          quantityId,
          glyphHtml(glyph),
        ]),
      )
    : undefined;
  const notationForm = notation
    ? einsteinsLetters(printedForm(eq.tree, printed, notation.entries, notation.section))
    : undefined;
  return {
    ...eq,
    ...(printedGlyphHtml ? { printedGlyphHtml } : {}),
    ...(notationForm ? { notationForm } : {}),
    html,
    mathml,
    plainLatex: plain,
    treeDigest: createHash("sha256").update(canonical(eq)).digest("hex"),
    navigation: nav,
    terms: bindings.map((t) => ({ ...t, quantity: quantities[t.quantityId]! })),
  };

  /**
   * The formula in Einstein's letters, drawn from the same tree, or the mark that it keeps today's
   * (notationForms.ts: a formula is never drawn half in each). Nothing when his letters are ours.
   */
  function einsteinsLetters(form: PrintedForm): CompiledEquation["notationForm"] {
    if (form.state === "modern") return { state: "modern" };
    const letters = Object.entries(form.letters);
    const components = Object.entries(form.components);
    if (letters.length === 0 && components.length === 0) return undefined;
    const drawn = draw(
      latexWith(
        recordQuantities(printed, Object.fromEntries(letters.map(([q, l]) => [q, l.latex]))),
        Object.fromEntries(components.map(([k, l]) => [k, l.latex])),
      ),
    );
    // The sentence names a letter the way the formula prints it; a phrase ("the Lorentz factor")
    // names no letter and stays.
    const letterOf = new Map(letters.map(([q, l]) => [q, l.latex]));
    const sentence = eq.sentence.map((f) => {
      const quantityId = f.nodeId
        ? bindings.find((b) => b.termId === f.nodeId)?.quantityId
        : undefined;
      const modern = quantityId ? printed[quantityId]?.glyph : undefined;
      const einstein = quantityId ? letterOf.get(quantityId) : undefined;
      return modern !== undefined && einstein !== undefined && f.text === spoken(modern)
        ? { ...f, text: spoken(einstein) }
        : f;
    });
    // One legend glyph per quantity: its letter, or the letters of the components Einstein
    // printed separately (Y, N).
    const legendLetters = new Map<string, string[]>(letters.map(([q, l]) => [q, [l.latex]]));
    for (const [key, l] of components) {
      const quantityId = key.slice(0, key.indexOf("#"));
      legendLetters.set(quantityId, [...(legendLetters.get(quantityId) ?? []), l.latex]);
    }
    return {
      state: "printed",
      html: drawn.html,
      mathml: drawn.mathml,
      plainLatex: drawn.plain,
      sentence,
      glyphHtml: Object.fromEntries(
        [...legendLetters].map(([q, ls]) => [q, glyphHtml(ls.join(",\\ "))]),
      ),
    };
  }

  function draw(latex: (withMarkers: boolean) => string) {
    const plain = latex(false),
      marked = latex(true);
    const html = renderToString(marked, {
      displayMode: true,
      output: "html",
      throwOnError: true,
      maxExpand: 1000,
      maxSize: 20,
      strict: (code: string) => (code === "htmlExtension" ? "ignore" : "error"),
      trust: (context) => {
        if (context.command === "\\htmlClass")
          return ["am-role-input", "am-role-result", "am-role-constant"].includes(
            String(context.class),
          );
        if (context.command !== "\\htmlData") return false;
        const attributes = context.attributes as Record<string, string>;
        return (
          Object.keys(attributes).length === 1 &&
          Object.entries(attributes).every(
            ([key, value]) =>
              ["data-term", "data-op"].includes(key) &&
              allowed.has(value) &&
              nav.some(
                (n) => n.id === value && (n.kind === "term" ? "data-term" : "data-op") === key,
              ),
          )
        );
      },
    });
    // KaTeX formats an untrusted HTML command as unsupported text instead of throwing.
    // Do not let a trust-policy mismatch silently publish a non-interactive formula.
    for (const n of nav) {
      const marker = `data-${n.kind === "term" ? "term" : "op"}="${n.id}"`;
      if (!html.includes(marker)) throw new Error(`Equation rendering omitted ${n.id}.`);
    }
    const mathml = renderToString(plain, {
      displayMode: true,
      output: "mathml",
      throwOnError: true,
      strict: "error",
      trust: false,
      maxExpand: 1000,
      maxSize: 20,
    });
    return { html, mathml, plain };
  }
}

/** A legend glyph, rendered at build time so the reader ships no KaTeX. */
function glyphHtml(glyph: string): string {
  return renderToString(glyph, {
    output: "html",
    throwOnError: true,
    strict: "error",
    trust: false,
    maxExpand: 100,
    maxSize: 10,
  });
}
