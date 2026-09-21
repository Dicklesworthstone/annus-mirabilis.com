/**
 * The German source face for a paper whose transcript is a machine draft (am-dl4n).
 *
 * The owner ruled "Show it, labelled a draft". This renders the text; SourceFaceNotice
 * renders the label; and the two are emitted together by construction, which is what
 * requirement 3 asks for.
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

import type { GermanSourceFace } from "../../content/editions/germanSourceFace.ts";
import { FACE_REGISTRY } from "./registry.ts";
import { SourceFaceNotice } from "./SourceFaceNotice.tsx";
import "../reader.css";

const HEADING_KINDS = new Set(["heading", "part-heading"]);
const MASTHEAD_KINDS = new Set(["masthead-title", "masthead-author"]);

export function GermanDraftFace({
  face,
  paperTitle,
  sectionId,
}: {
  readonly face: GermanSourceFace;
  readonly paperTitle: string;
  readonly sectionId?: string | undefined;
}) {
  const blocks = sectionId
    ? face.blocks.filter((b) => b.id === sectionId || b.id.startsWith(`${sectionId}-`))
    : face.blocks;
  const footnotes = blocks.filter((b) => b.kind === "footnote");
  const body = blocks.filter((b) => b.kind !== "footnote");

  return (
    <div data-reader-root data-ready="true" data-view="german" className="reader-root">
      <header className="page-intro">
        <p className="eyebrow">
          Read · {paperTitle} · {FACE_REGISTRY.german.label}
        </p>
      </header>

      {/*
        Emitted before the first word of German, unconditionally. It is not behind a
        condition in this component: the notice decides for itself whether to render,
        from the receipt, so a paper that becomes reviewed stops being labelled here
        without this file changing.
      */}
      <SourceFaceNotice notice={face.notice} />

      <div data-face-source data-german-draft={face.bibKey}>
        {body.map((block) =>
          MASTHEAD_KINDS.has(block.kind) ? (
            <p key={block.id} id={block.id} className="source-masthead" lang="de">
              {block.text}
            </p>
          ) : HEADING_KINDS.has(block.kind) ? (
            <h2 key={block.id} id={block.id} lang="de">
              {block.text}
            </h2>
          ) : (
            <p
              key={block.id}
              id={block.id}
              className={block.kind === "equation" ? "source-equation" : "reader-passage"}
              lang="de"
              data-block-kind={block.kind}
            >
              {block.text}
            </p>
          ),
        )}
      </div>

      {footnotes.length > 0 ? (
        <section className="source-footnotes" aria-label="Footnotes">
          <h2>Fußnoten</h2>
          {footnotes.map((block) => (
            <p key={block.id} id={block.id} className="source-footnote" lang="de">
              {block.footnoteLabel ? <strong>{block.footnoteLabel} </strong> : null}
              {block.text}
            </p>
          ))}
        </section>
      ) : null}
    </div>
  );
}
