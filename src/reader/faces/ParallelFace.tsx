import React from "react";
import type { ReviewRecord } from "../../content/schemas/review.ts";
import type {
  Alignment,
  EditorialNote,
  Paper,
  SourceBlock,
  TranslationUnit,
} from "../../content/schemas/source.ts";
import { FACE_FALLBACK_IDS, faceLinkHref } from "../paperRoutes.ts";
import { ROOT_ARMING_SOURCE } from "../rootArming.inline.ts";
import { AlignmentController } from "./AlignmentController.tsx";
import { buildAlignmentIndex } from "./alignment.ts";
import { FootnotesSection } from "./Footnote.tsx";
import { FACE_REGISTRY } from "./registry.ts";
import { isPaperTranslationUnreviewed } from "./reviewState.ts";
import { SourceBlock as SourceBlockItem } from "./SourceBlock.tsx";
import { TranslationUnit as TranslationUnitItem } from "./TranslationUnit.tsx";
import { UnreviewedBanner } from "./UnreviewedBanner.tsx";
import "../reader.css";

export interface ParallelFaceProps {
  readonly paper: Paper;
  readonly blocks: readonly SourceBlock[];
  readonly units: readonly TranslationUnit[];
  readonly alignment: Alignment;
  readonly editorialNotes?: readonly EditorialNote[] | undefined;
  readonly reviewRecords?: readonly ReviewRecord[] | undefined;
  readonly sectionId?: string | undefined;
  readonly layout?: "side-by-side" | "stacked" | undefined;
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
}: ParallelFaceProps) {
  const isUnreviewed = isPaperTranslationUnreviewed(units, reviewRecords);
  const isStacked = layout === "stacked";
  const alignmentIndex = buildAlignmentIndex(alignment, blocks, units);

  const filteredBlocks = sectionId
    ? blocks.filter((b) => b.section === sectionId || !b.section)
    : blocks;

  const footnoteBlocks = filteredBlocks.filter((b) => b.kind === "footnote");
  const mainBlocks = filteredBlocks.filter((b) => b.kind !== "footnote");

  const reviewRecordsMap = new Map<string, ReviewRecord>();
  for (const rec of reviewRecords) {
    for (const scope of rec.scope) {
      reviewRecordsMap.set(scope.recordId, rec);
    }
  }

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
        <p className="eyebrow">Parallel Edition · {paper.titleEnglishWorking}</p>
        <h1 className="parallel-paper-title">{paper.titleEnglishWorking}</h1>
        <p className="parallel-german-title" lang="de">
          <em>{paper.titleGerman}</em>
        </p>
        <p className="parallel-author">By {paper.authorLine}</p>
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
            aria-current={id === "parallel" ? "page" : undefined}
          >
            {FACE_REGISTRY[id].label}
          </a>
        ))}
      </nav>

      <div className="parallel-help-bar fine" aria-label="Alignment guidance">
        <p>
          Hover or focus a sentence to highlight its aligned counterpart. Press <kbd>j</kbd> /{" "}
          <kbd>k</kbd> to step through sentences in reading order.
        </p>
      </div>

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
            {units.map((unit) => (
              <TranslationUnitItem
                key={unit.id}
                unit={unit}
                reviewRecord={reviewRecordsMap.get(unit.id)}
                editorialNotes={editorialNotes}
              />
            ))}
          </div>
        </section>
      </div>

      <AlignmentController index={alignmentIndex} />
    </div>
  );
}
