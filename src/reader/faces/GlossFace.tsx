import { GlossReasoningToggle } from "./GlossReasoningToggle.tsx";
import "./glossReasoning.css";
import { Fragment } from "react";
import { plainText } from "../../content/schemas/inlines.ts";
import type { ReviewRecord } from "../../content/schemas/review.ts";
import type {
  Alignment,
  EditorialNote,
  GlossUnit,
  Paper,
  SourceBlock,
  TranslationUnit,
} from "../../content/schemas/source.ts";
import { FaceChooser } from "../FaceChooser.tsx";
import type { FaceAvailability } from "../faceAvailability.ts";
import { AlignmentController } from "./AlignmentController.tsx";
import { buildAlignmentIndex } from "./alignment.ts";
import { claimedDisplayIds } from "./displayClaims.ts";
import { sectionsLabel } from "./editionCoverage.ts";
import { GlossSentence } from "./GlossSentence.tsx";
import { sentenceAtoms } from "./glossStream.ts";
import { renderInlines } from "./inlines.tsx";
import { speakInlines } from "./mathSpeech.ts";
import { PageLocators } from "./PageLocators.tsx";
import type { FaceId } from "./registry.ts";
import { SourceBlock as SourceBlockComponent } from "./SourceBlock.tsx";
import { sentenceInlines } from "./sentenceInlines.ts";

export interface GlossEntryLink {
  readonly href: string;
  readonly caption: string;
  readonly label?: string | undefined;
}

export interface GlossFaceProps {
  /** Which faces have content, derived by PaperPage from the same counts it dispatches on. */
  readonly availability?: Readonly<Partial<Record<FaceId, FaceAvailability>>> | undefined;
  readonly paper: Paper;
  readonly blocks: readonly SourceBlock[];
  readonly glossUnits: readonly GlossUnit[];
  readonly translations?: readonly TranslationUnit[] | undefined;
  readonly alignment?: Alignment | undefined;
  readonly editorialNotes?: readonly EditorialNote[] | undefined;
  /**
   * The translation's review records. Nothing on this face reads them for the gloss: they name
   * translation units, whose ids are often the sentence ids a gloss unit carries.
   */
  readonly reviewRecords?: readonly ReviewRecord[] | undefined;
  readonly entryLink?: GlossEntryLink | undefined;
  readonly initialReasoningWords?: boolean | undefined;
  /**
   * The modality vocabulary for this edition, resolved once by the route with
   * `getModalityClasses()` and passed in as data. The face does not read
   * `docs/editorial/GLOSS_CONVENTIONS.md` itself: that keeps the whole gloss
   * subtree free of `node:fs`, so `GlossReasoningToggle` and any later client
   * component in it stay legal. See am-bwnf.
   */
  readonly modalityClasses: readonly string[];
  /**
   * The paper's sections, in its order, that no gloss unit reaches yet (editionCoverage.ts
   * unglossedSections, from the frozen manifest), named once at the top of the face.
   */
  readonly unglossedSections?: readonly string[] | undefined;
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
  entryLink,
  initialReasoningWords = false,
  modalityClasses,
  availability,
  unglossedSections = [],
}: GlossFaceProps) {
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
  const alignmentIndex = alignment ? buildAlignmentIndex(alignment, blocks, translations) : null;
  const glossMap = new Map<string, GlossUnit>(glossUnits.map((g) => [g.sentenceId, g]));
  const translationMap = new Map<string, TranslationUnit>(translations.map((t) => [t.id, t]));

  // Footnote blocks to render in the bottom footnotes section
  const footnoteBlocks = blocks.filter((b) => b.kind === "footnote");

  // The aligned English of a sentence, as the gloss line under it reads it.
  const englishFor = (sentenceId: string): string | undefined => {
    const targets = alignmentIndex?.sourceToTarget.get(sentenceId);
    const trUnits = (targets ?? [])
      .map((tId) => translationMap.get(tId))
      .filter(Boolean) as TranslationUnit[];
    if (trUnits.length === 0) return undefined;
    // Every word and every quantity: speakInlines keeps emphasis and speaks each formula, where
    // this took text inlines alone and left a sentence's formulas out of what a screen reader heard.
    return trUnits.map((u) => speakInlines(u.inlines)).join(" ");
  };
  const glossSentenceFor = (
    block: SourceBlock,
    sp: SourceBlock["sentenceSpans"][number],
    elementId?: string | null,
  ) => (
    <GlossSentence
      key={sp.id}
      sentenceId={sp.id}
      elementId={elementId}
      germanText={block.diplomaticText.slice(sp.span.start, sp.span.end)}
      atoms={sentenceAtoms(block.inlines, sp.span)}
      germanInlines={sentenceInlines(block.inlines, sp.span)}
      glossUnit={glossMap.get(sp.id)}
      englishTranslation={englishFor(sp.id)}
      paperSlug={paper.slug}
      showReasoningWords
      modalityClasses={modalityClasses}
    />
  );
  // Each display is printed once (displayClaims.ts): after the sentence whose span holds its
  // reference, and not again as a free-standing block after the whole paragraph.
  const claimedDisplays = claimedDisplayIds(blocks);
  const equationById = new Map(blocks.filter((b) => b.kind === "equation").map((b) => [b.id, b]));
  const renderEquation = (eq: SourceBlock) => (
    <SourceBlockComponent
      key={eq.id}
      block={eq}
      paperSlug={paper.slug}
      editorialNotes={editorialNotes}
    />
  );
  const displaysIn = (
    block: SourceBlock,
    span: { start: number; end: number },
    placed: Set<string>,
  ): SourceBlock[] => {
    const out: SourceBlock[] = [];
    let offset = 0;
    for (const node of block.inlines) {
      const length = Array.from(plainText([node])).length;
      if (node.kind === "math" && node.display && node.equationId) {
        const eq = equationById.get(node.equationId);
        if (eq && !placed.has(eq.id) && offset >= span.start && offset <= span.end) {
          placed.add(eq.id);
          out.push(eq);
        }
      }
      offset += length;
    }
    return out;
  };

  return (
    <article
      className="reader-face gloss-face"
      data-reader-root
      data-face="gloss"
      data-paper-slug={paper.slug}
      data-reasoning-words={initialReasoningWords ? "on" : "off"}
    >
      {/* No review banner (D-2026-09-25-no-review-status-banners): each gloss unit's record keeps
          who drafted it and its review state. */}
      {/* What the gloss does not reach yet, named once, as the English face names its untranslated
          sections: a gloss that arrives a section at a time is never read as the whole paper, and
          each unglossed sentence carries only a link (GlossSentence.tsx), not a notice of its own. */}
      {unglossedSections.length > 0 ? (
        <p className="notice" data-unglossed-sections={unglossedSections.join(" ")}>
          This gloss does not yet cover the whole paper. Not yet glossed:{" "}
          {sectionsLabel(unglossedSections)}.
        </p>
      ) : null}

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
          <GlossReasoningToggle initiallyChecked={initialReasoningWords} />
        </div>
      </header>

      {/* The chooser every face uses, with this face the current tab (FaceChooser.tsx). */}
      <FaceChooser paperId={paper.slug} current="gloss" availability={availability} />

      {/* Main Blocks Stream */}
      <main className="gloss-face-content">
        {blocks.map((block) => {
          // Footnotes are collected into their own glossed list below.
          if (block.kind === "footnote") return null;
          // A display its paragraph prints is set after the sentence that prints it.
          if (block.kind === "equation")
            return claimedDisplays.has(block.id) ? null : renderEquation(block);
          const single = block.sentenceSpans?.length === 1 ? block.sentenceSpans[0] : undefined;
          // A heading keeps its own element, for the outline and its anchor, and a glossed one
          // prints its gloss sentence under it (dispatch 221): a section heading is German the
          // reader reads, often the hardest sentence in the section. The gloss carries no id of
          // its own, since the heading already has the block id. An unglossed heading prints
          // nothing more, and no fallback link, as it did before.
          if (block.kind === "heading" || block.kind === "part-heading") {
            const heading = (
              <SourceBlockComponent
                key={block.id}
                block={block}
                paperSlug={paper.slug}
                editorialNotes={editorialNotes}
              />
            );
            if (!single || !glossMap.has(single.id)) return heading;
            return (
              <Fragment key={block.id}>
                {heading}
                {glossSentenceFor(block, single, null)}
              </Fragment>
            );
          }
          // A masthead or closing line is glossed as one unit, under its block id.
          if (
            (block.kind === "masthead" || block.kind === "closing") &&
            single &&
            glossMap.has(single.id)
          ) {
            return (
              <div
                key={block.id}
                className="gloss-block-wrapper"
                data-block-id={block.id}
                data-block-kind={block.kind}
              >
                {glossSentenceFor(block, single)}
              </div>
            );
          }

          if (block.kind === "paragraph") {
            const locators = (
              <PageLocators
                paper={paper.slug}
                pages={block.locators.map((loc) => loc.printedPage)}
              />
            );

            // If sentence spans exist, render each sentence with its gloss, and after it any
            // display the sentence prints.
            if (block.sentenceSpans && block.sentenceSpans.length > 0) {
              const placed = new Set<string>();
              return (
                <div key={block.id} className="gloss-block-wrapper" data-block-id={block.id}>
                  {locators}
                  {block.sentenceSpans.map((sp) => (
                    <Fragment key={sp.id}>
                      {glossSentenceFor(block, sp)}
                      {displaysIn(block, sp.span, placed).map(renderEquation)}
                    </Fragment>
                  ))}
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

      {/* Footnotes, each glossed as one unit under its block id. No backlink: this face renders
          no footnote marks, so a link back to one would name an id the page lacks. */}
      {footnoteBlocks.length > 0 && (
        <section className="reader-footnotes" aria-labelledby="gloss-footnotes-heading">
          <h2 id="gloss-footnotes-heading" className="footnotes-heading">
            Footnotes
          </h2>
          <ol className="footnotes-list">
            {footnoteBlocks.map((fn) => {
              const sp = fn.sentenceSpans?.[0];
              return (
                <li
                  key={fn.id}
                  id={`footnote-${fn.id}`}
                  className="footnote-item"
                  role="doc-footnote"
                  data-footnote-id={fn.id}
                >
                  {fn.originalLabel ? (
                    <span className="footnote-ref">{fn.originalLabel} </span>
                  ) : null}
                  {sp && glossMap.has(sp.id) ? (
                    glossSentenceFor(fn, sp)
                  ) : (
                    <span lang="de">{renderInlines(fn.inlines, undefined, `fn-${fn.id}`)}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {alignmentIndex && <AlignmentController index={alignmentIndex} />}
    </article>
  );
}
