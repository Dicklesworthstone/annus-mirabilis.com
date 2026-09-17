import { loadPaper } from "../content/server.ts";
import { FACE_REGISTRY, type FaceId } from "./faces/registry.ts";
import { FACE_FALLBACK_IDS, type FaceFallbackId, faceLinkHref, paperPath } from "./paperRoutes.ts";
import { ROOT_ARMING_SOURCE } from "./rootArming.inline.ts";
import "./reader.css";

const SOURCE_FACES = new Set<FaceId>(["german", "english", "gloss", "parallel", "facsimile"]);

export async function FaceFallback({
  paperId,
  section,
  face,
}: {
  paperId: string;
  section?: string;
  face: FaceFallbackId;
}) {
  const payload = await loadPaper(paperId);
  const { paper } = payload;
  const sections = section ? paper.sections.filter((s) => s.id === section) : paper.sections;
  const args = payload.arguments.filter((a) => sections.some((s) => s.id === a.section));
  const label = FACE_REGISTRY[face].label;
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
          {paper.sourceNotice}
        </p>
      </header>
      <nav className="reader-controls" aria-label="Reading face">
        <a href={faceLinkHref(paperId, "reading", section)} data-view-link="reading">
          Explanation
        </a>
        {FACE_FALLBACK_IDS.map((id) => (
          <a
            key={id}
            href={faceLinkHref(paperId, id, section)}
            data-view-link={id}
            aria-current={id === face ? "page" : undefined}
          >
            {FACE_REGISTRY[id].label}
          </a>
        ))}
      </nav>
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
      {SOURCE_FACES.has(face) ? (
        <div data-face-source>
          <p className="notice">
            The {label.toLowerCase()} for this paper is not yet available. The explanation does not
            stand in for that source layer.
          </p>
          <p>
            <a href={paperPath(paperId, section)}>Read the explanation instead →</a>
          </p>
        </div>
      ) : null}
    </div>
  );
}
