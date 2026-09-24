/**
 * WHERE A DANGEROUS LETTER IS FIRST MET IN THE EXPLANATION (am-read-perspective-toggle-abd).
 *
 * AGENTS.md: the two dangerous collisions, Einstein's beta (the modern gamma) and paper 2's k (the
 * viscosity, not Boltzmann's constant), are called out in red on first use. The concordance marks
 * them `collision.severity: danger` and lists, section by section, where each is first used in the
 * paper (`firstUseBySection`). The explanation face follows the same sections: in each one, the
 * first passage whose formulas bind the quantity carries the callout. A section with no such
 * passage gets none, rather than one pinned to a passage that never shows the letter.
 *
 * The callout is about the paper's letter, so it shows in both notation states.
 */
import { scopeMatches } from "../content/notation/resolve.ts";
import type { ConcordanceEntry } from "../content/schemas/concordance.ts";

type Passage = Readonly<{ id: string; section: string }>;

/**
 * The two collisions AGENTS.md names for a red callout: Einstein's beta in paper 3 (the modern
 * gamma) and his k in paper 2 (the viscosity). The concordance marks more entries "danger"; their
 * notes are written for the notation page, and one joins here only once its notes are worded for a
 * reader meeting the letter in the middle of an argument.
 */
export const FIRST_USE_CALLOUTS: ReadonlySet<string> = new Set([
  "sr.beta.lorentzFactor",
  "bm.k.viscosity",
]);

/**
 * Argument id to the danger entries whose callout it carries, for `passages` in reading order.
 * `quantitiesOf` names the quantities a passage's formulas bind.
 */
export function firstUseCallouts(
  entries: readonly ConcordanceEntry[],
  passages: readonly Passage[],
  quantitiesOf: (argumentId: string) => ReadonlySet<string>,
): ReadonlyMap<string, readonly ConcordanceEntry[]> {
  const out = new Map<string, ConcordanceEntry[]>();
  for (const entry of entries) {
    if (!FIRST_USE_CALLOUTS.has(entry.id) || entry.collision?.severity !== "danger") continue;
    if (!("quantityId" in entry.binding)) continue;
    const quantityId = entry.binding.quantityId;
    for (const { sectionId } of entry.collision.firstUseBySection) {
      const first = passages.find(
        (p) =>
          scopeMatches([sectionId], p.section, p.section) && quantitiesOf(p.id).has(quantityId),
      );
      if (first) out.set(first.id, [...(out.get(first.id) ?? []), entry]);
    }
  }
  return out;
}
