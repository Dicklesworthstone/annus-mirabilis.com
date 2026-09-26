/**
 * WHAT THE INSPECTOR SAYS WHERE NO MODEL RECORD IS LINKED (dispatch 250; the owner asked for the
 * printed equations to be interactive "like classic-patents.com", where every term explains itself).
 *
 * A printed display's inspector used to open only for quantities named by the model equation
 * records its display is linked to (content/bindings/<paper>.yaml): 309 of the 1,134 printed terms,
 * measured 2026-09-26. Every other term now gets the same inspector, filled from sources that exist
 * for it:
 *   - the quantity registry (content/quantities/): its dimension, or what the paper leaves open;
 *   - its reader description (content/reader-descriptions/quantities.yaml): what it is;
 *   - the explanation's quantity tables (src/equations/*Quantities.ts): its display unit, where
 *     one of the four papers' tables holds it, as the linked path's records do;
 *   - the notation concordance, in the display's own scope: what each printed letter for it means
 *     there, the modern symbol where that differs, and the first use.
 * Nothing is invented. There is no value line of its own: SymbolicValue says the term is symbolic.
 */
import { renderToString } from "katex";
import type { Quantity as RegistryQuantity } from "../../content/schemas/argument.ts";
import type { ConcordanceEntry } from "../../content/schemas/concordance.ts";
import { glyphSignature } from "../latex/printedAtoms.ts";
import { LIGHT_QUANTA_QUANTITIES } from "../lightQuantaQuantities.ts";
import { MASS_ENERGY_QUANTITIES } from "../massEnergyQuantities.ts";
import { BROWNIAN_QUANTITIES, type QuantityRegistry } from "../quantities.ts";
import { SPECIAL_RELATIVITY_QUANTITIES } from "../specialRelativityQuantities.ts";
import {
  DIMENSION_OPEN_IN_SOURCE,
  DIMENSION_STATE_DEPENDENT,
  dimensionText,
  type TermFacts,
  type TermNotation,
  unitText,
} from "../termFacts.ts";
import { concordanceBinding, type DisplayOccurrence } from "./displayTerms.ts";

/** Each paper's explanation table, the source of the linked path's units too. */
const PAPER_TABLES: Readonly<Record<string, QuantityRegistry>> = Object.freeze({
  "brownian-motion": BROWNIAN_QUANTITIES,
  "light-quanta": LIGHT_QUANTA_QUANTITIES,
  "mass-energy": MASS_ENERGY_QUANTITIES,
  "special-relativity": SPECIAL_RELATIVITY_QUANTITIES,
});

/**
 * The quantity's display unit as a reader sees it: from the display's own paper's table, else from
 * another paper's (an id means the same quantity everywhere), else none.
 */
export function fallbackUnit(paper: string, quantityId: string): string | undefined {
  const own = PAPER_TABLES[paper]?.[quantityId];
  const any = own ?? Object.values(PAPER_TABLES).find((t) => t[quantityId])?.[quantityId];
  return any ? unitText(any.displayUnit) : undefined;
}

/** The registry's dimension in words, or the line that says why there is none. */
export function fallbackDimension(
  quantity: Pick<RegistryQuantity, "dimensionStatus" | "dimension">,
): string {
  if (quantity.dimensionStatus === "undefined-in-source") return DIMENSION_OPEN_IN_SOURCE;
  if (quantity.dimensionStatus === "state-dependent" || !quantity.dimension)
    return DIMENSION_STATE_DEPENDENT;
  return dimensionText(
    quantity.dimension.map(({ num, den }) => (den === 1 ? String(num) : `${num}/${den}`)),
  );
}

/** A modern symbol, drawn at build time with MathML beside it, so a screen reader can say it. */
function modernHtml(latex: string): string {
  return renderToString(latex, {
    output: "htmlAndMathml",
    throwOnError: true,
    strict: "warn",
    trust: false,
    maxExpand: 100,
    maxSize: 10,
  });
}

/** The modern glyph an entry renames its printed letter to, where it names one that differs. */
function renamedTo(entry: ConcordanceEntry): string | undefined {
  if (entry.operation.kind !== "rename") return undefined;
  const target = entry.operation.target as { form?: string; modernGlyph?: unknown };
  if (target.form !== "symbol" && target.form !== "group") return undefined;
  const glyph = target.modernGlyph;
  const latex =
    typeof glyph === "string"
      ? glyph
      : glyph && typeof glyph === "object"
        ? ((glyph as { latex?: string }).latex ?? (glyph as { unicode?: string }).unicode)
        : undefined;
  const bare = (s: string) => s.replace(/\s+/g, "");
  return latex && bare(latex) !== bare(entry.glyph.latex) ? latex : undefined;
}

/**
 * What the concordance says about each printed letter bound to the quantity in this display, once
 * per entry: only an entry that holds in the display's scope and binds this very quantity counts
 * (concordanceBinding's rule, which the display-terms check already enforces against conflicts).
 */
export function notationFor(
  entries: readonly ConcordanceEntry[],
  glyphs: readonly string[],
  quantityId: string,
  scope: Pick<DisplayOccurrence, "anchor" | "section"> | undefined,
  firstUse: ((paper: string, anchor: string) => string | null) | undefined,
): readonly TermNotation[] {
  if (!scope) return [];
  // An entry the edition does not print is left out, as the notation page leaves it out.
  const printed = entries.filter((e) => e.verification?.printed !== false);
  const seen = new Set<string>();
  const out: TermNotation[] = [];
  for (const glyph of glyphs) {
    const opinion = concordanceBinding(printed, glyphSignature(glyph), scope);
    if (!opinion || opinion.binds !== quantityId || seen.has(opinion.id)) continue;
    seen.add(opinion.id);
    const entry = printed.find((e) => e.id === opinion.id);
    if (!entry) continue;
    const modern = renamedTo(entry);
    const href = firstUse?.(entry.paper, entry.sources.anchor) ?? undefined;
    const page = entry.sources.facsimilePage;
    out.push({
      meaning: entry.meaning,
      ...(modern ? { modernHtml: modernHtml(modern) } : {}),
      ...(href ? { firstUseHref: href } : {}),
      ...(typeof page === "number" ? { firstUsePage: page } : {}),
    });
  }
  return out;
}

/** The inspector's facts for a printed term that no linked model record names. */
export function fallbackTermFacts(
  input: Readonly<{
    paper: string;
    quantity: Pick<RegistryQuantity, "id" | "dimensionStatus" | "dimension">;
    about: string | undefined;
    notation: readonly TermNotation[];
  }>,
): TermFacts {
  const unit = fallbackUnit(input.paper, input.quantity.id);
  return {
    roles: [],
    ...(unit ? { unit } : {}),
    dimension: fallbackDimension(input.quantity),
    ...(input.about ? { about: input.about } : {}),
    notation: input.notation,
  };
}
