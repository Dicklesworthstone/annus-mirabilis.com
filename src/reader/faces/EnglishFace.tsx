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
import { isPaperTranslationUnreviewed, translationReviewSummary } from "./reviewState.ts";
import { TranslationParagraphs } from "./TranslationParagraphs.tsx";
import { unitsBySourceRef } from "./TranslationUnit.tsx";
import { MASTHEAD_AUTHOR_ID, MASTHEAD_TITLE_ID, unitTranslating } from "./translationMasthead.ts";
import { UnreviewedBanner } from "./UnreviewedBanner.tsx";
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
  const isUnreviewed = isPaperTranslationUnreviewed(units, reviewRecords);
  const alignmentIndex = buildAlignmentIndex(alignment, undefined, units);
  // A footnote mark links to the unit that translates the footnote, which this face does render.
  const footnoteUnits = unitsBySourceRef(units);
  // The masthead's units head the page instead of opening the body.
  const titleUnit = unitTranslating(units, MASTHEAD_TITLE_ID);
  const authorUnit = unitTranslating(units, MASTHEAD_AUTHOR_ID);
  const bodyUnits = units.filter((u) => u !== titleUnit && u !== authorUnit);
  // Review state is said once, here, from the units themselves (translationReviewSummary).
  const review = translationReviewSummary(units, reviewRecords);

  // Every translator the units record, in order of first appearance. A paper translated a part
  // at a time by more than one agent credits each of them: the first unit's translator alone
  // would sign the whole face with one name, including sections someone else translated.
  const translatorNames = [
    ...new Set(
      units
        .map((u) => u.translator?.name?.trim() || u.translator?.id?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ];
  const primaryTranslator =
    translatorNames.length <= 1
      ? (translatorNames[0] ?? "Translation team")
      : `${translatorNames.slice(0, -1).join(", ")} and ${translatorNames.at(-1)}`;

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
        <p className="translator-credit fine">Translated by {primaryTranslator}</p>
      </header>

      {(isUnreviewed || review.agentChecked) && (
        <UnreviewedBanner
          title={review.title}
          message={review.message}
          kind={isUnreviewed ? "unreviewed" : "agent-checked"}
        />
      )}

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
        current="english"
        availability={availability}
      />

      <main className="translation-units-list" data-translation-body>
        <TranslationParagraphs
          units={bodyUnits}
          alignment={alignment}
          blocks={blocks}
          reviewRecords={reviewRecords}
          editorialNotes={editorialNotes}
          footnoteUnits={footnoteUnits}
          commonLabel={review.commonLabel}
        />
      </main>

      <AlignmentController index={alignmentIndex} />
    </div>
  );
}
