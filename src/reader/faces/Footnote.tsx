import React from "react";
import type { SourceBlock } from "../../content/schemas/source.ts";
import { renderInlines } from "./inlines.tsx";

export interface FootnoteItemProps {
  readonly footnote: SourceBlock;
}

export function FootnoteItem({ footnote }: FootnoteItemProps) {
  const label = footnote.originalLabel || footnote.id;
  return (
    <li
      id={`footnote-${footnote.id}`}
      className="footnote-item"
      role="doc-footnote"
      data-footnote-id={footnote.id}
    >
      <div className="footnote-body">
        {renderInlines(footnote.inlines, undefined, `fn-${footnote.id}`)}
        <a
          href={`#ref-${footnote.id}`}
          className="footnote-backlink"
          aria-label={`Back to reference for footnote ${label}`}
          data-footnote-backlink={footnote.id}
        >
          {" "}
          ↩
        </a>
      </div>
    </li>
  );
}

export interface FootnotesSectionProps {
  readonly footnotes: readonly SourceBlock[];
  readonly heading?: string | undefined;
}

export function FootnotesSection({ footnotes, heading = "Footnotes" }: FootnotesSectionProps) {
  if (footnotes.length === 0) return null;

  return (
    <section className="reader-footnotes" aria-labelledby="footnotes-heading">
      <h2 id="footnotes-heading" className="footnotes-heading">
        {heading}
      </h2>
      <ol className="footnotes-list">
        {footnotes.map((fn) => (
          <FootnoteItem key={fn.id} footnote={fn} />
        ))}
      </ol>
    </section>
  );
}
