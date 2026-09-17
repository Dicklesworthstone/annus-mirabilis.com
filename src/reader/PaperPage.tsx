import { notFound } from "next/navigation";
import { loadPaper } from "../content/server.ts";
import { FoundationBody, ReadingBlocks } from "./Blocks.tsx";
import { FaceFallback } from "./FaceFallback.tsx";
import {
  isFaceFallbackId,
  type PaperRouteRequest,
  paperPath,
  resolvePaperRoute,
} from "./paperRoutes.ts";
import { ReaderController } from "./ReaderController.tsx";
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
  const anchors = [...args.map((a) => a.id), ...sections.map((s) => s.id)];
  const registry = { paperId: paper.id, anchors, foundations: foundations.map((f) => f.id) };
  const titles = Object.fromEntries(foundations.map((f) => [f.id, f.title]));
  const questions = Object.fromEntries(args.map((a) => [a.id, a.question]));

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
      <ReaderController registry={registry} titles={titles} questions={questions} />
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
                  <article
                    key={a.id}
                    id={a.id}
                    data-unit={a.id}
                    tabIndex={-1}
                    className="reader-passage"
                  >
                    <p className="eyebrow">
                      {a.meaning.logicalRole} ·{" "}
                      {a.meaning.modelStatus === "approximation"
                        ? "Model approximation"
                        : "Within the stated model"}
                    </p>
                    <h3>{a.title}</h3>
                    <p className="passage-question">{a.question}</p>
                    <div data-face-reading>
                      {(["overview", "full", "steps"] as const).map((reading, i) => (
                        <div
                          data-reading={i}
                          hidden={i !== 1}
                          className="reading-version"
                          key={reading}
                        >
                          <ReadingBlocks
                            blocks={a.readings[reading]}
                            foundations={foundations}
                            embed={reading === "steps"}
                          />
                        </div>
                      ))}
                      <details className="local-steps">
                        <summary>Show every step here: {a.title}</summary>
                        <ReadingBlocks blocks={a.readings.steps} foundations={foundations} embed />
                      </details>
                      <aside className="modern-margin" data-reading="3" hidden>
                        <h4>Modern qualifications</h4>
                        <ReadingBlocks blocks={a.readings.margin} foundations={foundations} />
                      </aside>
                    </div>
                    <div data-face-results hidden>
                      <p>{a.recap}</p>
                      <h4>What this relies on</h4>
                      <ul>
                        {a.premises.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                    <div data-face-source hidden>
                      <p className="notice">
                        The reviewed German, aligned English, gloss, facsimile, and split view for
                        this passage are not yet available. The explanation does not stand in for
                        those source layers.
                      </p>
                    </div>
                    <details className="model-limits">
                      <summary>Assumptions and limits: {a.title}</summary>
                      <h4>Assumed here</h4>
                      <ul>
                        {a.premises.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                      <h4>What this does not establish</h4>
                      <ul>
                        {a.limitations.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </details>
                  </article>
                ))}
            </section>
          ))}
        </div>
      </div>
      <p className="fine">{foundations.length} foundation readings sit behind this argument.</p>
      <dialog className="clarification-dialog" data-clarification-dialog aria-modal="true">
        <nav className="reader-compass" aria-label="Explanation compass">
          <p>
            <strong>The question we were answering:</strong> <span data-compass-question />
          </p>
          <p>
            <strong>The idea we opened:</strong> <span data-compass-idea />
          </p>
          <div className="reader-options">
            <div className="reader-option">
              <label htmlFor="compass-detail-select">Passage detail</label>
              <select id="compass-detail-select" data-detail-control defaultValue="1" disabled>
                <option value="0">Overview</option>
                <option value="1">Full explanation</option>
                <option value="2">Show every step</option>
              </select>
            </div>
            <label className="check">
              <input type="checkbox" data-lens-control disabled />
              Show modern qualifications
            </label>
          </div>
          <p>
            <a href="?view=reading" data-view-link="reading">
              Explanation
            </a>{" "}
            ·{" "}
            <a href="?view=results" data-view-link="results">
              Argument synopsis
            </a>
          </p>
          <div className="actions">
            <button type="button" className="secondary" data-reader-back>
              Back one step
            </button>
            <button type="button" data-reader-close>
              Return to the exact step
            </button>
          </div>
        </nav>
        {foundations.map((f) => (
          <section key={f.id} data-foundation-panel={f.id} hidden>
            <h2 id={`clarification-${f.id}`} tabIndex={-1}>
              {f.title}
            </h2>
            <FoundationBody foundation={f} foundations={foundations} />
            <p>
              <a href={`/foundations/${f.id}/`}>Open this as a full reading page →</a>
            </p>
          </section>
        ))}
      </dialog>
    </div>
  );
}
