/**
 * The results face (am-read-results-face-uzh): a paper's numbered results as cards, in paper
 * order, with a section filter and a reserved slot for the equation genealogy
 * (am-eq-genealogy-hmm draws it; this face only reserves the section and renders nothing there
 * itself).
 */
import { ResultCard } from "./results/ResultCard.tsx";
import type { ResultCard as ResultCardData } from "./results/types.ts";

export function ResultsFace({
  paper,
  cards,
  genealogy,
}: {
  paper: string;
  cards: readonly ResultCardData[];
  /** Supplied by the genealogy bead once it lands; this face never draws it itself. */
  genealogy?: React.ReactNode;
}) {
  const sections = Array.from(new Set(cards.flatMap((c) => c.sectionAnchors))).sort();

  return (
    <div className="results-face" data-paper={paper}>
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
          <ResultCard key={card.resultId} card={card} />
        ))}
      </div>

      <section
        className="results-face-genealogy"
        aria-label="Equation genealogy"
        data-genealogy-slot="true"
      >
        {genealogy ?? <p className="fine">Equation genealogy pending am-eq-genealogy-hmm.</p>}
      </section>
    </div>
  );
}
