import type { ReactNode } from "react";
import type { SourceBlock } from "../../content/schemas/source.ts";
import { renderInlines } from "./inlines.tsx";

export interface FootnoteItemProps {
  readonly footnote: SourceBlock;
  /**
   * Also publish the footnote's own id, which is the canonical page anchor for a footnote block
   * (docs/CONTENT_IDS.md 7.1) and what links from outside the page name: a passage's printed
   * paragraphs, content/bindings, a capstone. The item keeps footnote-<id> for the marks that
   * point at it.
   *
   * The German face and the parallel face both ask for this. Until 2026-09-28 this line read "the
   * parallel face, whose rows repeat ids otherwise, does not", and that reason did not hold: the
   * repetition it feared is what ENGLISH_ANCHOR_PREFIX already prevents, and with the prop on,
   * englishAnchors.test.tsx measures no repeated id on that face. The cost of the wrong reason
   * was a canonical anchor that resolved on 95 built pages and not on the parallel face, found by
   * a candidate check rather than by a test here (dispatch 396).
   */
  readonly anchored?: boolean | undefined;
  /** What follows the footnote inside its item: the German face's "Explained in" line. */
  readonly after?: ReactNode;
}

export function FootnoteItem({ footnote, anchored = false, after }: FootnoteItemProps) {
  const label = footnote.originalLabel || footnote.id;
  return (
    <li
      id={`footnote-${footnote.id}`}
      className="footnote-item"
      role="doc-footnote"
      data-footnote-id={footnote.id}
    >
      <div className="footnote-body">
        {anchored ? <span id={footnote.id} data-footnote-anchor={footnote.id} /> : null}
        {/* The mark the page prints, "1)", as the text's reference carries it and the English face
            labels its footnotes; the list does not number them (reader.css .footnotes-list). */}
        {footnote.originalLabel ? (
          <span className="footnote-ref">{footnote.originalLabel} </span>
        ) : null}
        {renderInlines(
          footnote.inlines,
          { misprintNotes: footnote.paper, terms: { paper: footnote.paper, holder: footnote.id } },
          `fn-${footnote.id}`,
        )}
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
      {after}
    </li>
  );
}

export interface FootnotesSectionProps {
  readonly footnotes: readonly SourceBlock[];
  readonly heading?: string | undefined;
  /** Publish each footnote's own id too (FootnoteItem `anchored`). */
  readonly anchored?: boolean | undefined;
  /** Rendered after each footnote, inside its item (FootnoteItem `after`). */
  readonly after?: ((footnote: SourceBlock) => ReactNode) | undefined;
}

export function FootnotesSection({
  footnotes,
  heading = "Footnotes",
  anchored = false,
  after,
}: FootnotesSectionProps) {
  if (footnotes.length === 0) return null;

  return (
    <section className="reader-footnotes" aria-labelledby="footnotes-heading">
      <h2 id="footnotes-heading" className="footnotes-heading">
        {heading}
      </h2>
      <ol className="footnotes-list">
        {footnotes.map((fn) => (
          <FootnoteItem key={fn.id} footnote={fn} anchored={anchored} after={after?.(fn)} />
        ))}
      </ol>
    </section>
  );
}
