import type { JSX } from "react";
import { CardDetail, formatEventDateLine } from "./CardDetail.tsx";
import { StatusLabel } from "./StatusLabel.tsx";
import type { CardBacklinks, KnowledgeCard, VerificationQueueItem } from "./types.ts";

export type KnowledgeCardProps = Readonly<{
  card: KnowledgeCard;
  backlinks?: CardBacklinks | undefined;
  openQueueItems?: readonly VerificationQueueItem[] | undefined;
  defaultExpanded?: boolean | undefined;
  className?: string | undefined;
}>;

/**
 * KnowledgeCard component.
 *
 * Renders a compact card summary that expands via native <details> into the full
 * CardDetail view, supporting keyboard navigation and JavaScript-disabled reading.
 */
export function KnowledgeCardView({
  card,
  backlinks,
  openQueueItems,
  defaultExpanded = false,
  className = "",
}: KnowledgeCardProps): JSX.Element {
  const dateLine = formatEventDateLine(card.date);

  return (
    <details
      className={className || undefined}
      style={{
        // The global details rule adds 20.8px of margin and 13.6px of padding, which put about
        // 50px of empty space between cards on the shelf.
        margin: 0,
        padding: 0,
        border: "1px solid var(--line)",
        borderRadius: "0.5rem",
        background: "var(--panel)",
      }}
      open={defaultExpanded ? true : undefined}
      id={`card-${card.id}`}
      data-card-id={card.id}
      data-status={card.status}
    >
      <summary
        style={{
          cursor: "pointer",
          padding: "0.75rem 1rem",
          userSelect: "none",
          borderRadius: "0.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
          outline: "none",
        }}
      >
        <div style={{ flex: 1, paddingRight: "0.5rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.25rem",
            }}
          >
            {/* The card's id stays as its anchor (id="card-..."), not as text a reader must read. */}
            <span
              style={{
                fontSize: "var(--type-fine)",
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
                color: "var(--muted)",
              }}
            >
              {dateLine}
            </span>
          </div>
          <p
            style={{
              fontSize: "var(--type-small)",
              fontFamily: "var(--font-serif)",
              fontWeight: 600,
              color: "var(--ink)",
              lineHeight: 1.35,
              margin: 0,
            }}
          >
            {card.proposition}
          </p>
        </div>
        {/*
          THE BADGE ROW MAY SHRINK; THE CHEVRON BELOW MAY NOT.

          flexShrink: 0 sat here and was the whole of /discover/brownian-motion/'s overflow: the
          page measured 556px at 320, 360 AND 390 alike, which is 236px past a phone. The intent
          was right at desktop - do not squash the status chip and the chevron - but this row
          holds a StatusLabel whose text is a sentence ("Parallel work: not available to a 1904
          reader", 285px), so forbidding it to shrink pins the whole document to that sentence's
          width.

          It was NOT an unbreakable token, which is what three earlier remedies assumed. Squeezed
          in place the row's min-content is 1px and the badge's is 22px: it could always shrink
          and was forbidden to. That is why min-width: 0 moved nothing - min-width was never the
          binding constraint, flex-shrink was.

          The chevron keeps flexShrink: 0 deliberately. An icon squashed to 3px is a different
          defect, and it is a flex item of fixed size rather than one carrying prose.
        */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            minWidth: 0,
            gap: "0.625rem",
          }}
        >
          <StatusLabel status={card.status} admittedImport={card.admittedImport} />
          <svg
            style={{
              width: "1rem",
              height: "1rem",
              color: "var(--muted)",
              flexShrink: 0,
            }}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </div>
      </summary>

      <div
        style={{
          borderTop: "1px solid var(--line)",
          padding: "0.5rem",
        }}
      >
        <CardDetail card={card} backlinks={backlinks} openQueueItems={openQueueItems} />
      </div>
    </details>
  );
}
