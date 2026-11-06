import { paneDomId } from "../anchors/paneIds.ts";
import { AlignmentController } from "../faces/AlignmentController.tsx";
import { buildAlignmentIndex } from "../faces/alignment.ts";
import type { BilingualEdition } from "../faces/bilingualLoader.ts";
import { FootnoteItem } from "../faces/Footnote.tsx";
import { ENGLISH_ANCHOR_PREFIX } from "../faces/ParallelFace.tsx";
import type { ParallelRow } from "../faces/parallelRows.ts";
import { SourceBlock } from "../faces/SourceBlock.tsx";
import { TranslationParagraphs } from "../faces/TranslationParagraphs.tsx";
import { unitsBySourceRef } from "../faces/TranslationUnit.tsx";
import { faceLinkHref } from "../paperRoutes.ts";
import type { PassageProjectionIndex } from "../projections/passageProjections.ts";
import type { splitSourceSection } from "./sourceSection.ts";

export function SplitSource({
  edition,
  source,
  projections,
  argumentSections,
  section,
}: {
  edition: BilingualEdition;
  source: ReturnType<typeof splitSourceSection>;
  projections: PassageProjectionIndex;
  argumentSections: Readonly<Record<string, string>>;
  section: string;
}) {
  const paper = edition.paper.slug;
  const footnoteUnits = unitsBySourceRef(source.units);
  const english = (row: ParallelRow) =>
    row.english.length > 0 ? (
      <div className="split-source-language" data-split-language="english" lang="en">
        <p className="split-language-label">English</p>
        <TranslationParagraphs
          units={source.units}
          groups={row.english}
          alignment={edition.alignment}
          blocks={edition.blocks}
          reviewRecords={edition.reviewRecords}
          editorialNotes={edition.editorialNotes}
          anchorPrefix={ENGLISH_ANCHOR_PREFIX}
          footnoteUnits={footnoteUnits}
        />
      </div>
    ) : null;
  const explainedIn = (row: ParallelRow) => {
    const links = projections.bySourceBlock[row.key]?.explanation ?? [];
    return links.length > 0 ? (
      <nav
        className="split-row-links"
        aria-label={`Explanation of ${projections.bySourceBlock[row.key]?.german[0]?.label ?? "this passage"}`}
      >
        <span>Explained in: </span>
        {links.map((link) => {
          const id = decodeURIComponent(link.href.split("#")[1] ?? "");
          const local = argumentSections[id] === section;
          const href = local
            ? `#${paneDomId(id, "secondary")}`
            : argumentSections[id]
              ? `${faceLinkHref(paper, "split", argumentSections[id])}#${paneDomId(id, "secondary")}`
              : link.href;
          return (
            <a key={link.href} href={href} data-split-go={local ? "companion" : undefined}>
              {link.label}
            </a>
          );
        })}
      </nav>
    ) : null;
  };
  return (
    <div data-split-source-content>
      <AlignmentController
        index={buildAlignmentIndex(source.alignment, source.blocks, source.units)}
        containerSelector="[data-split-source-content]"
        keyboardScope="container"
      />
      {source.rows.map((row) => (
        <div
          key={row.key}
          id={`split-row-${row.key}`}
          className="split-source-row"
          data-split-source-row={row.key}
        >
          {row.block ? (
            <div className="split-source-language" data-split-language="german" lang="de">
              <p className="split-language-label">German</p>
              <SourceBlock
                block={row.block}
                paperSlug={paper}
                editorialNotes={edition.editorialNotes}
              />
            </div>
          ) : null}
          {english(row)}
          {explainedIn(row)}
        </div>
      ))}
      {source.footnoteRows.length > 0 ? (
        <section className="split-source-footnotes" aria-labelledby="split-footnotes-heading">
          <h3 id="split-footnotes-heading">Source footnotes</h3>
          {source.footnoteRows.map((row) => (
            <div
              key={row.key}
              id={`split-row-${row.key}`}
              className="split-source-row"
              data-split-source-row={row.key}
            >
              {row.block ? (
                <div className="split-source-language" data-split-language="german" lang="de">
                  <p className="split-language-label">German</p>
                  <ol className="footnotes-list">
                    <FootnoteItem footnote={row.block} anchored />
                  </ol>
                </div>
              ) : null}
              {english(row)}
              {explainedIn(row)}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
