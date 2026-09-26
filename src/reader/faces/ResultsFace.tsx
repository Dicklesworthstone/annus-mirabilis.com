/**
 * The results face (am-read-results-face-uzh): a paper's numbered results as cards, in paper
 * order, with a section filter and a slot for the equation genealogy (am-eq-genealogy-hmm draws it;
 * this face only places it). With no genealogy supplied the slot is left out: a line naming a
 * pending task is not something a reader can use.
 */
import type { CompiledEquation } from "../../equations/viewTypes.ts";
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
  const sections = Array.from(new Set(cards.flatMap((c) => c.sectionAnchors))).sort();

  return (
    <div className="results-face" data-paper={paper}>
      {/* The quoted inline formulas as targets, on a paper drawn in colour (dispatch 272). */}
      <InlineTerms paper={paper} />
      {heading ? <h2>{heading}</h2> : null}
      {sections.length > 1 && (
        <nav className="results-face-filter" aria-label="Filter results by section">
          <ul>
            {sections.map((section) => (
              <li key={section}>
                <a href={`#section-${section}`}>{section}</a>
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
