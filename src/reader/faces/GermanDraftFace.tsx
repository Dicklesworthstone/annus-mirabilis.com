/**
 * The German source face for a paper whose transcript is a machine draft (am-dl4n).
 *
 * The owner ruled "Show it, labelled a draft" (am-dl4n), and on 2026-09-25 withdrew the label:
 * "we don't need messages like this on the site" (D-2026-09-25-no-review-status-banners). This
 * renders the text alone; the receipt keeps its status.
 *
 * WHY THIS IS NOT GermanFace. GermanFace renders SourceBlock records, and a SourceBlock
 * carries a facsimile locator because it is anchored evidence. The ledger segmenter
 * strips page markers before segmenting, so a proposed block has none, and recovering
 * them resolves 233 of 245 blocks across the three papers and fails on twelve. Filling
 * those twelve with a guess would manufacture provenance, and a locator pointing at the
 * wrong page is a false citation of the facsimile - worse than no locator. So a draft is
 * rendered by a face that does not claim to be the anchored source layer, and the day the
 * segmenter carries page markers through, this can become GermanFace.
 *
 * The blocks keep their ids, so every anchor a reader is given is one the edition already
 * guarantees is stable. Footnotes are separated from the running text as the reading face
 * does, rather than appearing inline where the ledger happened to put them.
 */

import { Fragment } from "react";
import type { GermanSourceFace } from "../../content/editions/germanSourceFace.ts";
import { FaceChooser } from "../FaceChooser.tsx";
import type { FaceAvailability } from "../faceAvailability.ts";
import { FollowingPlate } from "./FollowingPlate.tsx";
import { FACE_REGISTRY, type FaceId } from "./registry.ts";
import { renderSourceMarkup, sourceDisplayEquation } from "./sourceMarkup.tsx";
import "../reader.css";
import "./germanDraftFace.css";

const HEADING_KINDS = new Set(["heading", "part-heading"]);
const MASTHEAD_KINDS = new Set(["masthead-title", "masthead-author"]);

export function GermanDraftFace({
  face,
  paperId,
  paperTitle,
  germanTitle,
  sectionId,
  availability,
  plate,
  explainedBy,
  notExplained,
}: {
  readonly face: GermanSourceFace;
  /** For the face chooser. Without it this page had no way to another face but Back. */
  readonly paperId: string;
  readonly availability?: Readonly<Partial<Record<FaceId, FaceAvailability>>> | undefined;
  /**
   * The printed pages of the scan, set beside the text on wide screens and turned to the page the
   * reader has reached (FollowingPlate). `pages` holds only pages whose plates are in public/.
   */
  readonly plate?:
    | Readonly<{ dir: string; pages: readonly number[]; volume: string; scanHref: string }>
    | undefined;
  readonly paperTitle: string;
  /** The paper's own German title, from its metadata record. Used when no masthead block is in scope. */
  readonly germanTitle: string;
  readonly sectionId?: string | undefined;
  /**
   * The explanation passages each printed paragraph is bound to (content/bindings), by its manifest
   * anchor: the paragraph links to them, in the static HTML (am-bind-paragraphs-and-displays-me-u7bu).
   */
  readonly explainedBy?: Readonly<
    Record<string, readonly Readonly<{ id: string; title: string }>[]>
  >;
  /**
   * The anchors of printed paragraphs declared unexplained (content/bindings): no passage explains
   * them yet, and the face says so under each, instead of saying nothing.
   */
  readonly notExplained?: ReadonlySet<string> | undefined;
}) {
  const blocks = sectionId
    ? face.blocks.filter((b) => b.id === sectionId || b.id.startsWith(`${sectionId}-`))
    : face.blocks;
  const footnotes = blocks.filter((b) => b.kind === "footnote");
  /*
    THE PAGE NEEDS A DOCUMENT TITLE, and every German draft page lacked one: measured on the
    build of 10:39:30, 16 built pages had no <h1> at all, all of them a /view/german. Thirteen
    opened at an <h2> carrying a section title, two mass-energy pages opened at "Fußnoten", and
    /papers/light-quanta/s0/view/german had no heading of any level. A document whose first
    heading is an h2 gives a screen-reader user no title in the heading order, and the section
    title was doing an h1's job in an h2's tag.

    The title is NOT invented and is not promoted out of Einstein's prose. On a full paper view
    the printed masthead title block IS the title, so it is hoisted here and rendered as the h1
    rather than repeated as a paragraph beneath one - keeping its own block id, so anchors that
    already point at it still resolve. A section view holds no masthead block, so the title comes
    from the paper's metadata record, which is ours to use; GermanFace:54 already renders the
    German title as its h1 and this matches it.
  */
  const mastheadTitle = blocks.find((b) => b.kind === "masthead-title");
  /*
    EACH DISPLAY EQUATION IS PRINTED ONCE, WHERE THE COMPOSITOR PUT IT. The segmenter emits a
    display equation twice over: as its own `equation` block, so it has an id an anchor can
    name, and inside its paragraph's text as `$$…$$`, with the pairing recorded in the
    paragraph's `displayEquationIds`. This face rendered both, so every equation appeared once
    as a free-standing line ABOVE the sentence that introduces it and again inside that
    sentence: 174 duplicates across the 15 pages with mathematics, measured on the export of
    14:24:47. An equation a paragraph claims is now rendered inside that paragraph, at its
    printed position and under its own id; only an equation no paragraph claims stands alone.
  */
  const claimedEquationIds = new Set(blocks.flatMap((b) => b.displayEquationIds ?? []));
  const body = blocks.filter(
    (b) => b.kind !== "footnote" && b !== mastheadTitle && !claimedEquationIds.has(b.id),
  );
  /*
    THE PRINTED PAGE EACH BLOCK STARTS ON, carried as data-printed-page so the plate can turn with
    the reader (blockPages.ts reads it from the ledger's own page anchors). A body block whose
    words the map cannot find carries the page of the block before it, the page the reader has at
    least reached; the map's test holds that to none of 154 body blocks in the three published
    papers. A footnote it cannot find carries no page, and the plate keeps the page before it.
  */
  const printedPage = (id: string) => face.printedPages.pages[id];
  /*
    THE ANCHORS ARE THE FROZEN MANIFEST'S IDS (manifestAnchors.ts), never the segmenter's: s0-p9 on
    mass-energy was a retired id naming a later paragraph, and every display was sN-eqK. A block
    keeps its segment id for keys and pages; what a reader can link to is anchor(id). A retired id
    appears only as an alias on the block that absorbed it.
  */
  const anchor = (id: string) => face.anchors.anchorOf[id] ?? id;
  // "Explained in <passage>", after a bound paragraph: a way from the German to its explanation
  // that needs no script. It is navigation beside the source, never part of it.
  const explained = (id: string) => {
    if (notExplained?.has(anchor(id)))
      return (
        <p className="fine source-explained-by" data-not-explained={anchor(id)}>
          Not yet explained on this site.
        </p>
      );
    const passages = explainedBy?.[anchor(id)] ?? [];
    if (passages.length === 0) return null;
    return (
      <p className="fine source-explained-by" data-explained-by={anchor(id)}>
        Explained in{" "}
        {passages.map((passage, i) => (
          <Fragment key={passage.id}>
            {i === 0 ? "" : i === passages.length - 1 ? " and " : ", "}
            <a href={`/papers/${paperId}/#${passage.id}`}>{passage.title}</a>
          </Fragment>
        ))}
      </p>
    );
  };
  const aliasesOf = (id: string) =>
    Object.entries(face.anchors.aliases)
      .filter(([, target]) => target === anchor(id))
      .map(([retired]) => <span key={retired} id={retired} data-alias-of={anchor(id)} />);
  const firstPlaced = body.map((b) => printedPage(b.id)).find((p) => p !== undefined);
  const opening = plate?.pages.includes(firstPlaced ?? -1) ? firstPlaced : plate?.pages[0];

  return (
    <div data-reader-root data-ready="true" data-view="german" className="reader-root">
      <header className="page-intro">
        <p className="eyebrow">
          Read · {paperTitle} · {FACE_REGISTRY.german.label}
        </p>
        <h1
          className="source-paper-title"
          lang="de"
          id={mastheadTitle ? anchor(mastheadTitle.id) : undefined}
        >
          {mastheadTitle ? renderSourceMarkup(mastheadTitle.text, mastheadTitle.id) : germanTitle}
        </h1>
      </header>

      <FaceChooser
        paperId={paperId}
        section={sectionId}
        current="german"
        availability={availability}
      />

      <div className="source-body">
        {/*
        ONE COLUMN FOR THE TEXT AND EVERYTHING THAT QUALIFIES IT. The German and the footnotes
        share a measure, and the measure is declared once here rather than on each: `ch`
        resolves against the font of the element that declares it.
      */}
        <div className="source-column">
          {/* No draft label before the German (D-2026-09-25-no-review-status-banners, which
              supersedes am-dl4n's "Show it, labelled a draft"): the receipt keeps its status. */}

          <div data-face-source data-german-draft={face.bibKey}>
            {body.map((block) =>
              MASTHEAD_KINDS.has(block.kind) ? (
                <p
                  key={block.id}
                  id={anchor(block.id)}
                  className="source-masthead"
                  lang="de"
                  data-printed-page={printedPage(block.id)}
                >
                  {renderSourceMarkup(block.text, block.id)}
                </p>
              ) : HEADING_KINDS.has(block.kind) ? (
                <h2
                  key={block.id}
                  id={anchor(block.id)}
                  lang="de"
                  data-printed-page={printedPage(block.id)}
                >
                  {renderSourceMarkup(block.text, block.id)}
                </h2>
              ) : block.kind === "equation" ? (
                sourceDisplayEquation(block.text, block.label, anchor(block.id), block.id)
              ) : (
                <Fragment key={block.id}>
                  <p
                    id={anchor(block.id)}
                    className="source-paragraph"
                    lang="de"
                    data-block-kind={block.kind}
                    data-printed-page={printedPage(block.id)}
                  >
                    {aliasesOf(block.id)}
                    {renderSourceMarkup(
                      block.text,
                      block.id,
                      block.displayEquationIds?.map(anchor),
                      // Where a page turned inside this paragraph: its page, and no id. The segment
                      // the ledger broke off was never a manifest unit, so it names nothing.
                      block.joinedIds?.map((id) => ({ page: printedPage(id) })),
                    )}
                  </p>
                  {explained(block.id)}
                </Fragment>
              ),
            )}
          </div>

          {footnotes.length > 0 ? (
            <section className="source-footnotes" aria-label="Footnotes">
              <h2>Fußnoten</h2>
              {footnotes.map((block) => (
                <Fragment key={block.id}>
                  <p
                    id={anchor(block.id)}
                    className="source-footnote"
                    lang="de"
                    data-printed-page={printedPage(block.id)}
                  >
                    {aliasesOf(block.id)}
                    {block.footnoteLabel ? <strong>{block.footnoteLabel} </strong> : null}
                    {renderSourceMarkup(
                      block.text,
                      block.id,
                      block.displayEquationIds?.map(anchor),
                      block.joinedIds?.map((id) => ({ page: printedPage(id) })),
                    )}
                  </p>
                  {explained(block.id)}
                </Fragment>
              ))}
            </section>
          ) : null}
        </div>
        {plate && opening !== undefined ? (
          <FollowingPlate
            dir={plate.dir}
            pages={plate.pages}
            opening={opening}
            volume={plate.volume}
            scanHref={plate.scanHref}
          />
        ) : null}
      </div>
    </div>
  );
}
