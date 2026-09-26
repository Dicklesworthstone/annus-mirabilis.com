import { renderToString } from "katex";
import type React from "react";
import { Fragment } from "react";
import type { Inline } from "../../content/schemas/inlines.ts";
import { plainText } from "../../content/schemas/inlines.ts";
import type { EditorialNote, SourceBlock, SpanAnchor } from "../../content/schemas/source.ts";
import { printedDisplay } from "../../equations/printed/printedDisplays.ts";
import { DisplayMisprintNote } from "./DisplayMisprintNote.tsx";
import { EditorialNoteMarker } from "./EditorialNoteMarker.tsx";
import { renderInlines } from "./inlines.tsx";
import { PageLocators } from "./PageLocators.tsx";
import { PageTurnMark } from "./PageTurnMark.tsx";
import { PrintedDisplayTerms } from "./PrintedDisplayTerms.tsx";
import { blockTurns, piecesWithTurns } from "./pageTurnPlaces.ts";

export interface SourceBlockProps {
  readonly block: SourceBlock;
  readonly paperSlug?: string | undefined;
  readonly editorialNotes?: readonly EditorialNote[] | undefined;
  readonly activeSentenceId?: string | null | undefined;
  readonly highlightedSentenceIds?: ReadonlySet<string> | undefined;
}

function getInlinesForSpan(inlines: readonly Inline[], span: SpanAnchor): readonly Inline[] {
  if (!inlines || inlines.length === 0) return [];

  const spanInlines: Inline[] = [];
  let currentOffset = 0;

  for (const node of inlines) {
    const text = plainText([node]);
    const len = Array.from(text).length;
    const start = currentOffset;
    const end = currentOffset + len;

    if (len === 0) {
      if (start >= span.start && start <= span.end) {
        spanInlines.push(node);
      }
    } else if (start < span.end && end > span.start) {
      spanInlines.push(node);
    }

    currentOffset = end;
  }

  return spanInlines;
}

export function SourceBlockComponent({
  block,
  paperSlug = "brownian-motion",
  editorialNotes = [],
  activeSentenceId,
  highlightedSentenceIds,
}: SourceBlockProps) {
  const lang = block.lang ?? "de";
  const matchingNotes = editorialNotes.filter(
    (n) =>
      n.affectedIds.includes(block.id) ||
      block.sentenceSpans.some((sp) => n.affectedIds.includes(sp.id)),
  );

  const locators = (
    <PageLocators paper={paperSlug} pages={block.locators.map((loc) => loc.printedPage)} />
  );

  // Render content based on block kind
  let bodyContent: React.ReactNode = null;

  switch (block.kind) {
    case "part-heading":
      bodyContent = (
        <h1 id={block.id} className="source-part-heading" data-block-id={block.id} lang={lang}>
          {locators}
          {renderInlines(block.inlines, undefined, `src-${block.id}`)}
        </h1>
      );
      break;

    case "heading":
      bodyContent = (
        <h2 id={block.id} className="source-heading" data-block-id={block.id} lang={lang}>
          {locators}
          {renderInlines(block.inlines, undefined, `src-${block.id}`)}
        </h2>
      );
      break;

    case "masthead":
      bodyContent = (
        <header id={block.id} className="source-masthead" data-block-id={block.id} lang={lang}>
          {locators}
          <div className="masthead-content">
            {renderInlines(block.inlines, undefined, `src-${block.id}`)}
          </div>
        </header>
      );
      break;

    case "closing":
      bodyContent = (
        <div id={block.id} className="source-closing" data-block-id={block.id} lang={lang}>
          {locators}
          <div className="closing-content">
            {renderInlines(block.inlines, undefined, `src-${block.id}`)}
          </div>
        </div>
      );
      break;

    case "equation": {
      // Equations on the German face are strictly in printed notation only.
      // Modern notation toggle is never available on source face.
      const rawLatex =
        block.diplomaticText || block.inlines.map((i) => ("latex" in i ? i.latex : "")).join(" ");
      const mathInline = block.inlines.find((i) => i.kind === "math");
      const equationId =
        mathInline && "equationId" in mathInline && typeof mathInline.equationId === "string"
          ? mathInline.equationId
          : undefined;
      // In colour where content/display-terms binds its glyphs (PrintedDisplayTerms.tsx).
      const printed = printedDisplay(equationId, rawLatex);
      let renderedMath: string;
      try {
        renderedMath =
          printed?.html ??
          renderToString(rawLatex, {
            displayMode: true,
            output: "htmlAndMathml",
            throwOnError: false,
            strict: "warn",
            trust: false,
          });
      } catch {
        renderedMath = `<code class="math-fallback">${rawLatex}</code>`;
      }
      const body = (
        <div
          className="equation-body"
          data-printed-notation="true"
          {...{ dangerouslySetInnerHTML: { __html: renderedMath } }}
        />
      );

      bodyContent = (
        <div
          id={block.id}
          className="source-equation"
          data-block-id={block.id}
          data-kind="equation"
          data-equation-id={equationId}
          lang={lang}
        >
          {locators}
          <div className="equation-container">
            {printed ? (
              <PrintedDisplayTerms display={printed} inline={false}>
                {body}
              </PrintedDisplayTerms>
            ) : (
              body
            )}
            {block.originalLabel && (
              <span className="equation-label" data-equation-label={block.originalLabel}>
                ({block.originalLabel})
              </span>
            )}
          </div>
          <DisplayMisprintNote displayId={block.id} />
        </div>
      );
      break;
    }

    case "footnote":
      bodyContent = (
        <aside
          id={block.id}
          className="source-footnote"
          data-block-id={block.id}
          data-kind="footnote"
          lang={lang}
        >
          {locators}
          <div className="footnote-content">
            {renderInlines(block.inlines, { misprintNotes: true }, `src-${block.id}`)}
          </div>
        </aside>
      );
      break;

    default: {
      // Check if sentence spans exist for sentence-level alignment
      if (block.sentenceSpans && block.sentenceSpans.length > 0) {
        // Sentences are joined by a space, except where the print breaks the line between them:
        // a line-break inline in the data, "\n" in the plain text at the sentence's end (a
        // numbered relation such as § 1's "1." and "2.", folded into the paragraph that introduces
        // it). That renders as a break, not as the space.
        const characters = Array.from(plainText(block.inlines));
        // Where a printed page begins inside the paragraph (dispatch 255): the sentence that holds
        // a turn is cut there and the mark set between its words.
        const turns = blockTurns(block);
        const lastSpan = block.sentenceSpans[block.sentenceSpans.length - 1];
        bodyContent = (
          <p
            id={block.id}
            className="source-paragraph"
            data-block-id={block.id}
            data-kind="paragraph"
            lang={lang}
          >
            {locators}
            <button
              type="button"
              className="align-sentences-btn visually-hidden-focusable"
              data-align-sentences-control="true"
              data-block-id={block.id}
              aria-label={`Align sentences for paragraph ${block.id}`}
            >
              Align sentences
            </button>
            {block.sentenceSpans.map((span) => {
              const breakAfter = characters[span.span.end] === "\n";
              const isActive = activeSentenceId === span.id;
              const isHighlighted = highlightedSentenceIds?.has(span.id) ?? false;
              const spanInlines = getInlinesForSpan(block.inlines, span.span);
              const isLast = span === lastSpan;
              const turned = turns.some(
                (t) =>
                  t.at >= span.span.start &&
                  (t.at < span.span.end || (isLast && t.at === span.span.end)),
              );
              const content = turned
                ? piecesWithTurns(block.inlines, span.span.start, span.span.end, turns, isLast).map(
                    (piece) =>
                      piece.kind === "turn" ? (
                        <PageTurnMark
                          key={`turn-${piece.page}`}
                          paper={paperSlug}
                          page={piece.page}
                        />
                      ) : (
                        <Fragment key={`text-${piece.from}`}>
                          {renderInlines(
                            piece.inlines,
                            { misprintNotes: true },
                            `src-span-${span.id}-${piece.from}`,
                          )}
                        </Fragment>
                      ),
                  )
                : spanInlines.length > 0
                  ? renderInlines(spanInlines, { misprintNotes: true }, `src-span-${span.id}`)
                  : block.diplomaticText.slice(span.span.start, span.span.end);

              return (
                <Fragment key={span.id}>
                  <span
                    id={span.id}
                    data-sentence-id={span.id}
                    data-source-sentence="true"
                    data-aligned-active={isActive ? "true" : undefined}
                    data-aligned-partner={!isActive && isHighlighted ? "true" : undefined}
                    className={`source-sentence ${isActive ? "is-active" : ""} ${isHighlighted ? "is-highlighted" : ""}`}
                    tabIndex={-1}
                  >
                    {content}
                    {breakAfter ? null : " "}
                    <button
                      type="button"
                      className="show-aligned-action visually-hidden-focusable"
                      data-action="show-aligned-target"
                      data-source-id={span.id}
                      aria-label="Show the English translation of this sentence"
                      tabIndex={-1}
                    >
                      Show English translation
                    </button>
                  </span>
                  {breakAfter ? <br data-printed-line-break={span.id} /> : null}
                </Fragment>
              );
            })}
          </p>
        );
      } else {
        bodyContent = (
          <p
            id={block.id}
            className="source-paragraph"
            data-block-id={block.id}
            data-kind="paragraph"
            lang={lang}
          >
            {locators}
            {renderInlines(block.inlines, undefined, `src-${block.id}`)}
          </p>
        );
      }
      break;
    }
  }

  return (
    <div
      className="source-block-wrapper"
      data-block-wrapper={block.id}
      // The page the block starts on, which the plate beside the German face turns to
      // (FollowingPlate); a page turn inside the block carries its own.
      data-printed-page={block.locators[0]?.printedPage}
    >
      {bodyContent}
      {matchingNotes.length > 0 && (
        <div className="block-editorial-notes">
          {matchingNotes.map((note) => (
            <EditorialNoteMarker key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}

export { SourceBlockComponent as SourceBlock };
