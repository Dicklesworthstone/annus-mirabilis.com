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
          padding: "1rem",
          userSelect: "none",
          borderRadius: "0.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
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
            <span
              style={{
                fontSize: "0.75rem",
                fontFamily: "var(--font-mono, monospace)",
                fontWeight: 500,
                color: "var(--muted)",
              }}
            >
              {dateLine}
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                fontFamily: "var(--font-mono, monospace)",
                color: "var(--muted)",
              }}
            >
              · #{card.id}
            </span>
          </div>
          <p
            style={{
              fontSize: "0.875rem",
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            flexShrink: 0,
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
