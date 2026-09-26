/**
 * THE TERM INSPECTOR'S FACTS (dispatch 144 unit c): what a reader is told about one quantity of a
 * formula once they pin it. Its name and symbol, what it does in this formula (the authored note on
 * its term), its unit and dimension in reader's type, and whether a laboratory computes it.
 *
 * Plain data and string work, no React and no colour map, so the explorer can import it without
 * adding the paper's quantities to the first-route JavaScript.
 *
 * EXACT IDS. A quantity's notes and its lab are found by quantity id equality, and a term's glyph
 * by its whole data-term attribute, quotes included: the term speed must never find speedOfLight's
 * span, nor frequency find frequencyEnergyDensity's note.
 */
import type { Quantity } from "./quantities.ts";
import type { CompiledEquation } from "./viewTypes.ts";

/** Basis order of every dimension vector here: src/content/dimensions/rational.ts. */
const BASES = ["length", "mass", "time", "temperature", "current", "amount"] as const;

const SUPERSCRIPT: Readonly<Record<string, string>> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "-": "⁻",
};

/**
 * An exponent as a reader sees it: an integer raised, "²" or "⁻¹". A fraction is written ^(1/2),
 * because no face the site ships draws a raised slash (componentGlyphCoverage.test.ts).
 */
function exponentText(exponent: string): string {
  if (/^-?\d+$/.test(exponent)) return [...exponent].map((c) => SUPERSCRIPT[c] ?? c).join("");
  return `^(${exponent.replace("-", "\u2212")})`;
}

/** Said once, for a unit and for a dimension alike, so a pure number reads the same in both rows. */
export const PURE_NUMBER = "none: a pure number";

/**
 * A dimension vector in words, "length² × time⁻¹". Exponents are the record's exact strings, so a
 * root keeps its fraction ("length^(1/2)") and nothing is rounded. All zero is a pure number.
 */
export function dimensionText(dimension: readonly string[]): string {
  const parts = BASES.flatMap((base, i) => {
    const exponent = (dimension[i] ?? "0").trim();
    if (/^-?0+$/.test(exponent)) return [];
    return [exponent === "1" ? base : `${base}${exponentText(exponent)}`];
  });
  return parts.length > 0 ? parts.join(" × ") : PURE_NUMBER;
}

/**
 * A display unit as a reader expects to see it: "m^2" is m², "J s^4 m^-3" is J·s⁴·m⁻³, "Pa*s" is
 * Pa·s. The unit 1 is a pure number. Symbols are never renamed, only their powers raised.
 */
export function unitText(displayUnit: string): string {
  const unit = displayUnit.trim();
  if (unit === "1" || unit === "") return PURE_NUMBER;
  return unit
    .replace(/\^\(?(-?\d+(?:\/\d+)?)\)?/g, (_, exponent: string) => exponentText(exponent))
    .replace(/\s*\*\s*/g, "·")
    .replace(/ +/g, "·");
}

export type TermRole = Readonly<{ title: string; explanation: string }>;

/**
 * What the quantity does in these records: the note on each of its terms, each distinct note once,
 * in the order the terms appear. Every one of the 625 quantity-in-equation pairs in the six
 * generated files had such a note when measured on 2026-09-24; one without gives an empty list.
 */
export function termRoles(
  equations: readonly Pick<CompiledEquation, "terms" | "notes">[],
  quantityId: string,
): readonly TermRole[] {
  const roles: TermRole[] = [];
  for (const equation of equations)
    for (const term of equation.terms) {
      if (term.quantityId !== quantityId) continue;
      const note = equation.notes.find((n) => n.nodeId === term.termId);
      if (!note) continue;
      if (roles.some((r) => r.title === note.title && r.explanation === note.explanation)) continue;
      roles.push({ title: note.title, explanation: note.explanation });
    }
  return roles;
}

/** The laboratory whose accepted snapshot a named record binds to this quantity, if any. */
export function computingLab(
  equations: readonly Pick<CompiledEquation, "bindings">[],
  quantityId: string,
): string | undefined {
  for (const equation of equations)
    for (const binding of equation.bindings)
      if (binding.quantityId === quantityId) return binding.experimentId;
  return undefined;
}

/** The dimension line where the registry says the paper gives the quantity none (dispatch 250). */
export const DIMENSION_OPEN_IN_SOURCE = "the paper leaves its dimension open";
/** The dimension line for a quantity whose dimension is that of whichever coordinate it is. */
export const DIMENSION_STATE_DEPENDENT = "none fixed: it depends on the coordinates chosen";

/** One reading of a printed letter in its passage, from the notation concordance (dispatch 250). */
export type TermNotation = Readonly<{
  meaning: string;
  /** The modern symbol, drawn at build time, where the concordance renames the printed one. */
  modernHtml?: string | undefined;
  /** Where the first use opens (firstUseTargets.ts); absent where no page carries it. */
  firstUseHref?: string | undefined;
  /** The printed page of the first use. */
  firstUsePage?: number | undefined;
}>;

export type TermFacts = Readonly<{
  roles: readonly TermRole[];
  /** Absent only where no record gives the quantity a display unit (a registry fallback). */
  unit?: string | undefined;
  dimension: string;
  /** Set where a named record binds the quantity to a laboratory: that laboratory's id. */
  lab?: string | undefined;
  /**
   * Set only where no model record linked to the display names the quantity (dispatch 250): what
   * the quantity is, in a reader's words (content/reader-descriptions/quantities.yaml).
   */
  about?: string | undefined;
  /** Set with `about`: what each printed letter for the quantity means in this passage. */
  notation?: readonly TermNotation[] | undefined;
}>;

/** Everything the inspector says about one quantity across the records of one formula. */
export function termFacts(
  equations: readonly Pick<CompiledEquation, "terms" | "notes" | "bindings">[],
  quantity: Pick<Quantity, "id" | "displayUnit" | "dimension">,
): TermFacts {
  const lab = computingLab(equations, quantity.id);
  return {
    roles: termRoles(equations, quantity.id),
    unit: unitText(quantity.displayUnit),
    dimension: dimensionText(quantity.dimension),
    ...(lab ? { lab } : {}),
  };
}

/**
 * The rendered glyph of one term, cut from its formula's KaTeX HTML: the contents of the element
 * whose data-term is exactly termId. KaTeX's trailing space after the symbol is dropped. Absent
 * where the formula has no such term.
 */
export function termGlyphHtml(html: string, termId: string): string | undefined {
  const attribute = `data-term="${termId}"`;
  const at = html.indexOf(attribute);
  if (at < 0) return undefined;
  const open = html.lastIndexOf("<", at);
  const start = html.indexOf(">", at) + 1;
  if (open < 0 || start === 0) return undefined;
  const tag = /^<([a-z]+)/.exec(html.slice(open))?.[1];
  if (!tag) return undefined;
  const pattern = new RegExp(`<${tag}\\b|</${tag}>`, "g");
  pattern.lastIndex = start;
  let depth = 1;
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0)
      return html
        .slice(start, match.index)
        .replace(/<span class="mspace"[^>]*><\/span>(?=(?:<\/span>)*$)/, "");
  }
  return undefined;
}
