import { Fragment } from "react";
import type {
  Alignment,
  EditorialNote,
  Paper,
  SourceBlock as SourceBlockData,
} from "../../content/schemas/source.ts";
import { pageRanges } from "../ledgerGaps.ts";
import { FACE_FALLBACK_IDS, faceLinkHref } from "../paperRoutes.ts";
import { ROOT_ARMING_SOURCE } from "../rootArming.inline.ts";
import { AlignmentController } from "./AlignmentController.tsx";
import { buildAlignmentIndex } from "./alignment.ts";
import { withoutClaimedDisplays } from "./displayClaims.ts";
import { sectionsLabel } from "./editionCoverage.ts";
import { FootnotesSection } from "./Footnote.tsx";
import { FACE_REGISTRY } from "./registry.ts";
import { SourceBlock } from "./SourceBlock.tsx";
import "../reader.css";

export interface GermanFaceProps {
  readonly paper: Paper;
  readonly blocks: readonly SourceBlockData[];
  readonly alignment?: Alignment | undefined;
  readonly editorialNotes?: readonly EditorialNote[] | undefined;
  readonly sectionId?: string | undefined;
  /** The paper's sections no German block reaches yet, in its order, named above the text. */
  readonly missingSections?: readonly string[] | undefined;
  /** Printed pages the ledger has not transcribed (ledgerGaps.ts), named as the notice face names them. */
  readonly untranscribedPages?: readonly number[] | undefined;
  /** The pinned facsimile, which has every page, when there is one. */
  readonly pdfHref?: string | null | undefined;
  /**
   * The explanation passages each printed paragraph is bound to (content/bindings), by its id, as
   * the draft face links them: a way from the German to its explanation that needs no script.
   */
  readonly explainedBy?: Readonly<
    Record<string, readonly Readonly<{ id: string; title: string }>[]>
  >;
  /** Paragraphs declared unexplained (content/bindings): the face says so under each. */
  readonly notExplained?: ReadonlySet<string> | undefined;
}

export function GermanFace({
  paper,
  blocks,
  alignment,
  editorialNotes = [],
  sectionId,
  missingSections = [],
  untranscribedPages = [],
  pdfHref,
  explainedBy,
  notExplained,
}: GermanFaceProps) {
  const filteredBlocks = sectionId
    ? blocks.filter((b) => b.section === sectionId || !b.section)
    : blocks;

  const footnoteBlocks = filteredBlocks.filter((b) => b.kind === "footnote");
  // A display its paragraph prints in place is not printed again as its own block.
  // Claims are counted before the footnotes are set aside, so a display a footnote prints is not
  // printed again as its own block (light quanta's s1-fn3 prints three).
  const mainBlocks = withoutClaimedDisplays(filteredBlocks).filter((b) => b.kind !== "footnote");
  const alignmentIndex = buildAlignmentIndex(alignment, blocks);

  const dateLine = paper.dates.find((d) => d.type === "date-line");
  // "Explained in <passage>", after a bound paragraph, as on the draft face (GermanDraftFace).
  const explained = (id: string) => {
    if (notExplained?.has(id))
      return (
        <p className="fine source-explained-by" data-not-explained={id}>
          Not yet explained on this site.
        </p>
      );
    const passages = explainedBy?.[id] ?? [];
    if (passages.length === 0) return null;
    return (
      <p className="fine source-explained-by" data-explained-by={id}>
        Explained in{" "}
        {passages.map((passage, i) => (
          <Fragment key={passage.id}>
            {i === 0 ? "" : i === passages.length - 1 ? " and " : ", "}
            <a href={`/papers/${paper.slug}/#${passage.id}`}>{passage.title}</a>
          </Fragment>
        ))}
      </p>
    );
  };

  return (
    <div
      data-reader-root
      data-ready="true"
      data-view="german"
      data-face="german"
      className="reader-root face-german"
      lang="de"
    >
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: harness data-ready contract; source from a tested pure function. */}
      <script dangerouslySetInnerHTML={{ __html: ROOT_ARMING_SOURCE }} />
      <header className="page-intro" lang="de">
        <p className="eyebrow">Quelle · {paper.titleGerman}</p>
        <h1 className="source-paper-title">{paper.titleGerman}</h1>
        <p className="source-author-line">von {paper.authorLine}</p>
        {dateLine?.text && <p className="source-date-line">{dateLine.text}</p>}
        <p className="journal-citation fine">
          {paper.journal.name} ({paper.journal.series}) {paper.journal.volume},{" "}
          {paper.journal.pages.first}–{paper.journal.pages.last} (
          {paper.dates.find((d) => d.type === "issue-publication")?.earliest?.slice(0, 4) || "1905"}
          ).
        </p>
      </header>

      <nav className="reader-controls" aria-label="Reading face" lang="en">
        <a
          href={
            sectionId
              ? faceLinkHref(paper.slug, "reading", sectionId)
              : faceLinkHref(paper.slug, "reading")
          }
          data-view-link="reading"
        >
          Explanation
        </a>
        {FACE_FALLBACK_IDS.map((id) => (
          <a
            key={id}
            href={
              sectionId ? faceLinkHref(paper.slug, id, sectionId) : faceLinkHref(paper.slug, id)
            }
            data-view-link={id}
            aria-current={id === "german" ? "page" : undefined}
          >
            {FACE_REGISTRY[id].label}
          </a>
        ))}
      </nav>

      {/* The text and everything that qualifies it share the reader's measure and type step, as
          the German draft face's .source-column does: relativity's German face ran 1,256px at
          19px, 155 characters a line, where the other papers' German faces read at 666px and
          22.8px (dispatch 210). */}
      <div className="reading-column">
        {/* An edition that does not yet reach every section or page says what it lacks, so the
            introduction is never read as the paper. It carries no draft label
            (D-2026-09-25-no-review-status-banners). */}
        {missingSections.length > 0 ? (
          <p className="notice" data-missing-sections={missingSections.join(" ")} lang="en">
            This German text does not yet cover the whole paper. Not yet in it:{" "}
            {sectionsLabel(missingSections)}.
          </p>
        ) : null}
        {untranscribedPages.length > 0 ? (
          <p className="fine" data-untranscribed-pages={untranscribedPages.join(" ")} lang="en">
            {untranscribedPages.length === 1 ? "Printed page " : "Printed pages "}
            {pageRanges(untranscribedPages)} {untranscribedPages.length === 1 ? "has" : "have"} not
            been transcribed yet.
            {pdfHref ? (
              <>
                {" "}
                Every page is in the <a href={pdfHref}>facsimile</a>.
              </>
            ) : null}
          </p>
        ) : null}

        <main className="source-blocks-list" data-source-body>
          {mainBlocks.map((block) => (
            <Fragment key={block.id}>
              <SourceBlock block={block} paperSlug={paper.slug} editorialNotes={editorialNotes} />
              {explained(block.id)}
            </Fragment>
          ))}
        </main>

        {/* Anchored: a passage's list of printed paragraphs links a footnote by its own id, and a
            footnote carries its "Explained in" or "Not yet explained" line as a paragraph does. */}
        <FootnotesSection
          footnotes={footnoteBlocks}
          heading="Fußnoten"
          anchored
          after={(footnote) => explained(footnote.id)}
        />
      </div>
      <AlignmentController index={alignmentIndex} />
    </div>
  );
}
