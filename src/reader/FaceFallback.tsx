import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadGermanSourceFace } from "../content/editions/germanSourceFace.ts";
import { loadPaper } from "../content/server.ts";
import { FaceChooser } from "./FaceChooser.tsx";
import { faceAvailability } from "./faceAvailability.ts";
import { loadBilingualEdition } from "./faces/bilingualLoader.ts";
import { ResultsFace } from "./faces/ResultsFace.tsx";
import { FACE_REGISTRY, type FaceId } from "./faces/registry.ts";
import { resultCardsFor } from "./faces/results/fromRecords.ts";
import { FacsimilePanel } from "./facsimile/FacsimilePanel.tsx";
import { loadFacsimileDocument } from "./facsimile/server.ts";
import { ledgerGaps, pageRanges } from "./ledgerGaps.ts";
import { paperEquations } from "./paperEquations.ts";
import { FACE_FALLBACK_IDS, type FaceFallbackId, faceLinkHref, paperPath } from "./paperRoutes.ts";
import { ROOT_ARMING_SOURCE } from "./rootArming.inline.ts";
import "./reader.css";

const SOURCE_FACES = new Set<FaceId>(["german", "english", "gloss", "parallel", "facsimile"]);

export interface FaceFallbackOptions {
  readonly facsimileLoader?: typeof loadFacsimileDocument;
}

/*
  What each face is called inside a sentence. It was the chooser label lowercased, which wrote
  "The english translation for this paper is not yet available" on all four papers - a language
  name is capitalised in English - and "The parallel bilingual for this paper", an adjective with
  no noun. One phrase per face, and the Record makes a new face bring its own.
*/
const FACE_IN_A_SENTENCE: Readonly<Record<FaceFallbackId, string>> = {
  german: "German source text",
  english: "English translation",
  gloss: "interlinear gloss",
  parallel: "parallel German and English text",
  results: "results summary",
  facsimile: "facsimile",
  split: "split view",
};

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
  // Which printed pages the German text lacks, read from the ledger itself (ledgerGaps.ts), and
  // the facsimile that has every page: the notice alone never said which were missing.
  const gaps =
    face === "german" && availability.german !== "available"
      ? ledgerGaps(paperId as Parameters<typeof ledgerGaps>[0])
      : null;
  // A paper's result cards (content/results), on the results face and its section pages.
  const resultCards =
    face === "results"
      ? ((await resultCardsFor(paperId)) ?? []).filter(
          (c) => !section || c.sectionAnchors.includes(section),
        )
      : [];
  const pdfHref = existsSync(
    join(process.cwd(), "public", "papers", "pdfs", `${paper.citation}.pdf`),
  )
    ? `/papers/pdfs/${paper.citation}.pdf`
    : null;
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
        {/* No review-status disclosure (D-2026-09-25-no-review-status-banners). The facsimile says
            what it is, or that it is missing, which is navigation. */}
        {face === "facsimile" ? (
          <p className="notice" data-source-status>
            {facsimile?.kind === "available"
              ? "This is the pinned original journal scan."
              : "The source scan is unavailable in this build. The explanation remains readable, but does not stand in for the original."}
          </p>
        ) : null}
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
              {/* It said "The reviewed German, aligned English, and gloss for this paper are not
                  yet available": false once the parallel face was, and review copy besides
                  (D-2026-09-25-no-review-status-banners). */}
              <p>
                <a href={faceLinkHref(paperId, "parallel", section)}>
                  Open the parallel German and English →
                </a>
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
      {/*
        THE RESULTS FACE IS AN OUTLINE OF THE ARGUMENT. It was one display-size heading and one
        recap per passage, run the full 1,320px frame: on BUILD 22 light quanta's twelve recaps
        were 170 to 213 characters on one or two lines of ~190. Now each paper section heads its
        own results, each result is a title and its recap at the reading measure, and each ends
        in a link to the argument it summarises. Every result keeps its passage id, so a face
        change still lands on the same passage.
      */}
      {resultCards.length > 0 ? (
        <ResultsFace
          paper={paperId}
          cards={resultCards}
          equations={paperEquations(paperId)}
          heading="The paper's results"
        />
      ) : null}
      {face === "results" ? (
        <div data-face-results className="reading-column">
          {sections.map((s) => {
            const results = args.filter((a) => a.section === s.id);
            if (results.length === 0) return null;
            return (
              <section key={s.id} className="results-section" aria-labelledby={`results-${s.id}`}>
                <h2 id={`results-${s.id}`}>{s.title}</h2>
                {results.map((a) => (
                  <article key={a.id} id={a.id} className="results-item">
                    <h3>{a.title}</h3>
                    <p className="results-item-recap">{a.recap}</p>
                    <p className="results-item-link">
                      <a
                        href={`${paperPath(paperId, section)}#${a.id}`}
                        aria-label={`Read the argument: ${a.title}`}
                      >
                        Read the argument
                      </a>
                    </p>
                  </article>
                ))}
              </section>
            );
          })}
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
                The {FACE_IN_A_SENTENCE[face]} for this paper is not yet available. The explanation
                does not stand in for that source layer.
              </>
            )}
          </p>
          {gaps && gaps.untranscribed.length > 0 ? (
            <p className="fine" data-untranscribed-pages={gaps.untranscribed.join(" ")}>
              {gaps.untranscribed.length === 1 ? "Printed page " : "Printed pages "}
              {pageRanges(gaps.untranscribed)} {gaps.untranscribed.length === 1 ? "has" : "have"}{" "}
              not been transcribed yet
              {gaps.drafted.length > 0 ? `, and ${pageRanges(gaps.drafted)} are not shown yet` : ""}
              .
              {pdfHref ? (
                <>
                  {" "}
                  Every page is in the <a href={pdfHref}>facsimile</a>.
                </>
              ) : null}
            </p>
          ) : null}
          <p>
            <a href={paperPath(paperId, section)}>Read the explanation instead →</a>
          </p>
        </div>
      ) : null}
    </div>
  );
}
