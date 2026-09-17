import type { JSX } from "react";
import { KnowledgeCardView } from "./KnowledgeCard.tsx";
import { StatusLabel } from "./StatusLabel.tsx";
import type { CardBacklinks, KnowledgeCard, VerificationQueueItem } from "./types.ts";

export const SHELF_DISCLAIMER_NOTE =
  "This list is a reconstruction aid assembled for learning, not a documentary history of what Einstein read.";

export type ShelfProps = Readonly<{
  cards: readonly KnowledgeCard[];
  backlinksMap?: ReadonlyMap<string, CardBacklinks> | undefined;
  queueItemsMap?: ReadonlyMap<string, readonly VerificationQueueItem[]> | undefined;
  title?: string | undefined;
  description?: string | undefined;
  className?: string | undefined;
}>;

/**
 * Sorts cards for the 1904 shelf view:
 * 1. date.earliest
 * 2. latestYear
 * 3. id (breaks ties deterministically)
 */
export function sortShelfCards(cards: readonly KnowledgeCard[]): readonly KnowledgeCard[] {
  return [...cards].sort((a, b) => {
    const earlyA = a.date.earliest || String(a.date.latestYear);
    const earlyB = b.date.earliest || String(b.date.latestYear);
    if (earlyA !== earlyB) {
      return earlyA.localeCompare(earlyB);
    }
    if (a.date.latestYear !== b.date.latestYear) {
      return a.date.latestYear - b.date.latestYear;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * Shelf component rendering the collection of dated 1904 knowledge cards for a discovery route.
 */
export function Shelf({
  cards,
  backlinksMap,
  queueItemsMap,
  title = "The 1904 Knowledge Shelf",
  description = "Premises, observations, and theoretical tools available to a researcher prior to 1905.",
  className = "",
}: ShelfProps): JSX.Element {
  // Filter out "later" cards (they are later evidence, not on the 1904 shelf)
  const shelfCards = sortShelfCards(cards.filter((c) => c.status !== "later"));

  return (
    <section
      className={`discovery-shelf my-8 p-6 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 ${className}`}
      aria-label={title}
    >
      <header className="mb-6">
        <span className="text-xs font-mono uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold block mb-1">
          Historical Shelf · Reconstruction Constraints
        </span>
        <h2 className="text-2xl font-serif font-bold text-stone-900 dark:text-stone-100">
          {title}
        </h2>
        <p className="text-sm text-stone-600 dark:text-stone-300 mt-1">{description}</p>

        {/* Required Pedagogical Disclaimer Note */}
        <div className="mt-3 text-xs text-stone-600 dark:text-stone-400 italic bg-amber-50/60 dark:bg-amber-950/30 p-2.5 rounded border border-amber-200/60 dark:border-amber-900/40">
          <span className="font-semibold not-italic text-amber-800 dark:text-amber-300">
            Editorial Note:{" "}
          </span>
          {SHELF_DISCLAIMER_NOTE}
        </div>

        {/* Status Legend */}
        <div className="mt-4 pt-3 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold text-stone-500 dark:text-stone-400">Legend:</span>
          <StatusLabel status="available" />
          <StatusLabel status="parallel-work" />
          <StatusLabel status="available" admittedImport={true} />
        </div>
      </header>

      {/* Card List */}
      <div className="space-y-3" data-testid="shelf-card-list">
        {shelfCards.length === 0 ? (
          <p className="text-sm text-stone-500 italic p-4 text-center">No cards on this shelf.</p>
        ) : (
          shelfCards.map((card) => {
            const cardBacklinks = backlinksMap?.get(card.id);
            const cardQueue = queueItemsMap?.get(card.id);
            return (
              <KnowledgeCardView
                key={card.id}
                card={card}
                backlinks={cardBacklinks}
                openQueueItems={cardQueue}
              />
            );
          })
        )}
      </div>
    </section>
  );
}
