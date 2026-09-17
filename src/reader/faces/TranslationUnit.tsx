import React from "react";
import type { ReviewRecord } from "../../content/schemas/review.ts";
import type { EditorialNote, TranslationUnit } from "../../content/schemas/source.ts";
import { EditorialNoteMarker } from "./EditorialNoteMarker.tsx";
import { renderInlines } from "./inlines.tsx";
import { evaluateUnitReviewState } from "./reviewState.ts";

export interface TranslationUnitProps {
  readonly unit: TranslationUnit;
  readonly reviewRecord?: ReviewRecord | undefined;
  readonly editorialNotes?: readonly EditorialNote[] | undefined;
  readonly activeUnitId?: string | null | undefined;
  readonly highlightedUnitIds?: ReadonlySet<string> | undefined;
}

export function TranslationUnitComponent({
  unit,
  reviewRecord,
  editorialNotes = [],
  activeUnitId,
  highlightedUnitIds,
}: TranslationUnitProps) {
  const badge = evaluateUnitReviewState(unit, reviewRecord);
  const isActive = activeUnitId === unit.id;
  const isHighlighted = highlightedUnitIds?.has(unit.id) ?? false;
  const lang = unit.lang ?? "en";

  const matchingNotes = editorialNotes.filter((n) => n.affectedIds.includes(unit.id));

  return (
    <article
      id={unit.id}
      data-translation-unit-id={unit.id}
      data-aligned-active={isActive ? "true" : undefined}
      data-aligned-partner={!isActive && isHighlighted ? "true" : undefined}
      data-review-state={unit.reviewState}
      data-is-reviewed={badge.isReviewed ? "true" : "false"}
      className={`translation-unit ${isActive ? "is-active" : ""} ${isHighlighted ? "is-highlighted" : ""}`}
      tabIndex={0}
      lang={lang}
    >
      <div className="unit-header">
        <span
          className={`review-badge badge-${badge.reviewClass}`}
          data-review-badge={badge.label}
          title={badge.description}
          aria-label={`Review status: ${badge.label}`}
        >
          {badge.label}
        </span>
      </div>

      <div className="unit-body">{renderInlines(unit.inlines, undefined, `tr-${unit.id}`)}</div>

      {unit.unresolvedAlternatives && unit.unresolvedAlternatives.length > 0 && (
        <details
          className="unresolved-alternatives"
          data-alternatives-count={unit.unresolvedAlternatives.length}
        >
          <summary>Alternative translations ({unit.unresolvedAlternatives.length})</summary>
          <ul className="alternatives-list">
            {unit.unresolvedAlternatives.map((alt, i) => (
              <li key={`${unit.id}-alt-${i}`}>
                <p className="alternative-text">
                  <strong>Option:</strong> {alt.text}
                </p>
                <p className="alternative-rationale">
                  <em>Rationale:</em> {alt.rationale}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {matchingNotes.length > 0 && (
        <div className="unit-editorial-notes">
          {matchingNotes.map((note) => (
            <EditorialNoteMarker key={note.id} note={note} inline />
          ))}
        </div>
      )}
    </article>
  );
}

export { TranslationUnitComponent as TranslationUnit };
