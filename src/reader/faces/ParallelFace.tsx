import type { ReviewRecord } from "../../content/schemas/review.ts";
import {
  type Alignment,
  type EditorialNote,
  type Paper,
  plainText,
  type SourceBlock,
  type TranslationUnit,
} from "../../content/schemas/source.ts";
import { FaceChooser } from "../FaceChooser.tsx";
import type { FaceAvailability } from "../faceAvailability.ts";
import { ROOT_ARMING_SOURCE } from "../rootArming.inline.ts";
import { AlignmentController } from "./AlignmentController.tsx";
import { buildAlignmentIndex } from "./alignment.ts";
import { withoutClaimedDisplays } from "./displayClaims.ts";
import { sectionsLabel } from "./editionCoverage.ts";
import { FootnoteItem } from "./Footnote.tsx";
import { type ParallelRow, parallelRows } from "./parallelRows.ts";
import type { FaceId } from "./registry.ts";
import { SourceBlock as SourceBlockItem } from "./SourceBlock.tsx";
import { groupTranslationUnits, TranslationParagraphs } from "./TranslationParagraphs.tsx";
import { unitsBySourceRef } from "./TranslationUnit.tsx";
import { MASTHEAD_TITLE_ID, unitTranslating } from "./translationMasthead.ts";
import "../reader.css";
import { ExplainerFragments } from "./ExplainerFragments.tsx";
import { InlineTerms } from "./InlineTerms.tsx";

/**
 * The English column's DOM ids carry this prefix. A unit's id is its German sentence's id by the
 * id grammar, so without it the page repeated every aligned id; #s0-p1-s1 names the German sentence
 * here, as on the German face, and #en-s0-p1-s1 its English.
 */
export const ENGLISH_ANCHOR_PREFIX = "en-";

export interface ParallelFaceProps {
  /** Which faces have content, derived by PaperPage from the same counts it dispatches on. */
  readonly availability?: Readonly<Partial<Record<FaceId, FaceAvailability>>> | undefined;
  readonly paper: Paper;
  readonly blocks: readonly SourceBlock[];
  readonly units: readonly TranslationUnit[];
  readonly alignment: Alignment;
  readonly editorialNotes?: readonly EditorialNote[] | undefined;
  readonly reviewRecords?: readonly ReviewRecord[] | undefined;
  readonly sectionId?: string | undefined;
  readonly layout?: "side-by-side" | "stacked" | undefined;
  /** The paper's sections no translation unit reaches yet (editionCoverage.ts), in its order. */
  readonly untranslatedSections?: readonly string[] | undefined;
}

export function ParallelFace({
  paper,
  blocks,
  units,
  alignment,
  editorialNotes = [],
  reviewRecords = [],
  sectionId,
  layout = "side-by-side",
  untranslatedSections = [],
  availability,
}: ParallelFaceProps) {
  // Neither column carries a review banner, chip or draft label
  // (D-2026-09-25-no-review-status-banners); the records keep who made and checked each unit.
  const isStacked = layout === "stacked";
  const alignmentIndex = buildAlignmentIndex(alignment, blocks, units);
  const footnoteUnits = unitsBySourceRef(units);
  const titleUnit = unitTranslating(units, MASTHEAD_TITLE_ID);

  const filteredBlocks = sectionId
    ? blocks.filter((b) => b.section === sectionId || !b.section)
    : blocks;

  const footnoteBlocks = filteredBlocks.filter((b) => b.kind === "footnote");
  // A display its paragraph or footnote prints in place is not printed again as its own block.
  // The claims are counted before the footnotes are set aside: light quanta's s1-fn3 prints three
  // displays, which were otherwise also printed as rows of their own, repeating their ids.
  const mainBlocks = withoutClaimedDisplays(filteredBlocks).filter((b) => b.kind !== "footnote");
  const published = paper.dates.find((d) => d.type === "issue-publication");
  // One row per German block, holding that block's English (parallelRows.ts).
  // A display the German prints as its own block keeps its English beside it, not in the paragraph.
  const standaloneDisplays = new Set(
    mainBlocks.filter((b) => b.kind === "equation").map((b) => b.id),
  );
  const { rows, footnoteRows } = parallelRows(
    mainBlocks,
    footnoteBlocks,
    groupTranslationUnits(units, alignment, blocks, standaloneDisplays),
    blocks,
  );
  const english = (row: ParallelRow) =>
    row.english.length === 0 ? null : (
      <div className="parallel-half parallel-half-english" data-parallel-half="english" lang="en">
        <p className="parallel-half-label">English</p>
        <TranslationParagraphs
          units={units}
          groups={row.english}
          alignment={alignment}
          blocks={blocks}
          reviewRecords={reviewRecords}
          editorialNotes={editorialNotes}
          anchorPrefix={ENGLISH_ANCHOR_PREFIX}
          footnoteUnits={footnoteUnits}
        />
      </div>
    );

  return (
    <div
      data-reader-root
      data-ready="true"
      data-view="parallel"
      data-face="parallel"
      data-layout={layout}
      data-stacked-at-320="true"
      className={`reader-root face-parallel ${isStacked ? "layout-stacked" : ""}`}
    >
      <noscript>
        <div className="no-js-reading-lane" data-no-js="true">
          <p>
            JavaScript is disabled. The bilingual edition is rendered in full static reading order
            with complete source text and translations.
          </p>
        </div>
      </noscript>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: harness data-ready contract; source from a tested pure function. */}
      <script dangerouslySetInnerHTML={{ __html: ROOT_ARMING_SOURCE }} />
      {/* Inline formulas as targets, on a paper drawn in colour (dispatch 272). */}
      <InlineTerms paper={paper.slug} />
      {/* The panels' levels, fetched when a reader first opens one (dispatch 292). */}
      <ExplainerFragments />
      <header className="page-intro">
        <p className="eyebrow">Parallel edition · {paper.titleEnglishWorking}</p>
        {/* The translated masthead (translationMasthead.ts); both columns still print it. */}
        <h1 className="parallel-paper-title">
          {titleUnit ? plainText(titleUnit.inlines) : paper.titleEnglishWorking}
        </h1>
        <p className="parallel-german-title" lang="de">
          <em>{paper.titleGerman}</em>
        </p>
        <p className="parallel-author">By {paper.authorLine}</p>
        <p className="journal-citation fine">
          {paper.journal.name} ({paper.journal.series}) {paper.journal.volume},{" "}
          {paper.journal.pages.first}–{paper.journal.pages.last}
          {published ? ` (${published.earliest.slice(0, 4)})` : ""}.
        </p>
      </header>

      {/* What the translation does not reach yet, named, so a partial edition is never read as the
          whole paper (editionCoverage.ts). */}
      {untranslatedSections.length > 0 ? (
        <p className="notice" data-untranslated-sections={untranslatedSections.join(" ")}>
          This translation does not yet cover the whole paper. Not yet translated:{" "}
          {sectionsLabel(untranslatedSections)}.
        </p>
      ) : null}

      {/* The chooser every face uses, with this face the current tab (FaceChooser.tsx). */}
      <FaceChooser
        paperId={paper.slug}
        section={sectionId}
        current="parallel"
        availability={availability}
      />

      {/*
        ONE QUIET LINE, NOT A PANEL (dispatch 499). This was the heaviest block on the page, on every
        paper, permanently: a washed and bordered box measuring 66px at desktop and 110px at 320px,
        above the reading it was explaining. The chrome is gone from the stylesheet and the words stay.

        THE KEYBOARD SENTENCE STAYS TOO, and is scoped in words rather than hidden. j and k are real
        and a keyboard reader has nowhere else to learn them: the accessibility page says the edition
        can be read from a keyboard and lists no keys. Hiding the sentence on a touch viewport would
        have cost that reader the only place it is written, and a media query cannot tell a phone from
        a phone with a keyboard. "On a keyboard" is how src/app/not-found.tsx already says this.

        "Point at" rather than "Hover", because a touch reader cannot hover and was being told to.
      */}
      <aside className="parallel-help-bar fine" aria-label="Alignment guidance">
        <p>
          Focus or point at a sentence to light its aligned counterpart. On a keyboard, <kbd>j</kbd>{" "}
          and <kbd>k</kbd> step through sentences in reading order.
        </p>
      </aside>

      <div
        className={`parallel-grid ${isStacked ? "parallel-stacked" : ""}`}
        data-parallel-grid
        data-layout={isStacked ? "stacked" : "side-by-side"}
        data-stacked-layout={isStacked ? "true" : "responsive"}
      >
        {/* The columns' names, over the columns on a wide screen. Each half also carries its
            language's name, which a phone shows and a screen reader hears on every width, so
            these are for the eye alone. */}
        <div className="parallel-heads" aria-hidden="true">
          <p className="column-heading" lang="de">
            Deutscher Originaltext
          </p>
          <p className="column-heading">English Translation</p>
        </div>
        {rows.map((row) => (
          <div key={row.key} className="parallel-row" data-parallel-row={row.key}>
            {row.block ? (
              <div
                className="parallel-half parallel-half-german"
                data-parallel-half="german"
                lang="de"
              >
                <p className="parallel-half-label">Deutsch</p>
                <SourceBlockItem
                  block={row.block}
                  paperSlug={paper.slug}
                  editorialNotes={editorialNotes}
                />
              </div>
            ) : null}
            {english(row)}
          </div>
        ))}
        {footnoteRows.length > 0 ? (
          <section className="reader-footnotes" aria-labelledby="footnotes-heading">
            <h2 id="footnotes-heading" className="footnotes-heading" lang="de">
              Fußnoten
            </h2>
            {footnoteRows.map((row, index) => (
              <div key={row.key} className="parallel-row" data-parallel-row={row.key}>
                {row.block ? (
                  <div
                    className="parallel-half parallel-half-german"
                    data-parallel-half="german"
                    lang="de"
                  >
                    <p className="parallel-half-label">Deutsch</p>
                    {/* One list per footnote, so it can sit in its row; start keeps its number. */}
                    <ol className="footnotes-list" start={index + 1}>
                      {/* ANCHORED: the German column publishes the footnote's own id, which is the
                          canonical page anchor for a footnote block (docs/CONTENT_IDS.md 7.1 lists
                          #s3-fn1 beside #s3-p2 as a fragment used directly). Measured on the build
                          of 2026-09-28: 95 built pages published id="s<n>-fn<k>" and the parallel
                          face published none, so a cross-page link to #s1-fn1 resolved on every
                          face but this one. That is what the fragment-anchors candidate check
                          caught from /capstones/special-relativity/, and no test on this face
                          could see it, because this face links its own marks to #footnote-<id>
                          and englishAnchors.test.tsx reads the links the page itself emits. The
                          prop's own docblock used to say the parallel face declines this because
                          its rows would repeat ids; the repetition is what ENGLISH_ANCHOR_PREFIX
                          already prevents, and englishAnchors.test.tsx asserts no id repeats with
                          this on. */}
                      <FootnoteItem footnote={row.block} anchored />
                    </ol>
                  </div>
                ) : null}
                {english(row)}
              </div>
            ))}
          </section>
        ) : null}
      </div>

      <AlignmentController index={alignmentIndex} />
    </div>
  );
}
