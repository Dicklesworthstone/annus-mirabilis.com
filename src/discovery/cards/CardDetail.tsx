import type { CSSProperties, JSX } from "react";
import { isCardVerified } from "./publicationGate.ts";
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
  /** Accepted and not shown: open verification questions are the audit trail's, not reader copy. */
  openQueueItems?: readonly VerificationQueueItem[] | undefined;
  /** The card `card.relatedCardId` names, when the caller holds it, so the link can say what it is. */
  relatedCard?: KnowledgeCard | undefined;
  /**
   * Whether this view carries the card's `card-<id>` anchor. KnowledgeCardView already puts that id
   * on its <details> and renders this view inside it, so every card on a shelf put the same id in
   * the page twice (9 duplicates on the Brownian route, BUILD 9b). Nested, it passes false.
   */
  anchored?: boolean | undefined;
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

/** The names the rest of the site uses for the papers, for a citation recorded by slug. */
const PAPER_NAMES: Readonly<Record<string, string>> = {
  "light-quanta": "The light-quanta paper",
  "brownian-motion": "The Brownian paper",
  "special-relativity": "The relativity paper",
  "mass-energy": "The mass-energy paper",
};

/**
 * "stage-03" is step 3 of the route: each route's steps are numbered "01 / ..." and every shelf's
 * stage numbers were checked against them (Wien's law at step 4 of light quanta, Lorentz at step
 * 7 of relativity, the June 1905 import at step 3 of mass-energy, which the page says in words).
 * Ids that do not have that form are shown as they are.
 */
export function stepsLine(stages: readonly string[]): string {
  const steps = stages.map((stage) => /^stage-(\d+)$/.exec(stage)?.[1]);
  if (steps.some((step) => step === undefined)) return stages.join(", ");
  const numbers = steps.map(Number);
  if (numbers.length === 1) return `Step ${numbers[0]} of this route`;
  return `Steps ${numbers.slice(0, -1).join(", ")} and ${numbers.at(-1)} of this route`;
}

/**
 * Detailed view of a Knowledge Card with the four canonical historical statement sections.
 */
export function CardDetail({
  card,
  backlinks,
  relatedCard,
  anchored = true,
  className = "",
}: CardDetailProps): JSX.Element {
  const verified = isCardVerified(card);
  const locator = card.verification?.evidenceLocator || card.evidenceLocator;
  const citation = card.verification?.printedCitation;
  const dateLine = formatEventDateLine(card.date);
  /*
   * Nested in a KnowledgeCardView, the card's own <details> is the frame, so the detail is set
   * flat: its parts are separated by a rule instead of being drawn as boxes inside a box inside a
   * box. At 390 the nesting left 238px for text in the Brownian shelf's cards.
   */
  const part = (extra: CSSProperties = {}): CSSProperties =>
    anchored
      ? {
          padding: "0.875rem",
          borderRadius: "0.25rem",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          ...extra,
        }
      : { padding: "0.75rem 0 0", borderTop: "1px solid var(--line)" };

  return (
    <div
      id={anchored ? `card-${card.id}` : undefined}
      className={className || undefined}
      style={
        anchored
          ? {
              padding: "1.5rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--line)",
              background: "var(--panel)",
              color: "var(--ink)",
            }
          : { padding: "0.25rem 0.5rem 0.5rem", color: "var(--ink)" }
      }
      data-card-id={card.id}
      data-status={card.status}
    >
      {/* Header with Title / Proposition and Status. Nested in KnowledgeCardView, whose summary
          already shows the date, the claim and the status, it is left out rather than repeated.
          The eyebrow read "Knowledge card · #sutherland-1904-dunedin" in monospace, the record's
          id as text, on every expanded card of all four routes (30 cards, BUILD 9b). */}
      {anchored && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <div>
            <span
              className="eyebrow"
              style={{
                display: "block",
                marginBottom: "0.25rem",
                fontSize: "0.75rem",
              }}
            >
              Knowledge card
            </span>
            <h3
              style={{
                fontSize: "1.125rem",
                fontFamily: "var(--font-serif)",
                fontWeight: "bold",
                lineHeight: 1.3,
              }}
            >
              {card.proposition}
            </h3>
          </div>
          <StatusLabel status={card.status} admittedImport={card.admittedImport} />
        </div>
      )}

      {/* Proposition Limits if present */}
      {/* A line of the card, not a callout inside it (dispatch 276): the card is the container. */}
      {card.limits && (
        <div
          className={anchored ? "notice" : undefined}
          style={{
            marginBottom: "1rem",
            fontSize: "0.875rem",
            fontStyle: "italic",
          }}
        >
          <span style={{ fontWeight: 600, fontStyle: "normal" }}>Limits: </span>
          {card.limits}
        </div>
      )}

      {/* Status Explanation / Parallel Work Basis / Admitted Import Explanation */}
      <div
        style={
          anchored
            ? {
                marginBottom: "1.25rem",
                fontSize: "0.875rem",
                padding: "0.875rem",
                borderRadius: "0.25rem",
                background: "var(--wash)",
                border: "1px solid var(--line)",
              }
            : { marginBottom: "0.75rem", fontSize: "0.875rem" }
        }
      >
        <h4
          className="eyebrow"
          style={{
            fontSize: "0.75rem",
            marginBottom: "0.25rem",
          }}
        >
          Historical context
        </h4>
        {card.admittedImport ? (
          <p style={{ margin: 0, color: "var(--ink)" }}>
            {typeof card.admittedImport === "object" ? (
              <>
                {/* Said in the reader's words. This read "Admitted 1905 import for journey
                    mass-energy", the route's slug in monospace, and its link was built as
                    `#${anchor}`, so the only import on any shelf linked to the fragment
                    "#/papers/special-relativity/" and went nowhere. An anchor that is a path is
                    now used as a path; a bare id is still a fragment on this page. */}
                Imported from 1905.
                {card.admittedImport.provenance && ` ${card.admittedImport.provenance}`}
                {card.admittedImport.anchor && (
                  <>
                    {" "}
                    <a
                      href={
                        card.admittedImport.anchor.startsWith("/")
                          ? card.admittedImport.anchor
                          : `#${card.admittedImport.anchor}`
                      }
                      style={{ display: "inline-block", minHeight: "44px", alignContent: "center" }}
                    >
                      Read that section of the paper
                    </a>
                  </>
                )}
              </>
            ) : (
              "Admitted 1905 result imported with declared provenance."
            )}
          </p>
        ) : card.status === "parallel-work" ? (
          <p style={{ margin: 0, color: "var(--ink)" }}>
            This work appeared alongside or after Einstein’s 1905 paper and was not available to a
            1904 reader. {card.parallelWorkBasis}
          </p>
        ) : card.status === "available" ? (
          <p style={{ margin: 0, color: "var(--ink)" }}>
            Available in the published scientific literature or public proceedings prior to 1905.
          </p>
        ) : (
          <p style={{ margin: 0, color: "var(--ink)" }}>
            Later empirical or theoretical confirmation developed after 1905.
          </p>
        )}
      </div>

      {/* The Four Canonical Labeled Sections */}
      <div
        style={
          anchored
            ? {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
                gap: "1rem",
                marginBottom: "1.5rem",
              }
            : { display: "grid", gap: "0.75rem", marginBottom: "0.75rem" }
        }
      >
        {/* Section 1: Available by */}
        <div style={part()}>
          <h4
            className="eyebrow"
            style={{
              fontSize: "0.75rem",
              marginBottom: "0.5rem",
            }}
          >
            Available by
          </h4>
          <p style={{ margin: 0, fontWeight: 500, fontSize: "0.875rem", color: "var(--ink)" }}>
            {dateLine}
          </p>
          {card.priorEvent && (
            <p className="fine" style={{ marginTop: "0.25rem", marginBottom: 0 }}>
              <span style={{ fontWeight: 600 }}>Prior event: </span>
              {formatPriorEventLine(card.priorEvent)}
            </p>
          )}
          {card.relatedCardId && (
            <p className="fine" style={{ marginTop: "0.25rem", marginBottom: 0 }}>
              <span style={{ fontWeight: 600 }}>Related card: </span>
              {/* The link used to read "#sutherland-1905-phil-mag", the record's id in monospace
                  accent. It now names the card by its date and claim, as the shelf lists it. */}
              <a
                href={`#card-${card.relatedCardId}`}
                style={{ display: "inline-block", minHeight: "44px", alignContent: "center" }}
              >
                {relatedCard
                  ? `${formatEventDateLine(relatedCard.date)}: ${relatedCard.proposition}`
                  : "the card this one answers to"}
              </a>
            </p>
          )}
        </div>

        {/* Section 2: What the paper itself cites or asserts */}
        <div style={part()}>
          <h4
            className="eyebrow"
            style={{
              fontSize: "0.75rem",
              marginBottom: "0.5rem",
            }}
          >
            What the paper itself cites or asserts
          </h4>
          {card.paperCitesOrAsserts && card.paperCitesOrAsserts.length > 0 ? (
            <ul className="fine" style={{ margin: 0, paddingLeft: "1rem", listStyleType: "disc" }}>
              {card.paperCitesOrAsserts.map((ref) => {
                const itemKey = `${ref.paper}-${ref.note ?? ""}-${ref.anchor ?? ""}`;
                return (
                  <li key={itemKey}>
                    <span style={{ fontWeight: 500 }}>{PAPER_NAMES[ref.paper] ?? ref.paper}: </span>
                    {ref.note || ref.ids?.join(", ") || "Cited in text"}
                    {ref.anchor && (
                      <a
                        href={`#${ref.anchor}`}
                        style={{
                          marginLeft: "0.25rem",
                          textDecoration: "underline",
                          color: "var(--accent)",
                        }}
                      >
                        [view]
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="fine" style={{ margin: 0, fontStyle: "italic" }}>
              {/* This said "No direct citation or assertion in the original 1905 paper text." on
                  every card with nothing recorded here, which was all 30 on the four routes' shelves,
                  including Wien's law, Lenard and Stokes's law, which the papers use by name. An
                  empty record is not evidence of absence. */}
              Not yet recorded for this card.
            </p>
          )}
        </div>

        {/* Section 3: Evidence that Einstein knew it (only when present) */}
        {card.claimsEinsteinKnew && card.einsteinKnowledgeEvidence && (
          <div style={part({ gridColumn: "1 / -1" })}>
            <h4
              className="eyebrow"
              style={{
                fontSize: "0.75rem",
                marginBottom: "0.5rem",
              }}
            >
              Evidence that Einstein knew it
            </h4>
            <ul
              className="fine"
              style={{ margin: 0, paddingLeft: "1.25rem", listStyleType: "disc" }}
            >
              {card.einsteinKnowledgeEvidence.map((ev) => {
                const itemKey =
                  typeof ev === "string"
                    ? ev
                    : typeof ev === "object" && ev !== null && "title" in ev
                      ? `${(ev as { title: string }).title}-${(ev as { locator?: string }).locator ?? ""}`
                      : JSON.stringify(ev);
                return (
                  <li key={itemKey} style={{ marginTop: "0.25rem" }}>
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
        <div style={part({ gridColumn: "1 / -1" })}>
          <h4
            className="eyebrow"
            style={{
              fontSize: "0.75rem",
              marginBottom: "0.5rem",
            }}
          >
            Where this site uses it
          </h4>
          <div className="fine" style={{ margin: 0 }}>
            {card.admittedStages && card.admittedStages.length > 0 && (
              <div style={{ marginBottom: "0.5rem" }}>{stepsLine(card.admittedStages)}</div>
            )}
            {backlinks && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                {backlinks.stageIds.length > 0 && (
                  <div>
                    <span style={{ fontWeight: 600 }}>Cited by stages: </span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
                      {backlinks.stageIds.join(", ")}
                    </span>
                  </div>
                )}
                {backlinks.deskObjectIds.length > 0 && (
                  <div>
                    <span style={{ fontWeight: 600 }}>Desk objects: </span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
                      {backlinks.deskObjectIds.join(", ")}
                    </span>
                  </div>
                )}
                {backlinks.timelineEntryIds.length > 0 && (
                  <div>
                    <span style={{ fontWeight: 600 }}>Timeline entries: </span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
                      {backlinks.timelineEntryIds.join(", ")}
                    </span>
                  </div>
                )}
                {backlinks.worldCheckIds.length > 0 && (
                  <div>
                    <span style={{ fontWeight: 600 }}>World checks: </span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
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
        <div className="fine" style={{ marginBottom: "1.25rem" }}>
          <h4
            className="eyebrow"
            style={{
              fontSize: "0.75rem",
              marginBottom: "0.25rem",
            }}
          >
            Primary evidence and sources
          </h4>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", listStyleType: "disc" }}>
            {card.sources.map((src) => {
              const itemKey =
                typeof src === "string"
                  ? src
                  : typeof src === "object" && src !== null
                    ? `${(src as { title?: string }).title || ""}-${(src as { locator?: string }).locator || ""}-${(src as { date?: string }).date || ""}`
                    : JSON.stringify(src);
              return (
                <li key={itemKey} style={{ fontFamily: "var(--font-serif)" }}>
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

      {/* A verified card's locator and printed citation, as sources. The box that stood here said
          "Awaiting verification" and "Source verification pending library scan inspection." on
          every shelf card, with the open verification questions listed under it, or "Verified
          against original source" and who verified it: the review-status copy the owner's
          D-2026-09-25-no-review-status-banners removed (dispatch 243). The verification record
          stays in the card's data, where publicationGate reads it. */}
      {verified && (locator || citation) && (
        <div className="fine">
          {/*
            The locator WRAPS instead of truncating. It carried an inline
            overflow/text-overflow/white-space triple, which at 320px showed about 40% of the
            citation behind an ellipsis with no way to reach the rest - not scrollable, clipped.
            A truncated DOI is not a citation. See .evidence-locator in globals.css for the
            measurement.
          */}
          {locator && <p className="evidence-locator">Locator: {locator}</p>}
          {citation && (
            <p style={{ margin: "0.25rem 0 0", color: "var(--muted)" }}>Citation: {citation}</p>
          )}
        </div>
      )}
    </div>
  );
}
