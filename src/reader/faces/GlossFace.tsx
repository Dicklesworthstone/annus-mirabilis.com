import { useState } from "react";
import { getModalityClasses } from "../../content/schemas/glossConventions.ts";
import type { ReviewRecord } from "../../content/schemas/review.ts";
import type {
  Alignment,
  EditorialNote,
  GlossUnit,
  Paper,
  SourceBlock,
  TranslationUnit,
} from "../../content/schemas/source.ts";
import { buildAlignmentIndex } from "./alignment.ts";
import { AlignmentController } from "./AlignmentController.tsx";
import { FootnotesSection } from "./Footnote.tsx";
import { GlossSentence } from "./GlossSentence.tsx";
import { isPaperTranslationUnreviewed } from "./reviewState.ts";
import { SourceBlock as SourceBlockComponent } from "./SourceBlock.tsx";
import { UnreviewedBanner } from "./UnreviewedBanner.tsx";

export interface GlossEntryLink {
  readonly href: string;
  readonly caption: string;
  readonly label?: string | undefined;
}

export interface GlossFaceProps {
  readonly paper: Paper;
  readonly blocks: readonly SourceBlock[];
  readonly glossUnits: readonly GlossUnit[];
  readonly translations?: readonly TranslationUnit[] | undefined;
  readonly alignment?: Alignment | undefined;
  readonly editorialNotes?: readonly EditorialNote[] | undefined;
  readonly reviewRecords?: readonly ReviewRecord[] | undefined;
  readonly entryLink?: GlossEntryLink | undefined;
  readonly initialReasoningWords?: boolean | undefined;
  readonly modalityClasses?: readonly string[] | undefined;
}

/**
 * Continuous Interlinear Gloss Reading Face (?view=gloss).
 * Renders each German sentence with word-by-word English gloss beneath it.
 * Offers "Show the reasoning words" toggle, sentence-level assistive actions,
 * in-place reasoning words list, entry-link slot, and honest coverage fallback.
 */
export function GlossFace({
  paper,
  blocks,
  glossUnits = [],
  translations = [],
  alignment,
  editorialNotes = [],
  reviewRecords = [],
  entryLink,
  initialReasoningWords = false,
  modalityClasses: propModalityClasses,
}: GlossFaceProps) {
  const [showReasoningWords, setShowReasoningWords] = useState(initialReasoningWords);

  const activeModalityClasses = propModalityClasses ?? getModalityClasses();

  // If no source blocks exist for the paper, render an honest fallback
  if (!blocks || blocks.length === 0) {
    return (
      <div className="face-fallback gloss-face-fallback" data-face-fallback="gloss">
        <header className="fallback-header">
          <h1 className="fallback-title">{paper.titleGerman || paper.titleEnglishWorking}</h1>
          <p className="fallback-notice">
            German source text and interlinear gloss for this paper are in preparation.
          </p>
        </header>
      </div>
    );
  }

  // Build alignment index for looking up aligned translations by sentenceId
  const alignmentIndex = alignment
    ? buildAlignmentIndex(alignment, blocks, translations)
    : null;
  const glossMap = new Map<string, GlossUnit>(glossUnits.map((g) => [g.sentenceId, g]));
  const translationMap = new Map<string, TranslationUnit>(translations.map((t) => [t.id, t]));

  // Footnote blocks to render in the bottom footnotes section
  const footnoteBlocks = blocks.filter((b) => b.kind === "footnote");

  // Determine if gloss translation is unreviewed
  const hasUnreviewed = isPaperTranslationUnreviewed(translations, reviewRecords);

  return (
    <article
      className="reader-face gloss-face"
      data-reader-root
      data-face="gloss"
      data-paper-slug={paper.slug}
      data-reasoning-words={showReasoningWords ? "on" : "off"}
    >
      {/* Optional Unreviewed Translation Banner */}
      {hasUnreviewed && <UnreviewedBanner />}

      {/* Entry link slot (when configured) */}
      {entryLink && (
        <nav className="gloss-entry-link-slot" aria-label="Foundation entry link">
          <a
            href={entryLink.href}
            data-entry-link="true"
            data-return-caption={entryLink.caption}
            className="foundation-entry-link"
          >
            {entryLink.label || entryLink.caption}
          </a>
        </nav>
      )}

      {/* Face header and Controls */}
      <header className="gloss-face-header">
        <div className="face-title-group">
          <h1 className="face-title" lang="de">
            {paper.titleGerman}
          </h1>
          {paper.titleEnglishWorking && (
            <p className="face-subtitle" lang="en">
              {paper.titleEnglishWorking}
            </p>
          )}
        </div>

        <div className="gloss-face-controls">
          <label className="reasoning-toggle-label">
            <input
              type="checkbox"
              id="toggle-reasoning-words"
              data-toggle-reasoning="true"
              checked={showReasoningWords}
              onChange={(e) => setShowReasoningWords(e.target.checked)}
              className="reasoning-toggle-checkbox"
            />
            <span className="toggle-text">Show the reasoning words</span>
          </label>
        </div>
      </header>

      {/* Main Blocks Stream */}
      <main className="gloss-face-content">
        {blocks.map((block) => {
          if (block.kind === "footnote") {
            // Footnotes are collected and rendered at the end of the section
            return null;
          }

          if (block.kind === "heading" || block.kind === "part-heading") {
            return (
              <SourceBlockComponent
                key={block.id}
                block={block}
                paperSlug={paper.slug}
                editorialNotes={editorialNotes}
              />
            );
          }

          if (block.kind === "equation") {
            return (
              <SourceBlockComponent
                key={block.id}
                block={block}
                paperSlug={paper.slug}
                editorialNotes={editorialNotes}
              />
            );
          }

          if (block.kind === "paragraph") {
            const locators = block.locators.map((loc) => (
              <span key={`${block.id}-loc-${loc.printedPage}`} className="block-locator">
                <a
                  href={`/papers/${paper.slug}/?view=facsimile#page-${loc.printedPage}`}
                  data-facsimile-link={loc.printedPage}
                  aria-label={`Facsimile page ${loc.printedPage}`}
                  className="locator-link"
                >
                  [p. {loc.printedPage}]
                </a>
              </span>
            ));

            // If sentence spans exist, render each sentence with its gloss
            if (block.sentenceSpans && block.sentenceSpans.length > 0) {
              return (
                <div key={block.id} className="gloss-block-wrapper" data-block-id={block.id}>
                  {locators}
                  {block.sentenceSpans.map((sp) => {
                    const glossUnit = glossMap.get(sp.id);
                    const germanSentenceText = block.diplomaticText.slice(
                      sp.span.start,
                      sp.span.end,
                    );

                    // Lookup aligned English translation if available
                    let englishText: string | undefined;
                    if (alignmentIndex) {
                      const targets = alignmentIndex.sourceToTarget.get(sp.id);
                      if (targets && targets.length > 0) {
                        const trUnits = targets
                          .map((tId) => translationMap.get(tId))
                          .filter(Boolean) as TranslationUnit[];
                        if (trUnits.length > 0) {
                          englishText = trUnits
                            .map((u) =>
                              u.inlines.map((inl) => ("text" in inl ? inl.text : "")).join(" "),
                            )
                            .join(" ");
                        }
                      }
                    }

                    return (
                      <GlossSentence
                        key={sp.id}
                        sentenceId={sp.id}
                        germanText={germanSentenceText}
                        glossUnit={glossUnit}
                        englishTranslation={englishText}
                        paperSlug={paper.slug}
                        showReasoningWords={showReasoningWords}
                        modalityClasses={activeModalityClasses}
                      />
                    );
                  })}
                </div>
              );
            }

            // Paragraph without sentence spans: fallback to SourceBlock
            return (
              <SourceBlockComponent
                key={block.id}
                block={block}
                paperSlug={paper.slug}
                editorialNotes={editorialNotes}
              />
            );
          }

          return (
            <SourceBlockComponent
              key={block.id}
              block={block}
              paperSlug={paper.slug}
              editorialNotes={editorialNotes}
            />
          );
        })}
      </main>

      {/* Footnotes Section */}
      {footnoteBlocks.length > 0 && <FootnotesSection footnotes={footnoteBlocks} />}

      {alignmentIndex && <AlignmentController index={alignmentIndex} />}
    </article>
  );
}
