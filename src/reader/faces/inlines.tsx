import { renderToString } from "katex";
import React from "react";
import { misprintNotes } from "../../content/provenance/misprints.ts";
import type { Inline } from "../../content/schemas/inlines.ts";
import { printedDisplay } from "../../equations/printed/printedDisplays.ts";
import { DisplayMisprintNote } from "./DisplayMisprintNote.tsx";
import { MisprintAnnotation } from "./MisprintAnnotation.tsx";
import { speakMath } from "./mathSpeech.ts";
import { PrintedDisplayTerms } from "./PrintedDisplayTerms.tsx";
import { referenceHref } from "./referenceHref.ts";
import { TermAnnotation } from "./TermAnnotation.tsx";

export interface RenderInlinesOptions {
  readonly renderMathInline?: boolean;
  /**
   * Prefixed to every id this renderer emits (a footnote mark's `ref-` id), for a column that
   * shares its page with another rendering of the same ids: the parallel face's English column.
   */
  readonly idPrefix?: string | undefined;
  /**
   * The element a footnote mark points at. A German face lists its footnotes as
   * `footnote-<id>` (Footnote.tsx), which is the default. An English face has no such list: its
   * footnote is a translation unit with its own id, so it passes that id. `undefined` renders
   * the mark with no link, because a link to an id the page lacks is a link to nothing.
   */
  readonly footnoteTarget?: ((footnoteId: string) => string | undefined) | undefined;
  /**
   * Set a recorded misprint's note under each display this renders (DisplayMisprintNote,
   * dispatch 266). Only the German source column asks for it: the English face renders the
   * reading meant, so it has nothing to note. The value is the paper's slug: display ids repeat
   * across papers, and a note belongs to its own paper's receipt.
   */
  readonly misprintNotes?: string | undefined;
}

/**
 * Renders an array of schema Inline nodes to React elements.
 * Mathematical expressions are rendered at build time with KaTeX HTML+MathML.
 * Symbols and equations remain strictly in printed notation.
 */
export function renderInlines(
  inlines: readonly Inline[],
  options?: RenderInlinesOptions,
  keyPrefix = "inl",
): React.ReactNode[] {
  return inlines.map((node, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (node.kind) {
      case "text":
        if (node.lang || node.dir) {
          return (
            <span key={key} lang={node.lang} dir={node.dir}>
              {node.text}
            </span>
          );
        }
        return <React.Fragment key={key}>{node.text}</React.Fragment>;

      case "emphasis":
        return (
          <em key={key} lang={node.lang} dir={node.dir}>
            {renderInlines(node.inlines, options, `${key}-em`)}
          </em>
        );

      case "math": {
        try {
          // A display inline is the equation block printed at this point in its paragraph
          // (displayClaims.ts): set as a display, carrying the block's id so an anchor, an
          // alignment edge and the sentence stepper still find it.
          const display = node.display === true;
          // In colour where content/display-terms binds its glyphs (PrintedDisplayTerms.tsx).
          const printed = display ? printedDisplay(node.equationId, node.latex) : undefined;
          const html =
            printed?.html ??
            renderToString(node.latex, {
              displayMode: display,
              output: "htmlAndMathml",
              throwOnError: false,
              strict: "warn",
              trust: false,
            });
          if (display) {
            const element = (
              <span
                key={printed ? undefined : key}
                // A block of its own line (reader.css .inline-display): an inline span cannot
                // scroll, so a formula wider than a phone column widened the page instead.
                className="inline-display"
                id={node.equationId}
                data-block-id={node.equationId}
                data-equation-id={node.equationId}
                data-kind="equation"
                data-printed-notation="true"
                {...{ dangerouslySetInnerHTML: { __html: html } }}
              />
            );
            const set = printed ? (
              <PrintedDisplayTerms key={key} display={printed} inline>
                {element}
              </PrintedDisplayTerms>
            ) : (
              element
            );
            return options?.misprintNotes ? (
              <React.Fragment key={key}>
                {set}
                <DisplayMisprintNote paper={options.misprintNotes} displayId={node.equationId} />
              </React.Fragment>
            ) : (
              set
            );
          }
          return (
            <span
              key={key}
              className="inline-math"
              data-equation-id={node.equationId}
              data-inline-id={node.inlineId}
              {...{ dangerouslySetInnerHTML: { __html: html } }}
            />
          );
        } catch {
          return (
            <code key={key} className="math-fallback">
              {node.latex}
            </code>
          );
        }
      }

      case "footnote-mark": {
        const target = options?.footnoteTarget
          ? options.footnoteTarget(node.footnoteId)
          : `footnote-${node.footnoteId}`;
        return (
          <sup
            key={key}
            className="footnote-ref"
            id={`${options?.idPrefix ?? ""}ref-${node.footnoteId}`}
          >
            {target ? (
              <a href={`#${target}`} aria-describedby={target} data-footnote-ref={node.footnoteId}>
                [{node.mark}]
              </a>
            ) : (
              <span data-footnote-ref={node.footnoteId}>[{node.mark}]</span>
            )}
          </sup>
        );
      }

      case "term":
        return (
          <TermAnnotation
            key={key}
            termId={node.termId}
            text={node.text}
            definition={node.definition}
            definitionLang={node.definitionLang}
            lang={node.lang}
            dir={node.dir}
          />
        );

      case "misprint": {
        // Marked only against a live source-layer record (misprints.ts). A marker naming a
        // retracted record, or one no receipt holds, prints the word and nothing else.
        const note = misprintNotes().get(node.recordId);
        if ("math" in node) {
          // A misprint inside an inline formula (dispatch 270). The formula it holds is set by
          // the math case above, as every inline formula is; so is the formula meant, in the note.
          const printed = renderInlines([node.math], options, `${key}-printed`);
          if (!note?.formula) return <React.Fragment key={key}>{printed}</React.Fragment>;
          const meant = renderInlines(
            [{ kind: "math", latex: note.formula.reading }],
            options,
            `${key}-meant`,
          );
          return (
            <MisprintAnnotation
              key={key}
              recordId={node.recordId}
              printed={speakMath(note.formula.printed, false)}
              reading={speakMath(note.formula.reading, false)}
              reason={note.reason}
              href={`/sources/#${node.recordId}`}
              formula={{ printed, meant }}
            />
          );
        }
        if (!note)
          return (
            <span key={key} lang={node.lang} dir={node.dir}>
              {node.text}
            </span>
          );
        return (
          <MisprintAnnotation
            key={key}
            recordId={node.recordId}
            printed={node.text}
            reading={note.reading}
            reason={note.reason}
            href={`/sources/#${node.recordId}`}
            lang={node.lang}
            dir={node.dir}
          />
        );
      }

      case "reference":
        return (
          <a
            key={key}
            href={referenceHref(node.targetId)}
            data-target-id={node.targetId}
            lang={node.lang}
            dir={node.dir}
          >
            {node.text}
          </a>
        );

      case "citation-ref":
        return (
          <cite key={key} className="citation-ref" data-citation-id={node.citationId}>
            ({node.locator ? `${node.citationId}, ${node.locator}` : node.citationId})
          </cite>
        );

      case "space":
        return <React.Fragment key={key}>{" ".repeat(node.count ?? 1)}</React.Fragment>;

      case "line-break":
        return <br key={key} />;

      default:
        return null;
    }
  });
}
