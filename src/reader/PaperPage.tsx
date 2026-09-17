import { notFound } from "next/navigation";
import { loadPaper } from "../content/server.ts";
import { FaceFallback } from "./FaceFallback.tsx";
import { FACE_REGISTRY } from "./faces/registry.ts";
import {
  FACE_FALLBACK_IDS,
  faceLinkHref,
  isFaceFallbackId,
  type PaperRouteRequest,
  paperPath,
  resolvePaperRoute,
} from "./paperRoutes.ts";
import { ROOT_ARMING_SOURCE } from "./rootArming.inline.ts";
import "./reader.css";

/**
 * Generic paper/section/face renderer. The dedicated brownian-motion pages keep
 * using PaperReader (layout work in flight there). This shell is paper-agnostic:
 * it loads whichever compiled paper the route named.
 */
export async function PaperPage(request: PaperRouteRequest) {
  const resolved = await resolvePaperRoute(request);
  if (!resolved.ok) notFound();
  if (resolved.face !== "reading") {
    if (!isFaceFallbackId(resolved.face)) notFound();
    return (
      <FaceFallback
        paperId={resolved.paperId}
        face={resolved.face}
        {...(resolved.section !== undefined ? { section: resolved.section } : {})}
      />
    );
  }
  const payload = await loadPaper(resolved.paperId);
  const { paper, foundations } = payload;
  const sectionId = resolved.section;
  const sections = sectionId ? paper.sections.filter((s) => s.id === sectionId) : paper.sections;
  const args = payload.arguments.filter((a) => sections.some((s) => s.id === a.section));
  return (
    <div data-reader-root data-ready="true" data-view="reading" className="reader-root">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: harness data-ready contract; source from a tested pure function. */}
      <script dangerouslySetInnerHTML={{ __html: ROOT_ARMING_SOURCE }} />
      <header className="page-intro">
        <p className="eyebrow">Read · {paper.title}</p>
        <h1>{sectionId ? sections[0]?.title : paper.title}</h1>
        <p className="lead">{paper.description}</p>
        <p className="notice" data-source-status>
          {paper.sourceNotice}
        </p>
        {sectionId ? <a href={paperPath(paper.id)}>Read the whole available argument →</a> : null}
      </header>
      <nav className="reader-controls" aria-label="Reading face">
        <a
          href={
            sectionId
              ? faceLinkHref(paper.id, "reading", sectionId)
              : faceLinkHref(paper.id, "reading")
          }
          data-view-link="reading"
        >
          Explanation
        </a>
        {FACE_FALLBACK_IDS.map((id) => (
          <a
            key={id}
            href={sectionId ? faceLinkHref(paper.id, id, sectionId) : faceLinkHref(paper.id, id)}
            data-view-link={id}
          >
            {FACE_REGISTRY[id].label}
          </a>
        ))}
      </nav>
      <div className="reader-layout">
        <aside className="reader-outline">
          <h2>Follow the argument</h2>
          <nav aria-label="Argument outline">
            {sections.map((s) => (
              <div key={s.id}>
                <a href={paperPath(paper.id, s.id)}>{s.title}</a>
                {args
                  .filter((a) => a.section === s.id)
                  .map((a) => (
                    <a key={a.id} href={`${paperPath(paper.id, s.id)}#${a.id}`}>
                      {a.title}
                    </a>
                  ))}
              </div>
            ))}
          </nav>
        </aside>
        <div className="reader-body">
          {sections.map((s) => (
            <section key={s.id} id={s.id} tabIndex={-1} className="reader-section">
              <h2>{s.title}</h2>
              {args
                .filter((a) => a.section === s.id)
                .map((a) => (
                  <article key={a.id} id={a.id} tabIndex={-1} className="reader-passage">
                    <h3>{a.title}</h3>
                    <p className="passage-question">{a.question}</p>
                    <div data-face-reading>
                      <p>{a.recap}</p>
                    </div>
                  </article>
                ))}
            </section>
          ))}
        </div>
      </div>
      <p className="fine">{foundations.length} foundation readings sit behind this argument.</p>
    </div>
  );
}
