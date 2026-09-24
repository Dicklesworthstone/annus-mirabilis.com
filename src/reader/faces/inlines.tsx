import { renderToString } from "katex";
import React from "react";
import type { Inline } from "../../content/schemas/inlines.ts";
import { TermAnnotation } from "./TermAnnotation.tsx";

export interface RenderInlinesOptions {
  readonly renderMathInline?: boolean;
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
          const html = renderToString(node.latex, {
            displayMode: display,
            output: "htmlAndMathml",
            throwOnError: false,
            strict: "warn",
            trust: false,
          });
          if (display) {
            return (
              <span
                key={key}
                id={node.equationId}
                data-block-id={node.equationId}
                data-equation-id={node.equationId}
                data-kind="equation"
                data-printed-notation="true"
                {...{ dangerouslySetInnerHTML: { __html: html } }}
              />
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

      case "footnote-mark":
        return (
          <sup key={key} className="footnote-ref" id={`ref-${node.footnoteId}`}>
            <a
              href={`#footnote-${node.footnoteId}`}
              aria-describedby={`footnote-${node.footnoteId}`}
              data-footnote-ref={node.footnoteId}
            >
              [{node.mark}]
            </a>
          </sup>
        );

      case "term":
        return (
          <TermAnnotation
            key={key}
            termId={node.termId}
            text={node.text}
            definition={node.definition}
            lang={node.lang}
            dir={node.dir}
          />
        );

      case "reference":
        return (
          <a
            key={key}
            href={`#${node.targetId}`}
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
