import type { ReviewRecord } from "../../content/schemas/review.ts";
import type {
  Alignment,
  EditorialNote,
  Paper,
  TranslationUnit,
} from "../../content/schemas/source.ts";
import { FACE_FALLBACK_IDS, faceLinkHref } from "../paperRoutes.ts";
import { ROOT_ARMING_SOURCE } from "../rootArming.inline.ts";
import { AlignmentController } from "./AlignmentController.tsx";
import { buildAlignmentIndex } from "./alignment.ts";
import { FACE_REGISTRY } from "./registry.ts";
import { isPaperTranslationUnreviewed } from "./reviewState.ts";
import { TranslationUnit as TranslationUnitItem, unitsBySourceRef } from "./TranslationUnit.tsx";
import { UnreviewedBanner } from "./UnreviewedBanner.tsx";
import "../reader.css";

export interface EnglishFaceProps {
  readonly paper: Paper;
  readonly units: readonly TranslationUnit[];
  readonly alignment?: Alignment | undefined;
  readonly editorialNotes?: readonly EditorialNote[] | undefined;
  readonly reviewRecords?: readonly ReviewRecord[] | undefined;
  readonly sectionId?: string | undefined;
}

export function EnglishFace({
  paper,
  units,
  alignment,
  editorialNotes = [],
  reviewRecords = [],
  sectionId,
}: EnglishFaceProps) {
  const isUnreviewed = isPaperTranslationUnreviewed(units, reviewRecords);
  const alignmentIndex = buildAlignmentIndex(alignment, undefined, units);
  // A footnote mark links to the unit that translates the footnote, which this face does render.
  const footnoteUnits = unitsBySourceRef(units);

  const reviewRecordsMap = new Map<string, ReviewRecord>();
  for (const rec of reviewRecords) {
    for (const scope of rec.scope) {
      reviewRecordsMap.set(scope.recordId, rec);
    }
  }

  // Get primary translator info from first unit if available
  const primaryTranslator =
    units[0]?.translator?.name || units[0]?.translator?.id || "Translation team";

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
        <h1 className="translation-paper-title">{paper.titleEnglishWorking}</h1>
        <p className="translation-author-line">By {paper.authorLine}</p>
        <p className="translator-credit fine">Translated by {primaryTranslator}</p>
      </header>

      {isUnreviewed && <UnreviewedBanner />}

      <nav className="reader-controls" aria-label="Reading face">
        <a
          href={
            sectionId
              ? faceLinkHref(paper.slug, "reading", sectionId)
              : faceLinkHref(paper.slug, "reading")
          }
          data-view-link="reading"
        >
          Explanation
        </a>
        {FACE_FALLBACK_IDS.map((id) => (
          <a
            key={id}
            href={
              sectionId ? faceLinkHref(paper.slug, id, sectionId) : faceLinkHref(paper.slug, id)
            }
            data-view-link={id}
            aria-current={id === "english" ? "page" : undefined}
          >
            {FACE_REGISTRY[id].label}
          </a>
        ))}
      </nav>

      <main className="translation-units-list" data-translation-body>
        {units.map((unit) => (
          <TranslationUnitItem
            key={unit.id}
            unit={unit}
            reviewRecord={reviewRecordsMap.get(unit.id)}
            editorialNotes={editorialNotes}
            footnoteUnits={footnoteUnits}
          />
        ))}
      </main>

      <AlignmentController index={alignmentIndex} />
    </div>
  );
}
