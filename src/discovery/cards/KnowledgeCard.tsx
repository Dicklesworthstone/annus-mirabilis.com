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
      className={`knowledge-card group border border-stone-200 dark:border-stone-800 rounded-lg bg-white dark:bg-stone-900 shadow-sm transition-colors duration-150 ${className}`}
      open={defaultExpanded ? true : undefined}
      id={`card-${card.id}`}
      data-card-id={card.id}
      data-status={card.status}
    >
      <summary className="cursor-pointer p-4 select-none hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
        <div className="flex-1 pr-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-medium text-stone-500 dark:text-stone-400">
              {dateLine}
            </span>
            <span className="text-xs font-mono text-stone-400 dark:text-stone-500">
              · #{card.id}
            </span>
          </div>
          <p className="text-sm font-serif font-semibold text-stone-900 dark:text-stone-100 leading-snug">
            {card.proposition}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <StatusLabel status={card.status} admittedImport={card.admittedImport} />
          <svg
            className="w-4 h-4 text-stone-400 group-open:rotate-180 transition-transform duration-200"
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

      <div className="border-t border-stone-200 dark:border-stone-800 p-2">
        <CardDetail card={card} backlinks={backlinks} openQueueItems={openQueueItems} />
      </div>
    </details>
  );
}
