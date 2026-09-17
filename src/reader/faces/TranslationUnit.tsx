import { renderToString } from "katex";
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

  const isEquation = unit.inlines.length === 1 && unit.inlines[0]?.kind === "math";
  const mathNode = isEquation
    ? (unit.inlines[0] as { kind: "math"; latex: string; equationId?: string })
    : undefined;

  let renderedMath: string | undefined;
  if (isEquation && mathNode) {
    try {
      renderedMath = renderToString(mathNode.latex, {
        displayMode: true,
        output: "htmlAndMathml",
        throwOnError: false,
        strict: "warn",
        trust: false,
      });
    } catch {
      renderedMath = `<code class="math-fallback">${mathNode.latex}</code>`;
    }
  }

  const matchingNotes = editorialNotes.filter((n) => n.affectedIds.includes(unit.id));

  return (
    <article
      id={unit.id}
      data-translation-unit-id={unit.id}
      data-aligned-active={isActive ? "true" : undefined}
      data-aligned-partner={!isActive && isHighlighted ? "true" : undefined}
      data-review-state={unit.reviewState}
      data-is-reviewed={badge.isReviewed ? "true" : "false"}
      data-kind={isEquation ? "equation" : undefined}
      data-equation-id={mathNode?.equationId}
      className={`translation-unit ${isEquation ? "translation-equation" : ""} ${isActive ? "is-active" : ""} ${isHighlighted ? "is-highlighted" : ""}`}
      tabIndex={-1}
      lang={lang}
    >
      <div className="unit-header">
        <span
          className={`review-badge badge-${badge.reviewClass}`}
          role="status"
          data-review-badge={badge.label}
          title={badge.description}
          aria-label={`Review status: ${badge.label}`}
        >
          {badge.label}
        </span>
        <button
          type="button"
          className="show-aligned-action visually-hidden-focusable"
          data-action="show-aligned-source"
          data-unit-id={unit.id}
          aria-label="Show the German source of this sentence"
          tabIndex={-1}
        >
          Show the German source
        </button>
      </div>

      <div className="unit-body">
        {isEquation && renderedMath ? (
          <div className="equation-container">
            <div
              className="equation-body"
              data-printed-notation="true"
              {...{ dangerouslySetInnerHTML: { __html: renderedMath } }}
            />
          </div>
        ) : (
          renderInlines(unit.inlines, undefined, `tr-${unit.id}`)
        )}
      </div>

      {unit.unresolvedAlternatives && unit.unresolvedAlternatives.length > 0 && (
        <details
          className="unresolved-alternatives"
          data-alternatives-count={unit.unresolvedAlternatives.length}
        >
          <summary>Alternative translations ({unit.unresolvedAlternatives.length})</summary>
          <ul className="alternatives-list">
            {unit.unresolvedAlternatives.map((alt) => (
              <li key={`${unit.id}-alt-${alt.text}`}>
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
