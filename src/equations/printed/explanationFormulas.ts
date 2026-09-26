/**
 * AN EXPLANATION'S INLINE FORMULAS, FOR THE BUILD (dispatch 273).
 *
 * The explanation pages resolve each `\( … \)` of an argument's readings when they render
 * (src/reader/explanationInlines.ts). The build needs the same formulas beforehand, for two things
 * the page cannot compute:
 * - their quantities' colour slots. build-equations.ts admits them into the paper's inline views, the
 *   list the faces' inline formulas use (NavyKite, 41227), so a quantity is one colour on every page;
 * - the facts the inspector shows when a glyph is pinned (inlineQuantityFacts in paperInlines.ts).
 *
 * Same records, same scope, same context as the page: each argument's overview, full, steps and
 * margin readings, in the argument's paper and with its section as the anchor, resolved over the
 * printed concordance plus the modern readings (modernScope.ts). Only formulas that resolve with
 * something to colour are returned; the page renders the others plain until its paper is enforced.
 * Reads content/, so it is for scripts and tests, never a page bundle.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { splitInlineMath } from "../../content/inlineMath.ts";
import { loadConcordanceForPaper } from "../../content/notation/loader.ts";
import { isRegisteredQuantityId } from "../../content/quantities/registry.ts";
import { resolveInlineTerms } from "./inlineTerms.ts";
import { modernInlineEntries } from "./modernScope.ts";
import type { InlineQuantityUse } from "./paperInlines.ts";

export type ExplanationFormula = Readonly<{
  /** The argument and reading that write it ("arg-me-mass-change full"). */
  where: string;
  section: string;
  latex: string;
  terms: readonly Readonly<{ quantityId: string; glyph: string }>[];
}>;

export type ExplanationFormulas = Readonly<{
  paper: string;
  formulas: readonly ExplanationFormula[];
  /** Each bound quantity, with its glyphs and the scope of its first use, as the facts expect. */
  quantities: Readonly<Record<string, InlineQuantityUse>>;
}>;

const READINGS = ["overview", "full", "steps", "margin"] as const;

type Block = Readonly<{ kind: string; text?: string; items?: readonly string[] }>;
type ArgumentFile = Readonly<{
  id: string;
  section: string;
  readings?: Partial<Record<(typeof READINGS)[number], readonly Block[]>>;
}>;

/** The resolved formulas of one paper's argument readings, in file and reading order. */
export function explanationFormulas(root: string, paper: string): ExplanationFormulas {
  const dir = join(root, "content", "arguments", paper);
  const context = {
    concordance: modernInlineEntries(paper, loadConcordanceForPaper(paper)),
    isRegistered: isRegisteredQuantityId,
    exceptions: [],
  };
  const formulas: ExplanationFormula[] = [];
  const quantities: Record<
    string,
    { glyphs: string[]; scope: { anchor: string; section: string } }
  > = {};
  for (const file of readdirSync(dir)
    .filter((f) => f.startsWith("arg-") && f.endsWith(".json"))
    .sort()) {
    const argument = JSON.parse(readFileSync(join(dir, file), "utf8")) as ArgumentFile;
    for (const reading of READINGS)
      for (const block of argument.readings?.[reading] ?? []) {
        const texts =
          block.kind === "paragraph" && block.text
            ? [block.text]
            : block.kind === "steps"
              ? (block.items ?? [])
              : [];
        for (const text of texts)
          for (const segment of splitInlineMath(text)) {
            if (segment.kind === "text") continue;
            const where = `${argument.id} ${reading}`;
            const resolved = resolveInlineTerms(
              segment.value,
              { paper, where, anchor: argument.section, section: argument.section },
              context,
            );
            if (resolved.problems.length > 0 || resolved.terms.length === 0) continue;
            const terms = resolved.terms.map(({ quantityId, glyph }) => ({ quantityId, glyph }));
            formulas.push({ where, section: argument.section, latex: segment.value, terms });
            for (const { quantityId, glyph } of terms) {
              const use = quantities[quantityId];
              if (!use)
                quantities[quantityId] = {
                  glyphs: [glyph],
                  scope: { anchor: argument.section, section: argument.section },
                };
              else if (!use.glyphs.includes(glyph)) use.glyphs.push(glyph);
            }
          }
      }
  }
  return { paper, formulas, quantities };
}
