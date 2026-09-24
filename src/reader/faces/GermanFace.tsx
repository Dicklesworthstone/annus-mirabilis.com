import type {
  Alignment,
  EditorialNote,
  Paper,
  SourceBlock as SourceBlockData,
} from "../../content/schemas/source.ts";
import { FACE_FALLBACK_IDS, faceLinkHref } from "../paperRoutes.ts";
import { ROOT_ARMING_SOURCE } from "../rootArming.inline.ts";
import { AlignmentController } from "./AlignmentController.tsx";
import { buildAlignmentIndex } from "./alignment.ts";
import { withoutClaimedDisplays } from "./displayClaims.ts";
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
}

export function GermanFace({
  paper,
  blocks,
  alignment,
  editorialNotes = [],
  sectionId,
}: GermanFaceProps) {
  const filteredBlocks = sectionId
    ? blocks.filter((b) => b.section === sectionId || !b.section)
    : blocks;

  const footnoteBlocks = filteredBlocks.filter((b) => b.kind === "footnote");
  // A display its paragraph prints in place is not printed again as its own block.
  const mainBlocks = withoutClaimedDisplays(filteredBlocks.filter((b) => b.kind !== "footnote"));
  const alignmentIndex = buildAlignmentIndex(alignment, blocks);

  const dateLine = paper.dates.find((d) => d.type === "date-line");

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

      <main className="source-blocks-list" data-source-body>
        {mainBlocks.map((block) => (
          <SourceBlock
            key={block.id}
            block={block}
            paperSlug={paper.slug}
            editorialNotes={editorialNotes}
          />
        ))}
      </main>

      <FootnotesSection footnotes={footnoteBlocks} heading="Fußnoten" />
      <AlignmentController index={alignmentIndex} />
    </div>
  );
}
