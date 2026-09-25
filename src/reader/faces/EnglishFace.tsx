import type { ReviewRecord } from "../../content/schemas/review.ts";
import type {
  Alignment,
  EditorialNote,
  Paper,
  SourceBlock,
  TranslationUnit,
} from "../../content/schemas/source.ts";
import { FaceChooser } from "../FaceChooser.tsx";
import type { FaceAvailability } from "../faceAvailability.ts";
import { ROOT_ARMING_SOURCE } from "../rootArming.inline.ts";
import { AlignmentController } from "./AlignmentController.tsx";
import { buildAlignmentIndex } from "./alignment.ts";
import { sectionsLabel } from "./editionCoverage.ts";
import { renderInlines } from "./inlines.tsx";
import type { FaceId } from "./registry.ts";
import { TranslationParagraphs } from "./TranslationParagraphs.tsx";
import { unitsBySourceRef } from "./TranslationUnit.tsx";
import { MASTHEAD_AUTHOR_ID, MASTHEAD_TITLE_ID, unitTranslating } from "./translationMasthead.ts";
import "../reader.css";

export interface EnglishFaceProps {
  /** Which faces have content, derived by PaperPage from the same counts it dispatches on. */
  readonly availability?: Readonly<Partial<Record<FaceId, FaceAvailability>>> | undefined;
  readonly paper: Paper;
  readonly units: readonly TranslationUnit[];
  readonly alignment?: Alignment | undefined;
  readonly editorialNotes?: readonly EditorialNote[] | undefined;
  readonly reviewRecords?: readonly ReviewRecord[] | undefined;
  readonly sectionId?: string | undefined;
  /** The German blocks, when the edition has them: they say which units share a paragraph. */
  readonly blocks?: readonly SourceBlock[] | undefined;
  /** The paper's sections no translation unit reaches yet (editionCoverage.ts), in its order. */
  readonly untranslatedSections?: readonly string[] | undefined;
}

export function EnglishFace({
  paper,
  units,
  alignment,
  editorialNotes = [],
  reviewRecords = [],
  sectionId,
  availability,
  blocks,
  untranslatedSections = [],
}: EnglishFaceProps) {
  const alignmentIndex = buildAlignmentIndex(alignment, undefined, units);
  // A footnote mark links to the unit that translates the footnote, which this face does render.
  const footnoteUnits = unitsBySourceRef(units);
  // The masthead's units head the page instead of opening the body.
  const titleUnit = unitTranslating(units, MASTHEAD_TITLE_ID);
  const authorUnit = unitTranslating(units, MASTHEAD_AUTHOR_ID);
  const bodyUnits = units.filter((u) => u !== titleUnit && u !== authorUnit);
  // No review banner, review chip or translator credit (D-2026-09-25-no-review-status-banners,
  // the owner: "we don't need messages like this on the site"). Who translated and checked each
  // unit stays in its record (translator, agentReview) and in the provenance receipt.

  return (
    <div
      data-reader-root
      data-ready="true"
      data-view="english"
      data-face="english"
      className="reader-root face-english"
      lang="en"
    >
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: harness data-ready contract; source from a tested pure function. */}
      <script dangerouslySetInnerHTML={{ __html: ROOT_ARMING_SOURCE }} />
      <header className="page-intro" lang="en">
        <p className="eyebrow">Translation · {paper.titleEnglishWorking}</p>
        {/* The translated masthead is the title, under its own unit id (translationMasthead.ts);
            Einstein's title stands beneath it. */}
        <h1
          className="translation-paper-title"
          id={titleUnit?.id}
          data-translation-unit-id={titleUnit?.id}
        >
          {titleUnit
            ? renderInlines(titleUnit.inlines, undefined, `tr-${titleUnit.id}`)
            : paper.titleEnglishWorking}
        </h1>
        <p className="parallel-german-title" lang="de">
          <em>{paper.titleGerman}</em>
        </p>
        <p
          className="translation-author-line"
          id={authorUnit?.id}
          data-translation-unit-id={authorUnit?.id}
        >
          {authorUnit
            ? renderInlines(authorUnit.inlines, undefined, `tr-${authorUnit.id}`)
            : `By ${paper.authorLine}`}
        </p>
      </header>

      {/* What the translation does not reach yet, named, so a partial edition is never read as the
          whole paper (editionCoverage.ts). It qualifies the text, so it shares its column: at 1440
          it spanned 1,256px above what is now a 666px measure (dispatch 210). */}
      {untranslatedSections.length > 0 ? (
        <div className="reading-column">
          <p className="notice" data-untranslated-sections={untranslatedSections.join(" ")}>
            This translation does not yet cover the whole paper. Not yet translated:{" "}
            {sectionsLabel(untranslatedSections)}.
          </p>
        </div>
      ) : null}

      {/* The chooser every face uses, with this face the current tab (FaceChooser.tsx). */}
      <FaceChooser
        paperId={paper.slug}
        section={sectionId}
        current="english"
        availability={availability}
      />

      {/* The reader's measure and type step, as the German face reads (readingSettings.css
          .reading-column): at 1440 the English ran 1,256px at 19px, 186 to 200 characters a line,
          beside a German face at 666px and 22.8px (dispatch 210). */}
      <main className="translation-units-list reading-column" data-translation-body>
        <TranslationParagraphs
          units={bodyUnits}
          alignment={alignment}
          blocks={blocks}
          reviewRecords={reviewRecords}
          editorialNotes={editorialNotes}
          footnoteUnits={footnoteUnits}
        />
      </main>

      <AlignmentController index={alignmentIndex} />
    </div>
  );
}
