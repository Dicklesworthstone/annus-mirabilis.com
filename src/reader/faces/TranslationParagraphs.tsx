/**
 * THE TRANSLATION READS AS EINSTEIN'S PARAGRAPHS, NOT AS BADGED FRAGMENTS.
 *
 * Each translation unit was its own <article> with a visible "Machine draft" badge carrying
 * role="status", so mass-energy's English face read as 43 separately labelled fragments, and a
 * screen reader met 43 status regions. The units are sentences of paragraphs Einstein printed, so
 * they are set as those paragraphs here:
 *
 * - Sentence units run on as one <p> per source paragraph. The paragraph is the block each unit's
 *   alignment edge names, or the block whose sentence its sourceRefs name.
 * - A display sits in its paragraph where it was printed: the paragraph its equation block is
 *   containedIn, or, with no blocks to ask, the paragraph it follows. Footnotes, closing lines and
 *   an unclaimed display stand alone, in the order the units come.
 * - Every unit keeps its id on an inline element, so #s0-p6-s1 still lands, and keeps its
 *   "Show the German source" action, which is a real button and so reachable by keyboard.
 * - Review state is said once, by the face's banner (translationReviewSummary). A unit carries a
 *   badge only when its state differs from the one most units share, and no badge is a live
 *   region: it is static content.
 */
import { renderToString } from "katex";
import { Fragment, type ReactNode } from "react";
import type { ReviewRecord } from "../../content/schemas/review.ts";
import {
  type Alignment,
  type EditorialNote,
  type Inline,
  plainText,
  type SourceBlock,
  type TranslationUnit,
} from "../../content/schemas/source.ts";
import { EditorialNoteMarker } from "./EditorialNoteMarker.tsx";
import { renderInlines } from "./inlines.tsx";
import { evaluateUnitReviewState } from "./reviewState.ts";

type GroupKind = "paragraph" | "display" | "footnote" | "other";
type Group = { kind: GroupKind; key: string; units: TranslationUnit[] };

const BADGE_CLASS: Readonly<Record<"reviewed" | "in-progress" | "draft", string>> = {
  reviewed: "badge-reviewed",
  "in-progress": "badge-in-progress",
  draft: "badge-draft",
};

const isDisplay = (u: TranslationUnit) => u.inlines.length === 1 && u.inlines[0]?.kind === "math";

function footnoteMarks(inlines: readonly Inline[], into: Map<string, string>): void {
  for (const n of inlines) {
    if (n.kind === "footnote-mark" && !into.has(n.footnoteId)) into.set(n.footnoteId, n.mark);
    else if (n.kind === "emphasis") footnoteMarks(n.inlines, into);
  }
}

/** The source block each unit renders: its alignment edge's block, else its sentence's owner. */
export function groupTranslationUnits(
  units: readonly TranslationUnit[],
  alignment?: Alignment | undefined,
  blocks: readonly SourceBlock[] = [],
): Group[] {
  const edgeBlock = new Map<string, string>();
  for (const e of alignment?.edges ?? [])
    if (!edgeBlock.has(e.target.translationUnitId))
      edgeBlock.set(e.target.translationUnitId, e.source.blockId);
  const blockById = new Map(blocks.map((b) => [b.id, b]));
  const owner = new Map<string, string>();
  for (const b of blocks) for (const s of b.sentenceSpans ?? []) owner.set(s.id, b.id);
  const marked = new Map<string, string>();
  for (const u of units) footnoteMarks(u.inlines, marked);
  const sourceOf = (u: TranslationUnit): string => {
    const ref = u.sourceRefs[0]?.id ?? u.id;
    return edgeBlock.get(u.id) ?? owner.get(ref) ?? ref;
  };
  const kindOf = (u: TranslationUnit): GroupKind => {
    const block = blockById.get(sourceOf(u));
    if (block)
      return block.kind === "paragraph"
        ? "paragraph"
        : block.kind === "equation"
          ? "display"
          : block.kind === "footnote"
            ? "footnote"
            : "other";
    if (isDisplay(u)) return "display";
    if (u.sourceRefs.some((r) => marked.has(r.id))) return "footnote";
    return "paragraph";
  };

  const groups: Group[] = [];
  for (const unit of units) {
    const kind = kindOf(unit);
    const key = sourceOf(unit);
    const last = groups[groups.length - 1];
    if (kind === "display") {
      const host =
        blockById.get(key)?.containedIn ?? (last?.kind === "paragraph" ? last.key : undefined);
      if (last?.kind === "paragraph" && last.key === host) last.units.push(unit);
      else groups.push({ kind: "display", key, units: [unit] });
    } else if (kind === "paragraph" && last?.kind === "paragraph" && last.key === key) {
      last.units.push(unit);
    } else {
      groups.push({ kind, key, units: [unit] });
    }
  }
  return groups;
}

export interface TranslationParagraphsProps {
  /** The units to set, in reading order. */
  readonly units: readonly TranslationUnit[];
  readonly alignment?: Alignment | undefined;
  /** The German blocks, when the page has them: they say which units share a paragraph. */
  readonly blocks?: readonly SourceBlock[] | undefined;
  readonly reviewRecords?: readonly ReviewRecord[] | undefined;
  readonly editorialNotes?: readonly EditorialNote[] | undefined;
  /** Prefixed to every DOM id, for a page that also renders the German ids (the parallel face). */
  readonly anchorPrefix?: string | undefined;
  /** Footnote block id to the id of the unit that translates it (unitsBySourceRef). */
  readonly footnoteUnits?: ReadonlyMap<string, string> | undefined;
  /** The review label most of the face's units share; a unit is badged only when it differs. */
  readonly commonLabel?: string | undefined;
}

export function TranslationParagraphs({
  units,
  alignment,
  blocks = [],
  reviewRecords = [],
  editorialNotes = [],
  anchorPrefix = "",
  footnoteUnits,
  commonLabel,
}: TranslationParagraphsProps) {
  const records = new Map<string, ReviewRecord>();
  for (const r of reviewRecords) for (const s of r.scope) records.set(s.recordId, r);
  const marks = new Map<string, string>();
  for (const u of units) footnoteMarks(u.inlines, marks);
  const footnoteTarget = (footnoteId: string) => {
    const target = footnoteUnits?.get(footnoteId);
    return target ? `${anchorPrefix}${target}` : undefined;
  };

  const showSource = (u: TranslationUnit) => (
    <button
      type="button"
      className="show-aligned-action visually-hidden-focusable"
      data-action="show-aligned-source"
      data-unit-id={u.id}
      aria-label="Show the German source of this sentence"
    >
      Show the German source
    </button>
  );
  const badgeFor = (u: TranslationUnit): ReactNode => {
    const badge = evaluateUnitReviewState(u, records.get(u.id));
    if (commonLabel === undefined || badge.label === commonLabel) return null;
    return (
      <span
        className={`review-badge ${BADGE_CLASS[badge.reviewClass] ?? "badge-draft"}`}
        data-review-badge={badge.label}
        title={badge.description}
      >
        {badge.label}
      </span>
    );
  };
  const unitAttributes = (u: TranslationUnit) => ({
    id: `${anchorPrefix}${u.id}`,
    "data-translation-unit-id": u.id,
    "data-review-state": u.reviewState,
    "data-is-reviewed": evaluateUnitReviewState(u, records.get(u.id)).isReviewed ? "true" : "false",
    tabIndex: -1,
    lang: u.lang ?? "en",
  });

  const renderUnit = (u: TranslationUnit): ReactNode => {
    if (isDisplay(u)) {
      const math = u.inlines[0] as { latex: string; equationId?: string };
      const html = renderToString(math.latex, {
        displayMode: true,
        output: "htmlAndMathml",
        throwOnError: false,
        strict: "warn",
        trust: false,
      });
      return (
        <Fragment key={u.id}>
          <span
            {...unitAttributes(u)}
            className="translation-unit translation-equation"
            data-kind="equation"
            data-equation-id={math.equationId}
          >
            <span
              className="equation-body"
              data-printed-notation="true"
              {...{ dangerouslySetInnerHTML: { __html: html } }}
            />
            {badgeFor(u)}
            {showSource(u)}
          </span>{" "}
        </Fragment>
      );
    }
    return (
      <Fragment key={u.id}>
        <span {...unitAttributes(u)} className="translation-unit">
          {renderInlines(u.inlines, { idPrefix: anchorPrefix, footnoteTarget }, `tr-${u.id}`)}
          {badgeFor(u)}
          {showSource(u)}
        </span>{" "}
      </Fragment>
    );
  };

  // What a paragraph's units carry besides their text: alternative readings and editorial notes.
  const apparatus = (group: Group): ReactNode[] =>
    group.units.flatMap((u) => {
      const notes = editorialNotes.filter((n) => n.affectedIds.includes(u.id));
      const out: ReactNode[] = [];
      if (u.unresolvedAlternatives.length > 0) {
        const words = plainText(u.inlines).split(/\s+/).slice(0, 6).join(" ");
        out.push(
          <details
            key={`${u.id}-alternatives`}
            className="unresolved-alternatives"
            data-alternatives-count={u.unresolvedAlternatives.length}
            data-unit-id={u.id}
          >
            <summary>
              Alternative translations ({u.unresolvedAlternatives.length}) for “{words}…”
            </summary>
            <ul className="alternatives-list">
              {u.unresolvedAlternatives.map((alt) => (
                <li key={`${u.id}-alt-${alt.text}`}>
                  <p className="alternative-text">
                    <strong>Option:</strong> {alt.text}
                  </p>
                  <p className="alternative-rationale">
                    <em>Rationale:</em> {alt.rationale}
                  </p>
                </li>
              ))}
            </ul>
          </details>,
        );
      }
      if (notes.length > 0)
        out.push(
          <div key={`${u.id}-notes`} className="unit-editorial-notes">
            {notes.map((note) => (
              <EditorialNoteMarker key={note.id} note={note} inline />
            ))}
          </div>,
        );
      return out;
    });

  return (
    <>
      {groupTranslationUnits(units, alignment, blocks).map((group) => {
        const key = `${group.kind}-${group.key}-${group.units[0]?.id}`;
        if (group.kind === "footnote") {
          const source = group.units[0]?.sourceRefs[0]?.id ?? group.key;
          const mark = marks.get(source) ?? marks.get(group.key);
          return (
            <Fragment key={key}>
              <aside className="translation-footnote" data-source-footnote={group.key}>
                {mark ? <span className="footnote-ref">{mark} </span> : null}
                {group.units.map(renderUnit)}
              </aside>
              {apparatus(group)}
            </Fragment>
          );
        }
        if (group.kind === "display")
          return (
            <Fragment key={key}>
              <div className="equation-container" data-source-display={group.key}>
                {group.units.map(renderUnit)}
              </div>
              {apparatus(group)}
            </Fragment>
          );
        return (
          <Fragment key={key}>
            <p
              className="translation-paragraph"
              data-source-paragraph={group.kind === "paragraph" ? group.key : undefined}
              data-source-block={group.key}
            >
              {group.units.map(renderUnit)}
            </p>
            {apparatus(group)}
          </Fragment>
        );
      })}
    </>
  );
}
