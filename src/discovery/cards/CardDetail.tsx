import type { JSX } from "react";
import { isCardVerified, UNVERIFIED_RESEARCH_MARKER } from "./publicationGate.ts";
import { StatusLabel } from "./StatusLabel.tsx";
import type {
  CardBacklinks,
  KnowledgeCard,
  PremiseDate,
  PriorEvent,
  VerificationQueueItem,
} from "./types.ts";

export type CardDetailProps = Readonly<{
  card: KnowledgeCard;
  backlinks?: CardBacklinks | undefined;
  openQueueItems?: readonly VerificationQueueItem[] | undefined;
  className?: string | undefined;
}>;

/**
 * Formats a date object with event kind into human readable text.
 * E.g. "Published 1903", "Presented, January 1904", "Performed, 1827-05-12".
 */
export function formatEventDateLine(date: PremiseDate): string {
  const eventKindLabel = date.eventKind
    ? date.eventKind.charAt(0).toUpperCase() + date.eventKind.slice(1)
    : "Available";

  const raw = date.latest || date.earliest || String(date.latestYear);
  if (date.precision === "day" && raw.includes("-")) {
    return `${eventKindLabel}, ${raw}`;
  }
  if (date.precision === "month" && raw.includes("-")) {
    return `${eventKindLabel}, ${raw}`;
  }
  if (date.precision === "range") {
    return `${eventKindLabel}, ${date.earliest}–${date.latest}`;
  }
  return `${eventKindLabel} ${date.latestYear || raw}`;
}

export function formatPriorEventLine(prior: PriorEvent): string {
  const kind = prior.eventKind.charAt(0).toUpperCase() + prior.eventKind.slice(1);
  const raw = prior.latest || prior.earliest;
  return `${kind} ${raw}`;
}

/**
 * Detailed view of a Knowledge Card with the four canonical historical statement sections.
 */
export function CardDetail({
  card,
  backlinks,
  openQueueItems,
  className = "",
}: CardDetailProps): JSX.Element {
  const verified = isCardVerified(card);
  const dateLine = formatEventDateLine(card.date);

  return (
    <div
      id={`card-${card.id}`}
      className={`knowledge-card-detail p-6 rounded-lg border border-stone-300 bg-stone-50 dark:border-stone-700 dark:bg-stone-900 text-stone-900 dark:text-stone-100 ${className}`}
      data-card-id={card.id}
      data-status={card.status}
    >
      {/* Header with Title / Proposition and Status */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-1">
            Knowledge Card · #{card.id}
          </span>
          <h3 className="text-lg font-serif font-bold leading-snug">{card.proposition}</h3>
        </div>
        <StatusLabel status={card.status} admittedImport={card.admittedImport} />
      </div>

      {/* Proposition Limits if present */}
      {card.limits && (
        <div className="mb-4 text-sm text-stone-700 dark:text-stone-300 italic bg-stone-100 dark:bg-stone-800/60 p-3 rounded border border-stone-200 dark:border-stone-700">
          <span className="font-semibold not-italic">Limits: </span>
          {card.limits}
        </div>
      )}

      {/* Status Explanation / Parallel Work Basis / Admitted Import Explanation */}
      <div className="mb-5 text-sm p-3.5 rounded bg-stone-100/80 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800">
        <h4 className="font-semibold text-xs uppercase tracking-wide text-stone-600 dark:text-stone-400 mb-1">
          Historical Context
        </h4>
        {card.admittedImport ? (
          <p className="text-stone-800 dark:text-stone-200">
            {typeof card.admittedImport === "object" ? (
              <>
                Admitted 1905 import for journey{" "}
                <span className="font-mono font-medium">
                  {card.admittedImport.declaringJourney}
                </span>
                {card.admittedImport.provenance && ` (${card.admittedImport.provenance})`}.
                {card.admittedImport.anchor && (
                  <a
                    href={`#${card.admittedImport.anchor}`}
                    className="ml-1.5 underline text-amber-700 dark:text-amber-400"
                  >
                    View source passage
                  </a>
                )}
              </>
            ) : (
              "Admitted 1905 result imported with declared provenance."
            )}
          </p>
        ) : card.status === "parallel-work" ? (
          <p className="text-stone-800 dark:text-stone-200">
            This work appeared alongside or after Einstein’s 1905 paper and was not available to a
            1904 reader. {card.parallelWorkBasis}
          </p>
        ) : card.status === "available" ? (
          <p className="text-stone-800 dark:text-stone-200">
            Available in the published scientific literature or public proceedings prior to 1905.
          </p>
        ) : (
          <p className="text-stone-800 dark:text-stone-200">
            Later empirical or theoretical confirmation developed after 1905.
          </p>
        )}
      </div>

      {/* The Four Canonical Labeled Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Section 1: Available by */}
        <div className="p-3.5 rounded bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
            1. Available by
          </h4>
          <p className="font-medium text-sm text-stone-900 dark:text-stone-100">{dateLine}</p>
          {card.priorEvent && (
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
              <span className="font-semibold">Prior event: </span>
              {formatPriorEventLine(card.priorEvent)}
            </p>
          )}
          {card.relatedCardId && (
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
              <span className="font-semibold">Related card: </span>
              <a
                href={`#card-${card.relatedCardId}`}
                className="underline text-stone-800 dark:text-stone-200 hover:text-amber-600 font-mono"
              >
                #{card.relatedCardId}
              </a>
            </p>
          )}
        </div>

        {/* Section 2: What the paper itself cites or asserts */}
        <div className="p-3.5 rounded bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
            2. What the paper itself cites or asserts
          </h4>
          {card.paperCitesOrAsserts && card.paperCitesOrAsserts.length > 0 ? (
            <ul className="text-xs space-y-1 text-stone-800 dark:text-stone-200">
              {card.paperCitesOrAsserts.map((ref) => {
                const itemKey = `${ref.paper}-${ref.note ?? ""}-${ref.anchor ?? ""}`;
                return (
                  <li key={itemKey}>
                    <span className="font-medium">{ref.paper}: </span>
                    {ref.note || ref.ids?.join(", ") || "Cited in text"}
                    {ref.anchor && (
                      <a
                        href={`#${ref.anchor}`}
                        className="ml-1 underline text-amber-700 dark:text-amber-400"
                      >
                        [view]
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-stone-500 dark:text-stone-400 italic">
              No direct citation or assertion in the original 1905 paper text.
            </p>
          )}
        </div>

        {/* Section 3: Evidence that Einstein knew it (only when present) */}
        {card.claimsEinsteinKnew && card.einsteinKnowledgeEvidence && (
          <div className="p-3.5 rounded bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 md:col-span-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
              3. Evidence that Einstein knew it
            </h4>
            <ul className="text-xs space-y-1.5 text-stone-800 dark:text-stone-200 list-disc list-inside">
              {card.einsteinKnowledgeEvidence.map((ev) => {
                const itemKey =
                  typeof ev === "string"
                    ? ev
                    : typeof ev === "object" && ev !== null && "title" in ev
                      ? `${(ev as { title: string }).title}-${(ev as { locator?: string }).locator ?? ""}`
                      : JSON.stringify(ev);
                return (
                  <li key={itemKey}>
                    {typeof ev === "string"
                      ? ev
                      : typeof ev === "object" && ev !== null && "title" in ev
                        ? (ev as { title: string; locator?: string }).title +
                          ((ev as { locator?: string }).locator
                            ? ` (${(ev as { locator?: string }).locator})`
                            : "")
                        : JSON.stringify(ev)}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Section 4: Where this site uses it */}
        <div className="p-3.5 rounded bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 md:col-span-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
            4. Where this site uses it
          </h4>
          <div className="text-xs space-y-2 text-stone-800 dark:text-stone-200">
            {card.admittedStages && card.admittedStages.length > 0 && (
              <div>
                <span className="font-semibold text-stone-600 dark:text-stone-400">
                  Permitted discovery steps:{" "}
                </span>
                <span className="font-mono">{card.admittedStages.join(", ")}</span>
              </div>
            )}
            {backlinks && (
              <div className="space-y-1 text-stone-600 dark:text-stone-400">
                {backlinks.stageIds.length > 0 && (
                  <div>
                    <span className="font-semibold">Cited by stages: </span>
                    <span className="font-mono text-stone-800 dark:text-stone-200">
                      {backlinks.stageIds.join(", ")}
                    </span>
                  </div>
                )}
                {backlinks.deskObjectIds.length > 0 && (
                  <div>
                    <span className="font-semibold">Desk objects: </span>
                    <span className="font-mono text-stone-800 dark:text-stone-200">
                      {backlinks.deskObjectIds.join(", ")}
                    </span>
                  </div>
                )}
                {backlinks.timelineEntryIds.length > 0 && (
                  <div>
                    <span className="font-semibold">Timeline entries: </span>
                    <span className="font-mono text-stone-800 dark:text-stone-200">
                      {backlinks.timelineEntryIds.join(", ")}
                    </span>
                  </div>
                )}
                {backlinks.worldCheckIds.length > 0 && (
                  <div>
                    <span className="font-semibold">World checks: </span>
                    <span className="font-mono text-stone-800 dark:text-stone-200">
                      {backlinks.worldCheckIds.join(", ")}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sources as Printed */}
      {card.sources && card.sources.length > 0 && (
        <div className="mb-5 text-xs text-stone-700 dark:text-stone-300">
          <h4 className="font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">
            Primary Evidence & Sources
          </h4>
          <ul className="space-y-1 list-disc list-inside">
            {card.sources.map((src) => {
              const itemKey =
                typeof src === "string"
                  ? src
                  : typeof src === "object" && src !== null
                    ? `${(src as { title?: string }).title || ""}-${(src as { locator?: string }).locator || ""}-${(src as { date?: string }).date || ""}`
                    : JSON.stringify(src);
              return (
                <li key={itemKey} className="font-serif">
                  {typeof src === "string"
                    ? src
                    : typeof src === "object" && src !== null
                      ? `${(src as { title?: string }).title || ""}${(src as { locator?: string }).locator ? ` ${(src as { locator?: string }).locator}` : ""}${(src as { date?: string }).date ? ` (${(src as { date?: string }).date})` : ""}`
                      : JSON.stringify(src)}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Verification State / Awaiting Verification Summary */}
      <div className="pt-4 border-t border-stone-200 dark:border-stone-800 text-xs">
        {verified ? (
          <div className="text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded border border-emerald-200 dark:border-emerald-800/60">
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
              </svg>
              <span>Verified against original source</span>
            </div>
            <p className="text-stone-700 dark:text-stone-300">
              Verified by{" "}
              <span className="font-medium">{card.verification?.verifiedBy || card.verifier}</span>{" "}
              ({card.verification?.verifierKind || "human"}) on{" "}
              {card.verification?.date || card.dateVerified} via{" "}
              <span className="italic">{card.verification?.method || "library scan"}</span>.
            </p>
            {(card.verification?.evidenceLocator || card.evidenceLocator) && (
              <p className="font-mono text-stone-600 dark:text-stone-400 mt-0.5 truncate">
                Locator: {card.verification?.evidenceLocator || card.evidenceLocator}
              </p>
            )}
            {card.verification?.printedCitation && (
              <p className="text-stone-600 dark:text-stone-400 mt-0.5">
                Citation: {card.verification.printedCitation}
              </p>
            )}
          </div>
        ) : (
          <div className="text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 rounded border border-amber-200 dark:border-amber-800/60">
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z" />
              </svg>
              <span>Awaiting verification · {UNVERIFIED_RESEARCH_MARKER}</span>
            </div>
            {openQueueItems && openQueueItems.length > 0 ? (
              <div className="mt-2 space-y-1">
                <p className="font-semibold text-stone-700 dark:text-stone-300">
                  Open source verification questions:
                </p>
                <ul className="list-disc list-inside space-y-1 text-stone-600 dark:text-stone-400">
                  {openQueueItems.map((q) => (
                    <li key={q.id}>
                      <span className="font-mono text-stone-800 dark:text-stone-200">
                        [{q.id}]{" "}
                      </span>
                      {q.question} (consult: <span className="italic">{q.sourceToConsult}</span>)
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-stone-600 dark:text-stone-400 mt-1">
                Source verification pending library scan inspection.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
