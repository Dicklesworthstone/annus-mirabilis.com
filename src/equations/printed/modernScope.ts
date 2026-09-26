/**
 * THE MODERN SCOPE FOR AN INLINE FORMULA (dispatch 273).
 *
 * resolveInlineTerms (inlineTerms.ts) binds each atom of a formula by the concordance's PRINTED
 * glyphs. An explanation or a laboratory also writes modern letters: c where Einstein prints V, γ,
 * the model records' m_{loss}. Measured on the built /papers/mass-energy/ page of b16bc66b: 25 of its
 * 54 distinct uncoloured formulas resolve on the printed concordance in § 0, and 39 with the readings
 * this module adds.
 *
 * `modernInlineEntries(paper, concordance)` returns the printed entries plus three kinds of reading.
 * Each is an entry the resolver reads like any other, and none is written anywhere:
 * - a rename's MODERN glyph, where it is one letter, with the rename's own scope and binding: c where
 *   the concordance renames V to c, and only in the sections where it does;
 * - each modern-only symbol the concordance lists (modernOnlySymbols), in its own scope;
 * - each one-letter glyph of the paper's teaching registry: the letters the model records draw
 *   their formulas with, which the explanations write too. A registry letter holds in every section
 *   EXCEPT those where a printed entry already reads that glyph: the printed concordance is the
 *   authority on its own letters (NavyKite and GreenOx, 41223 and 41227). Brownian prints x as a
 *   coordinate label for the whole paper, so the registry's x (positionCoordinate1d) is dropped
 *   there, where it used to make every ⟨x²⟩ in four labs ambiguous.
 *
 * A modern RENAME reading is NOT outranked. It comes from the concordance's own entry for its section,
 * and where it disagrees with a printed reading there the resolver refuses the formula as ambiguous:
 * relativity's printed c is a direction cosine in § 7, and its modern c (from V) the speed of light.
 * An explanation writing c there could mean either, and a wrong colour is worse than a refusal.
 */

import { normalizeSectionId } from "../../content/notation/resolve.ts";
import type {
  ConcordanceEntry,
  Glyph,
  PaperConcordance,
} from "../../content/schemas/concordance.ts";
import { glyphSignature } from "../latex/printedAtoms.ts";
import { teachingProfile } from "../teachingProfiles.ts";

/**
 * One letter: a Latin letter or a command, primes, and at most one subscript, which may be an
 * upright label (\mathrm{s}). The same shape as modernGlyphsFollowConcordance.test.ts's LETTER.
 */
const LETTER =
  /^(?:\\math[a-z]+\{[A-Za-z]\}|\\[A-Za-z]+|[A-Za-z])'*(?:_(?:\{[A-Za-z0-9]+\}|\{\\mathrm\{[A-Za-z]+\}\}|\\[A-Za-z]+|[A-Za-z0-9]))?'*$/;

/** Every section a paper can have, named one by one so a registry letter can leave some out. */
const SECTIONS: readonly string[] = Array.from({ length: 13 }, (_, i) => `s${i}`);

function signatureOf(latex: string): string | undefined {
  try {
    return glyphSignature(latex);
  } catch {
    // An expression (L/V^2) says nothing about one atom.
    return undefined;
  }
}

/**
 * Where a registry letter may be read: everywhere, less the sections a printed entry of the same
 * glyph reads. Undefined where a printed entry reads it paper-wide.
 */
function registryScope(
  latex: string,
  printed: readonly ConcordanceEntry[],
): readonly string[] | undefined {
  const signature = signatureOf(latex);
  const same = printed.filter((e) => signature && signatureOf(e.glyph.latex) === signature);
  if (same.some((e) => e.scope.includes("all"))) return undefined;
  const covered = new Set(same.flatMap((e) => e.scope.map(normalizeSectionId)));
  return covered.size === 0 ? ["all"] : SECTIONS.filter((s) => !covered.has(s));
}

function latexOf(glyph: Glyph | string | undefined): string | undefined {
  if (glyph === undefined) return undefined;
  return typeof glyph === "string" ? glyph : glyph.latex || undefined;
}

/** A reading that is not a printed glyph: it carries no plate and says where it came from. */
function reading(
  paper: string,
  id: string,
  scope: readonly string[],
  latex: string,
  binding: ConcordanceEntry["binding"],
  meaning: string,
  from: string,
): ConcordanceEntry {
  return {
    id,
    paper,
    scope,
    glyph: { unicode: latex, latex },
    meaning,
    binding,
    operation: { kind: "rename", target: { form: "symbol", modernGlyph: latex } },
    sources: { anchor: scope[0] ?? "all" },
    verification: { printed: false, checkedAgainst: from, by: "modernScope.ts", date: "" },
  };
}

/** The printed entries, then the modern readings the concordance and the registry imply. */
export function modernInlineEntries(
  paper: string,
  concordance: PaperConcordance,
): readonly ConcordanceEntry[] {
  const out: ConcordanceEntry[] = [...concordance.entries];
  for (const entry of concordance.entries) {
    if (entry.operation.kind !== "rename" || !("quantityId" in entry.binding)) continue;
    const target = entry.operation.target;
    const modern = latexOf("modernGlyph" in target ? target.modernGlyph : undefined);
    if (!modern || !LETTER.test(modern) || modern === entry.glyph.latex) continue;
    out.push(
      reading(
        paper,
        `${entry.id}#modern`,
        entry.scope,
        modern,
        entry.binding,
        `${entry.meaning} (modern notation)`,
        `the modern glyph of ${entry.id}`,
      ),
    );
  }
  for (const symbol of concordance.modernOnlySymbols ?? []) {
    const latex = latexOf(symbol.glyph);
    if (!latex || !LETTER.test(latex)) continue;
    out.push(
      reading(
        paper,
        `${symbol.id}#modern-only`,
        symbol.scope,
        latex,
        symbol.binding,
        symbol.label,
        `modernOnlySymbols (${symbol.introducedBy})`,
      ),
    );
  }
  for (const [quantityId, quantity] of Object.entries(teachingProfile(paper)?.quantities ?? {})) {
    if (!LETTER.test(quantity.glyph)) continue;
    const scope = registryScope(quantity.glyph, concordance.entries);
    if (!scope) continue;
    out.push(
      reading(
        paper,
        `registry.${quantityId}`,
        scope,
        quantity.glyph,
        { quantityId },
        quantity.name,
        "the paper's teaching registry (teachingProfiles.ts)",
      ),
    );
  }
  return out;
}
