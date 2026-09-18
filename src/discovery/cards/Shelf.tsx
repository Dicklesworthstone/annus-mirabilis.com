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
      className={className || undefined}
      style={{
        margin: "2rem 0",
        padding: "1.5rem",
        borderRadius: "0.75rem",
        border: "1px solid var(--line)",
        background: "var(--wash)",
      }}
      aria-label={title}
    >
      <header style={{ marginBottom: "1.5rem" }}>
        <span
          className="eyebrow"
          style={{
            fontSize: "0.75rem",
            fontFamily: "var(--font-mono, monospace)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--accent)",
            fontWeight: 600,
            display: "block",
            marginBottom: "0.25rem",
          }}
        >
          Historical Shelf · Reconstruction Constraints
        </span>
        <h2
          style={{
            fontSize: "1.5rem",
            fontFamily: "var(--font-serif)",
            fontWeight: "bold",
            color: "var(--ink)",
            margin: "0.25rem 0",
          }}
        >
          {title}
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
          {description}
        </p>

        {/* Required Pedagogical Disclaimer Note */}
        <div
          style={{
            marginTop: "0.75rem",
            fontSize: "0.75rem",
            color: "var(--ink)",
            fontStyle: "italic",
            background: "var(--panel)",
            padding: "0.625rem",
            borderRadius: "0.25rem",
            border: "1px solid var(--line)",
          }}
        >
          <span style={{ fontWeight: 600, fontStyle: "normal", color: "var(--accent)" }}>
            Editorial Note:{" "}
          </span>
          {SHELF_DISCLAIMER_NOTE}
        </div>

        {/* Status Legend */}
        <div
          style={{
            marginTop: "1rem",
            paddingTop: "0.75rem",
            borderTop: "1px solid var(--line)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.75rem",
            fontSize: "0.75rem",
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--muted)" }}>Legend:</span>
          <StatusLabel status="available" />
          <StatusLabel status="parallel-work" />
          <StatusLabel status="available" admittedImport={true} />
        </div>
      </header>

      {/* Card List */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
        data-testid="shelf-card-list"
      >
        {shelfCards.length === 0 ? (
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--muted)",
              fontStyle: "italic",
              padding: "1rem",
              textAlign: "center",
            }}
          >
            No cards on this shelf.
          </p>
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
