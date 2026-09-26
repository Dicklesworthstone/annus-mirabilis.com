import { renderToString } from "katex";
import type { ReviewRecord } from "../../content/schemas/review.ts";
import type { EditorialNote, TranslationUnit } from "../../content/schemas/source.ts";
import { EditorialNoteMarker } from "./EditorialNoteMarker.tsx";
import { renderInlines, unitTerms } from "./inlines.tsx";
import { evaluateUnitReviewState } from "./reviewState.ts";

export interface TranslationUnitProps {
  readonly unit: TranslationUnit;
  readonly reviewRecord?: ReviewRecord | undefined;
  readonly editorialNotes?: readonly EditorialNote[] | undefined;
  readonly activeUnitId?: string | null | undefined;
  readonly highlightedUnitIds?: ReadonlySet<string> | undefined;
  /**
   * Prefixed to the DOM ids this unit renders. A unit's id is its German sentence's id by the id
   * grammar (docs/CONTENT_IDS.md 3.3), so a page showing both, the parallel face, must namespace
   * one column or repeat every id. data-translation-unit-id stays the bare unit id.
   */
  readonly anchorPrefix?: string | undefined;
  /** Footnote block id to the id of the unit that translates it, so a mark links to it. */
  readonly footnoteUnits?: ReadonlyMap<string, string> | undefined;
}

/**
 * Each source id a unit translates, mapped to that unit's id: what a footnote mark in another
 * unit links to. Derived from the units' own sourceRefs, never written by hand.
 */
export function unitsBySourceRef(units: readonly TranslationUnit[]): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const unit of units)
    for (const ref of unit.sourceRefs) if (!map.has(ref.id)) map.set(ref.id, unit.id);
  return map;
}

export function TranslationUnitComponent({
  unit,
  reviewRecord,
  editorialNotes = [],
  activeUnitId,
  highlightedUnitIds,
  anchorPrefix = "",
  footnoteUnits,
}: TranslationUnitProps) {
  // Its review state stays in the data attributes, for the audit, and is never shown: no chip and no
  // alternatives disclosure (D-2026-09-25-no-review-status-banners, -one-best-translation).
  const review = evaluateUnitReviewState(unit, reviewRecord);
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
      id={`${anchorPrefix}${unit.id}`}
      data-translation-unit-id={unit.id}
      data-aligned-active={isActive ? "true" : undefined}
      data-aligned-partner={!isActive && isHighlighted ? "true" : undefined}
      data-review-state={unit.reviewState}
      data-is-reviewed={review.isReviewed ? "true" : "false"}
      data-kind={isEquation ? "equation" : undefined}
      data-equation-id={mathNode?.equationId}
      className={`translation-unit ${isEquation ? "translation-equation" : ""} ${isActive ? "is-active" : ""} ${isHighlighted ? "is-highlighted" : ""}`}
      tabIndex={-1}
      lang={lang}
    >
      <div className="unit-header">
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
          renderInlines(
            unit.inlines,
            {
              idPrefix: anchorPrefix,
              terms: unitTerms(unit),
              footnoteTarget: (footnoteId) => {
                const target = footnoteUnits?.get(footnoteId);
                return target ? `${anchorPrefix}${target}` : undefined;
              },
            },
            `tr-${unit.id}`,
          )
        )}
      </div>

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
