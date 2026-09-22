import { loadGermanSourceFace } from "../content/editions/germanSourceFace.ts";
import { loadPaper } from "../content/server.ts";
import { FaceChooser } from "./FaceChooser.tsx";
import { faceAvailability } from "./faceAvailability.ts";
import { loadBilingualEdition } from "./faces/bilingualLoader.ts";
import { FACE_REGISTRY, type FaceId } from "./faces/registry.ts";
import { FacsimilePanel } from "./facsimile/FacsimilePanel.tsx";
import { loadFacsimileDocument } from "./facsimile/server.ts";
import { FACE_FALLBACK_IDS, type FaceFallbackId, faceLinkHref, paperPath } from "./paperRoutes.ts";
import { ROOT_ARMING_SOURCE } from "./rootArming.inline.ts";
import "./reader.css";

const SOURCE_FACES = new Set<FaceId>(["german", "english", "gloss", "parallel", "facsimile"]);

export interface FaceFallbackOptions {
  readonly facsimileLoader?: typeof loadFacsimileDocument;
}

export async function FaceFallback(
  {
    paperId,
    section,
    face,
  }: {
    paperId: string;
    section?: string;
    face: FaceFallbackId;
  },
  options: FaceFallbackOptions = {},
) {
  const payload = await loadPaper(paperId);
  const { paper } = payload;
  const sections = section ? paper.sections.filter((s) => s.id === section) : paper.sections;
  const args = payload.arguments.filter((a) => sections.some((s) => s.id === a.section));
  const label = FACE_REGISTRY[face].label;
  // Only the explicit source face reads the PDF; ordinary reading remains static and light.
  const facsimile =
    face === "facsimile"
      ? await (options.facsimileLoader ?? loadFacsimileDocument)(paperId, paper.citation)
      : null;
  // DERIVED, from the same values the renderer decides on - no authored flag. Both
  // loads are cheap: the edition is compiled JSON and the draft is one provenance
  // receipt. The PDF is NOT read here; `facsimile` is passed through only when this
  // page already resolved it for its own sake, and is left unknown otherwise, so a
  // chooser never costs a multi-megabyte hash.
  const edition = await loadBilingualEdition(paperId).catch(() => null);
  const germanDraft = loadGermanSourceFace(paperId as Parameters<typeof loadGermanSourceFace>[0]);
  const availability = faceAvailability({
    blocks: edition?.blocks.length ?? 0,
    units: edition?.units.length ?? 0,
    glossUnits: edition?.glossUnits?.length ?? 0,
    germanDraftBlocks: germanDraft?.blocks.length ?? 0,
    ...(facsimile
      ? { facsimile: facsimile.kind === "available" ? ("available" as const) : ("empty" as const) }
      : {}),
  });
  return (
    <div data-reader-root data-ready="true" data-view={face} className="reader-root">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: harness data-ready contract; source from a tested pure function. */}
      <script dangerouslySetInnerHTML={{ __html: ROOT_ARMING_SOURCE }} />
      <header className="page-intro">
        <p className="eyebrow">
          Read · {paper.title} · {label}
        </p>
        <h1>{section ? sections[0]?.title : paper.title}</h1>
        <p className="lead">{paper.description}</p>
        <p className="notice" data-source-status>
          {face === "facsimile"
            ? facsimile?.kind === "available"
              ? "This is the pinned original journal scan. A scan is not this edition’s transcription or translation, and does not certify their review status."
              : "The source scan is unavailable in this build. The explanation remains readable, but does not stand in for the original."
            : paper.sourceNotice}
        </p>
      </header>
      <FaceChooser paperId={paperId} section={section} current={face} availability={availability} />
      {facsimile?.kind === "available" && (
        <FacsimilePanel
          document={facsimile.document}
          title={paper.germanTitle ?? paper.title}
          faceHref={faceLinkHref(paperId, "facsimile", section)}
          explanationHref={paperPath(paperId, section)}
          section={section}
        />
      )}
      {face === "split" ? (
        <div className="reader-split" data-split="">
          <div
            className="reader-split-tabs"
            data-split-tabs=""
            role="tablist"
            aria-label="Split reading faces"
          >
            <a role="tab" href={faceLinkHref(paperId, "parallel", section)} aria-selected="true">
              Parallel bilingual
            </a>
            <a role="tab" href={faceLinkHref(paperId, "reading", section)} aria-selected="false">
              Explanation
            </a>
          </div>
          <div className="reader-split-panes">
            <section data-split-pane="parallel" data-face-source>
              <h2>Parallel bilingual</h2>
              <p className="notice">
                The reviewed German, aligned English, and gloss for this paper are not yet
                available. The explanation does not stand in for those source layers.
              </p>
            </section>
            <section data-split-pane="reading" data-face-reading>
              <h2>Explanation</h2>
              <p>
                <a href={paperPath(paperId, section)}>Open the explanation face →</a>
              </p>
            </section>
          </div>
        </div>
      ) : null}
      {face === "results" ? (
        <div data-face-results>
          {args.map((a) => (
            <article key={a.id} id={a.id} className="reader-passage">
              <h2>{a.title}</h2>
              <p>{a.recap}</p>
            </article>
          ))}
        </div>
      ) : null}
      {SOURCE_FACES.has(face) && facsimile?.kind !== "available" ? (
        <div data-face-source>
          <p
            className="notice"
            {...(facsimile?.kind === "unavailable" ? { "data-refusal-code": facsimile.code } : {})}
          >
            {facsimile?.kind === "unavailable" ? (
              facsimile.message
            ) : (
              <>
                The {label.toLowerCase()} for this paper is not yet available. The explanation does
                not stand in for that source layer.
              </>
            )}
          </p>
          <p>
            <a href={paperPath(paperId, section)}>Read the explanation instead →</a>
          </p>
        </div>
      ) : null}
    </div>
  );
}
