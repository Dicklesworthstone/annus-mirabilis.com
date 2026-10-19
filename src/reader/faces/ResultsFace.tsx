/**
 * The results face (am-read-results-face-uzh): a paper's numbered results as cards, in paper
 * order, with a section filter and a slot for the equation genealogy (am-eq-genealogy-hmm draws it;
 * this face only places it). With no genealogy supplied the slot is left out: a line naming a
 * pending task is not something a reader can use.
 */
import type { CompiledEquation } from "../../equations/viewTypes.ts";
import { ExplainerFragments } from "./ExplainerFragments.tsx";
import { InlineTerms } from "./InlineTerms.tsx";
import { ResultCard } from "./results/ResultCard.tsx";
import type { ResultCard as ResultCardData } from "./results/types.ts";

export function ResultsFace({
  paper,
  cards,
  equations,
  genealogy,
  heading,
}: {
  paper: string;
  /** A level-two heading over the cards, when the page has other sections beside them. */
  heading?: string | undefined;
  cards: readonly ResultCardData[];
  /** The paper's compiled equations by id, for each card's modern layer. */
  equations?: ReadonlyMap<string, CompiledEquation> | undefined;
  /** Supplied by the genealogy bead once it lands; this face never draws it itself. */
  genealogy?: React.ReactNode;
}) {
  /**
   * THE SECTION FILTER'S LINKS LANDED NOWHERE, on all three results faces that render one.
   *
   * It emitted `href="#section-${section}"` and nothing on the page carries such an id: not the
   * cards, which carry `id="result-${resultId}"`, and not any wrapper. Measured 2026-10-18 over
   * the built site, 24 of the 20,830 internal fragment links that resolve were broken and all 24
   * were these. `#section-<n>` is in neither anchor grammar, AGENTS.md's nor docs/CONTENT_IDS.md's,
   * so there was never a target to write. A reader pressing "s4" stayed at the top of the page,
   * which is how a dead fragment fails: it returns 200 and looks like a working control.
   *
   * Each link now lands on the FIRST CARD of its section, by that card's own `#result-<id>`. That
   * anchor exists by construction, because the link is built from the card that defines it, and the
   * reader arrives where the section's results begin.
   *
   * THE ORDER WAS LEXICOGRAPHIC, which put `s10` between `s1` and `s2`: the relativity face's nav
   * read s0, s1, s10, s2, s3 ... Sections are numbered, so they sort by number, with a stable
   * fallback for an anchor that is not `s<n>` (a part heading, say) rather than a surprise.
   */
  const firstCardOf = new Map<string, string>();
  for (const card of cards) {
    for (const section of card.sectionAnchors) {
      if (!firstCardOf.has(section)) firstCardOf.set(section, card.resultId);
    }
  }
  const sectionNumber = (anchor: string): number => {
    const numbered = anchor.match(/^s(\d+)$/);
    return numbered?.[1] === undefined ? Number.MAX_SAFE_INTEGER : Number.parseInt(numbered[1], 10);
  };
  const sections = [...firstCardOf.entries()].sort(
    ([a], [b]) => sectionNumber(a) - sectionNumber(b) || a.localeCompare(b),
  );

  return (
    <div className="results-face" data-paper={paper}>
      {/* The quoted inline formulas as targets, on a paper drawn in colour (dispatch 272). */}
      <InlineTerms paper={paper} />
      {/* The panels' levels, fetched when a reader first opens one (dispatch 292). */}
      <ExplainerFragments />
      {heading ? <h2>{heading}</h2> : null}
      {sections.length > 1 && (
        <nav className="results-face-filter" aria-label="Filter results by section">
          <ul>
            {sections.map(([section, firstResultId]) => (
              <li key={section}>
                <a href={`#result-${firstResultId}`}>{section}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="results-face-cards">
        {cards.map((card) => (
          <ResultCard key={card.resultId} card={card} equations={equations} />
        ))}
      </div>

      {genealogy ? (
        <section
          className="results-face-genealogy"
          aria-label="Equation genealogy"
          data-genealogy-slot="true"
        >
          {genealogy}
        </section>
      ) : null}
    </div>
  );
}
