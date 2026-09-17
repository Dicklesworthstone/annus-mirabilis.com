import { renderToString } from "katex";
import type React from "react";
import type { Inline } from "../../content/schemas/inlines.ts";
import { plainText } from "../../content/schemas/inlines.ts";
import type { EditorialNote, SourceBlock, SpanAnchor } from "../../content/schemas/source.ts";
import { EditorialNoteMarker } from "./EditorialNoteMarker.tsx";
import { renderInlines } from "./inlines.tsx";

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

  const locators = block.locators.map((loc, i) => (
    <span key={`${loc.printedPage}-${i}`} className="block-locator">
      <a
        href={`/papers/${paperSlug}/?view=facsimile#page-${loc.printedPage}`}
        data-facsimile-link={loc.printedPage}
        aria-label={`Facsimile page ${loc.printedPage}`}
        className="locator-link"
      >
        [p. {loc.printedPage}]
      </a>
    </span>
  ));

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
      let renderedMath: string;
      try {
        renderedMath = renderToString(rawLatex, {
          displayMode: true,
          output: "htmlAndMathml",
          throwOnError: false,
          strict: "warn",
          trust: false,
        });
      } catch {
        renderedMath = `<code class="math-fallback">${rawLatex}</code>`;
      }

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
            <div
              className="equation-body"
              data-printed-notation="true"
              dangerouslySetInnerHTML={{ __html: renderedMath }}
            />
            {block.originalLabel && (
              <span className="equation-label" data-equation-label={block.originalLabel}>
                ({block.originalLabel})
              </span>
            )}
          </div>
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
            {renderInlines(block.inlines, undefined, `src-${block.id}`)}
          </div>
        </aside>
      );
      break;

    case "paragraph":
    default: {
      // Check if sentence spans exist for sentence-level alignment
      if (block.sentenceSpans && block.sentenceSpans.length > 0) {
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
              const isActive = activeSentenceId === span.id;
              const isHighlighted = highlightedSentenceIds?.has(span.id) ?? false;
              const spanInlines = getInlinesForSpan(block.inlines, span.span);
              const content =
                spanInlines.length > 0
                  ? renderInlines(spanInlines, undefined, `src-span-${span.id}`)
                  : block.diplomaticText.slice(span.span.start, span.span.end);

              return (
                <span
                  key={span.id}
                  id={span.id}
                  data-sentence-id={span.id}
                  data-source-sentence="true"
                  data-aligned-active={isActive ? "true" : undefined}
                  data-aligned-partner={!isActive && isHighlighted ? "true" : undefined}
                  className={`source-sentence ${isActive ? "is-active" : ""} ${isHighlighted ? "is-highlighted" : ""}`}
                  tabIndex={0}
                >
                  {content}{" "}
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
    <div className="source-block-wrapper" data-block-wrapper={block.id}>
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
