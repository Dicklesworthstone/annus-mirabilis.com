import type { SourceFaceNotice as SourceFaceNoticeRecord } from "../../content/provenance/sourceFaceNotice.ts";
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
import { FootnotesSection } from "./Footnote.tsx";
import type { FaceId } from "./registry.ts";
import { isPaperTranslationUnreviewed, translationReviewSummary } from "./reviewState.ts";
import { SourceBlock as SourceBlockItem } from "./SourceBlock.tsx";
import { SourceFaceNotice } from "./SourceFaceNotice.tsx";
import { TranslationParagraphs } from "./TranslationParagraphs.tsx";
import { unitsBySourceRef } from "./TranslationUnit.tsx";
import { MASTHEAD_TITLE_ID, unitTranslating } from "./translationMasthead.ts";
import { UnreviewedBanner } from "./UnreviewedBanner.tsx";
import "../reader.css";

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
  /**
   * The German source's own label, from its provenance receipt (sourceFaceNotice). Passed while the
   * blocks are an unreviewed draft, so the German column is labelled as the German face is; the
   * English column carries its own draft banner and badges.
   */
  readonly germanNotice?: SourceFaceNoticeRecord | undefined;
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
  germanNotice,
  availability,
}: ParallelFaceProps) {
  const isUnreviewed = isPaperTranslationUnreviewed(units, reviewRecords);
  // Review state is said once, in the banner, from the units themselves.
  const review = translationReviewSummary(units, reviewRecords);
  const isStacked = layout === "stacked";
  const alignmentIndex = buildAlignmentIndex(alignment, blocks, units);
  const footnoteUnits = unitsBySourceRef(units);
  const titleUnit = unitTranslating(units, MASTHEAD_TITLE_ID);

  const filteredBlocks = sectionId
    ? blocks.filter((b) => b.section === sectionId || !b.section)
    : blocks;

  const footnoteBlocks = filteredBlocks.filter((b) => b.kind === "footnote");
  // A display its paragraph prints in place is not printed again as its own block.
  const mainBlocks = withoutClaimedDisplays(filteredBlocks.filter((b) => b.kind !== "footnote"));
  const published = paper.dates.find((d) => d.type === "issue-publication");

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

      {isUnreviewed && <UnreviewedBanner title={review.title} message={review.message} />}

      {/* The chooser every face uses, with this face the current tab (FaceChooser.tsx). */}
      <FaceChooser
        paperId={paper.slug}
        section={sectionId}
        current="parallel"
        availability={availability}
      />

      <aside className="parallel-help-bar fine" aria-label="Alignment guidance">
        <p>
          Hover or focus a sentence to highlight its aligned counterpart. Press <kbd>j</kbd> /{" "}
          <kbd>k</kbd> to step through sentences in reading order.
        </p>
      </aside>

      <div
        className={`parallel-grid ${isStacked ? "parallel-stacked" : ""}`}
        data-parallel-grid
        data-layout={isStacked ? "stacked" : "side-by-side"}
        data-stacked-layout={isStacked ? "true" : "responsive"}
      >
        <section
          className="parallel-column parallel-german"
          aria-label="German source face"
          data-parallel-column="german"
          lang="de"
        >
          <h2 className="column-heading">Deutscher Originaltext</h2>
          {germanNotice ? <SourceFaceNotice notice={germanNotice} /> : null}
          <div className="source-blocks-list">
            {mainBlocks.map((block) => (
              <SourceBlockItem
                key={block.id}
                block={block}
                paperSlug={paper.slug}
                editorialNotes={editorialNotes}
              />
            ))}
          </div>
          <FootnotesSection footnotes={footnoteBlocks} heading="Fußnoten" />
        </section>

        <section
          className="parallel-column parallel-english"
          aria-label="English translation face"
          data-parallel-column="english"
          lang="en"
        >
          <h2 className="column-heading">English Translation</h2>
          <div className="translation-units-list">
            {/* Einstein's paragraphs, as the German column sets them (TranslationParagraphs). */}
            <TranslationParagraphs
              units={units}
              alignment={alignment}
              blocks={blocks}
              reviewRecords={reviewRecords}
              editorialNotes={editorialNotes}
              anchorPrefix={ENGLISH_ANCHOR_PREFIX}
              footnoteUnits={footnoteUnits}
              commonLabel={review.commonLabel}
            />
          </div>
        </section>
      </div>

      <AlignmentController index={alignmentIndex} />
    </div>
  );
}
