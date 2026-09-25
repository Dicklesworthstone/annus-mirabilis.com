import { existsSync } from "node:fs";
import { join } from "node:path";
import brownianEntrance from "../../content/arguments/brownian-motion/entrance-brownian-motion.json";
import { ModalCloseButton } from "../a11y/modal/ModalCloseButton.tsx";
import { loadParagraphBindings } from "../content/bindings/paragraphBindings.ts";
import { printedUnits } from "../content/editions/germanSourceFace.ts";
import { validateEntranceRecord } from "../content/entrances/entranceRecord.ts";
import { loadConcordanceForPaper } from "../content/notation/loader.ts";
import { loadPaper } from "../content/server";
import { ArgumentEquations } from "./ArgumentEquations.tsx";
import { passageActionsFromArgument } from "./actions/fromArgument.ts";
import { PassageActionsBar } from "./actions/PassageActionsBar.tsx";
import { ReadingBlocks } from "./Blocks";
import { LazyInlineTracerLab } from "./LazyInlineTracerLab.tsx";
import { Companion } from "./layout/Companion.tsx";
import { type CompanionKind, resolveCompanionKind } from "./layout/companionKind.ts";
import { ReaderLayout } from "./layout/ReaderLayout.tsx";
import { StickyLabRegion } from "./layout/StickyLabRegion.tsx";
import { LazyBrownianFirstEncounter } from "./lazyIslands.tsx";
import "./actions/kindRegistration.ts";
import type { CompiledMissingStepLesson } from "../equations/missingStep/compiled.ts";
import { MissingStepDisclosure } from "../equations/missingStep/MissingStepPanel.tsx";
import { quantityLegend } from "../equations/quantityColourView.ts";
import missingSteps from "../generated/missing-steps.json";
import { FirstUseCallout } from "./FirstUseCallout.tsx";
import { firstUseCallouts } from "./firstUse.ts";
import { OutlineSectionTitle } from "./OutlineSectionTitle.tsx";
import { notationReach, notationReachLine, paperEquations } from "./paperEquations.ts";
import { englishSourceLink, originalHref, paperSourceFaces } from "./paperSourceFaces.ts";
import { passageKind } from "./passageKind.ts";
import { QuantityLegendList } from "./QuantityLegendList.tsx";
import { ReaderController } from "./ReaderController";
import { ROOT_ARMING_SOURCE } from "./rootArming.inline";
import { SectionPager } from "./SectionPager.tsx";
import { SourceParagraphs } from "./SourceParagraphs.tsx";
import { sectionPlate } from "./sectionPlate.ts";
import {
  ExplainedElsewhereOutlineEntry,
  UnexplainedOutlineEntry,
  UnexplainedPartsLine,
} from "./UnexplainedParts.tsx";
import {
  explainedElsewhere,
  outlineOrder,
  paperParts,
  unexplainedParts,
} from "./unexplainedParts.ts";
import "./reader.css";

/** The Brownian first encounter's id (BrownianFirstEncounter.tsx), a return anchor like a passage. */
const ENTRY_ANCHOR = "entry-brownian-motion";

function companionKindFromQuery(raw: string | undefined): CompanionKind {
  try {
    return resolveCompanionKind(raw);
  } catch {
    return "explanation";
  }
}

export async function PaperReader({
  section,
  companion,
}: {
  section?: string | undefined;
  companion?: string | undefined;
} = {}) {
  const companionKind = companionKindFromQuery(companion);
  const payload = await loadPaper("brownian-motion"),
    { paper, foundations } = payload;
  // "Read the original" opens the German face at the passage's section (paperSourceFaces.ts).
  const sources = await paperSourceFaces(paper.id);
  // The English for the whole paper, offered beside the German wherever it exists.
  const englishSource = englishSourceLink(paper.id, sources);
  const equationsById = paperEquations(paper.id);
  // Each passage lists the printed paragraphs it explains (content/bindings), with links back.
  const boundParagraphs = loadParagraphBindings(process.cwd(), paper.id) ?? [];
  const sections = section ? paper.sections.filter((s) => s.id === section) : paper.sections;
  if (!sections.length) throw new Error("Section is not in the compiled outline.");
  const args = payload.arguments.filter((a) => sections.some((s) => s.id === a.section));
  // The parts of the paper no passage explains yet, from its frozen manifest (unexplainedParts.ts),
  // each linked to Einstein's text: the German face at that part, else the facsimile.
  // A part whose paragraphs are all bound to passages filed under another part is explained there
  // (explainedElsewhere): named in the outline with those passages, and not called unexplained.
  const parts = paperParts(printedUnits(process.cwd(), "brownian-motion"));
  const filed = new Set(payload.arguments.map((a) => a.section));
  const elsewhere = explainedElsewhere(parts, filed, boundParagraphs);
  const missingParts = unexplainedParts(parts, new Set([...filed, ...elsewhere.keys()]));
  const passageLink = (id: string) => {
    const passage = payload.arguments.find((a) => a.id === id);
    if (!passage) return [];
    const here = args.some((a) => a.id === id);
    const href = here ? `#${id}` : `/papers/${paper.id}/${passage.section}/#${id}`;
    return [{ id, title: passage.title, href }];
  };
  const pdf = `papers/pdfs/${paper.citation}.pdf`;
  const pdfHref = existsSync(join(process.cwd(), "public", pdf)) ? `/${pdf}` : null;
  const partHref = (part: string) => originalHref(paper.id, sources, part) ?? pdfHref;
  // Einstein's k is the viscosity, not Boltzmann's constant: called out in red where the
  // explanation first uses it (firstUse.ts).
  const firstUses = firstUseCallouts(
    loadConcordanceForPaper(paper.id).entries,
    args,
    (argumentId) =>
      new Set(
        [...equationsById.values()]
          .filter((e) => e.argument === argumentId)
          .flatMap((e) => e.terms.map((t) => t.quantityId)),
      ),
  );
  // The first encounter is shown on the whole paper and on §4. Its lesson link opens the lesson
  // beside the text, as the other papers' entrances do, so it is a place the reader returns to.
  const showsEntrance = !section || section === "s4";
  const anchors = [
    ...(showsEntrance ? [ENTRY_ANCHOR] : []),
    ...args.map((a) => a.id),
    ...sections.map((s) => s.id),
  ];
  const registry = { paperId: paper.id, anchors, foundations: foundations.map((f) => f.id) };
  // The Letters control says how many of the paper's formulas it redraws (paperEquations.ts).
  const reach = notationReach(paper.id);
  const notationHelp = reach ? notationReachLine(reach) : undefined;
  const titles = Object.fromEntries(foundations.map((f) => [f.id, f.title]));
  const questions = Object.fromEntries(args.map((a) => [a.id, a.question]));
  if (showsEntrance) questions[ENTRY_ANCHOR] = validateEntranceRecord(brownianEntrance).question;
  /*
    THE COMPANION ON A SECTION PAGE: the page the section was printed on, and a key to its symbols.
    It held a placeholder sentence in every state, so at 1920 a 368px column beside the text said
    only that margin notes "stay here" (TanElk's dispatch 69: "carries something, not air"). Now,
    on a section page, it shows the section's first printed page as a plate linked to the section
    in German, and each quantity of the section's equations by glyph, colour and name, the same
    colour it has in the formulas. The whole-paper page keeps a short note: its reading face is
    the page the HTML budget measures, and the companion is rendered twice (column and sheet).
  */
  const sectionLabel = section ? `§${section.replace(/^s/, "")}` : undefined;
  const companionPlate = section ? sectionPlate("brownian-motion", section) : undefined;
  const sectionSymbols = section
    ? quantityLegend(
        [...equationsById.values()].filter((e) => args.some((a) => a.id === e.argument)),
      )
    : [];
  return (
    <div data-reader-root data-ready="true" data-view="reading" className="reader-root">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the harness's data-ready contract requires this exact script as the root's first child, synchronous before any face content paints; its source is derived from a tested pure function, never hand-authored HTML. */}
      <script dangerouslySetInnerHTML={{ __html: ROOT_ARMING_SOURCE }} />
      <header className="page-intro">
        <p className="eyebrow">
          {section ? "Read · Brownian motion · Explanation preview" : "Read · Explanation preview"}
        </p>
        <h1>{section ? (sections[0]?.title ?? paper.title) : paper.title}</h1>
        {/* THE LEAD IS THE PAPER'S, so a section view does not repeat it. It orients a
            reader who has just arrived at the paper; someone who has navigated to one
            section has already read it, and on a section page it pushed the argument
            further down while saying nothing about the section.

            There is no review-status disclosure under it
            (D-2026-09-25-no-review-status-banners). */}
        {section ? null : <p className="lead">{paper.description}</p>}
        {section && (
          <a href={`/papers/brownian-motion/#${section}`}>Read this section in the whole paper →</a>
        )}
      </header>
      <ReaderController
        registry={registry}
        titles={titles}
        questions={questions}
        notationHelp={notationHelp}
        availability={sources.availability}
      />
      <noscript>
        <p className="notice">
          JavaScript is off. The full explanation is shown. Each passage’s “Show every step here”
          disclosure works without scripts, and foundation links open complete reading pages. The
          embedded laboratory remains a static worked example.
        </p>
      </noscript>
      <ReaderLayout
        outline={
          <>
            <h2>Follow the argument</h2>
            <nav aria-label="Argument outline">
              {/* Every section of the paper, on a section's own page too; the others link to
                  their pages. */}
              {outlineOrder(paper.sections, missingParts, [...elsewhere.keys()]).map((entry) => {
                if (entry.kind === "elsewhere")
                  return (
                    <ExplainedElsewhereOutlineEntry
                      key={entry.part}
                      part={entry.part}
                      passages={(elsewhere.get(entry.part) ?? []).flatMap(passageLink)}
                    />
                  );
                if (entry.kind === "missing")
                  return (
                    <UnexplainedOutlineEntry
                      key={entry.part}
                      part={entry.part}
                      href={partHref(entry.part)}
                    />
                  );
                const s = entry.section;
                return sections.includes(s) ? (
                  <div key={s.id}>
                    <a
                      data-reader-anchor={s.id}
                      href={`#${s.id}`}
                      aria-current={section === s.id ? "page" : undefined}
                      aria-label={s.title}
                    >
                      <OutlineSectionTitle title={s.title} />
                    </a>
                    {args
                      .filter((a) => a.section === s.id)
                      .map((a) => (
                        <a key={a.id} data-reader-anchor={a.id} href={`#${a.id}`}>
                          {a.title}
                        </a>
                      ))}
                    <a
                      className="fine"
                      href={`/papers/${paper.id}/${s.id}/`}
                      aria-label={`Section-only reading: ${s.title}`}
                    >
                      Section-only reading →
                    </a>
                  </div>
                ) : (
                  <div key={s.id}>
                    <a href={`/papers/${paper.id}/${s.id}/`} aria-label={s.title}>
                      <OutlineSectionTitle title={s.title} />
                    </a>
                  </div>
                );
              })}
            </nav>
            <UnexplainedPartsLine parts={missingParts} hrefFor={partHref} />
          </>
        }
        companion={
          <Companion kind={companionKind}>
            {companionKind === "original" ? (
              <>
                <p>
                  <a href="/papers/brownian-motion/view/german/">
                    Read the German source for the whole paper →
                  </a>
                </p>
                {englishSource && (
                  <p>
                    <a href={englishSource.href}>{englishSource.label}</a>
                  </p>
                )}
              </>
            ) : companionKind === "equation" ? (
              <p>
                Equations stay in the passage. Pin one from the derivation when you need it beside
                the next step.
              </p>
            ) : companionKind === "laboratory" ? (
              <p>
                The tracer ensemble is on this page, in a bounded region that yields on a phone.{" "}
                <a href="#lab-bm-01">Jump to the laboratory</a> or{" "}
                <a href="/lab/bm-01/">open it full page</a>.
              </p>
            ) : (
              <div>
                {companionPlate && sectionLabel ? (
                  <figure className="companion-plate">
                    <a href={companionPlate.germanHref}>
                      {/* A plain img, as in FollowingPlate: under images.unoptimized next/image
                          emits no srcset, and on a 2x screen the plate needs its 1280px source.
                          Biome's noImgElement warns on this; the reason is here, not silenced. */}
                      <img
                        src={companionPlate.src}
                        srcSet={companionPlate.srcSet}
                        sizes="20rem"
                        width={640}
                        height={987}
                        loading="lazy"
                        decoding="async"
                        alt={`Page ${companionPlate.page} of Annalen der Physik, volume ${companionPlate.volume}, where ${sectionLabel} begins.`}
                      />
                    </a>
                    <figcaption>
                      {sectionLabel} begins on page {companionPlate.page} of Annalen der Physik,
                      volume {companionPlate.volume}.{" "}
                      <a href={companionPlate.germanHref}>Read it in Einstein&rsquo;s German</a>
                    </figcaption>
                  </figure>
                ) : null}
                {sectionSymbols.length > 0 && sectionLabel ? (
                  <>
                    <h2>Symbols in {sectionLabel}</h2>
                    <QuantityLegendList
                      legend={sectionSymbols}
                      label={`Symbols in ${sectionLabel}, by colour and name`}
                      className="equation-legend companion-symbols"
                    />
                  </>
                ) : null}
                {section ? null : (
                  <>
                    <h2>Beside each section</h2>
                    <p>
                      A section&rsquo;s own page sets its printed page and a key to its symbols
                      here:{" "}
                      {paper.sections.map((s, i) => (
                        <span key={s.id}>
                          {i > 0 ? ", " : ""}
                          <a href={`/papers/brownian-motion/${s.id}/`}>
                            {s.id === "s0" ? "Introduction" : `§${s.id.replace(/^s/, "")}`}
                          </a>
                        </span>
                      ))}
                      .
                    </p>
                  </>
                )}
                <p>
                  <a href="#lab-bm-01">Keep the tracer ensemble in view</a>
                </p>
              </div>
            )}
          </Companion>
        }
      >
        <div className="reader-body">
          {showsEntrance && (
            <section className="reader-entrance-section" aria-label="First encounter">
              <LazyBrownianFirstEncounter />
            </section>
          )}
          {sections.map((s) => (
            <section key={s.id} id={s.id} tabIndex={-1} className="reader-section">
              {/* On a section's own page the h1 above already names it, so the eye gets it once;
                  the h2 stays for the section's structure and for screen readers. */}
              <h2 className={section ? "visually-hidden" : undefined}>{s.title}</h2>
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
                    <p className="passage-kind">{passageKind(a.meaning)}</p>
                    <h3>{a.title}</h3>
                    <p className="passage-question">{a.question}</p>
                    {firstUses.get(a.id)?.map((entry) => (
                      <FirstUseCallout key={entry.id} entry={entry} />
                    ))}
                    <SourceParagraphs
                      paperId={paper.id}
                      bindings={boundParagraphs.filter((b) => b.passages.includes(a.id))}
                    />
                    <div data-face-reading>
                      {(["overview", "full"] as const).map((reading, i) => (
                        <div
                          data-reading={i}
                          hidden={i !== 1}
                          className="reading-version"
                          key={reading}
                        >
                          <ReadingBlocks
                            blocks={a.readings[reading]}
                            foundations={foundations}
                            contextLabel={`${a.title}, reading steps`}
                            equations={equationsById}
                          />
                        </div>
                      ))}
                      {/*
                        R2 IS RENDERED ONCE, AS THE DISCLOSURE. It used to be rendered twice per
                        passage: a hidden data-reading="2" copy for the page-wide "Show every
                        step", and the same blocks again, embedded lessons and all, inside "Show
                        every step here" below the equations. On /papers/brownian-motion/ that
                        was 149,096 bytes of markup twice over, plus both copies again in the
                        flight data, and it put the page over its 250 kB budget. One copy now
                        serves both: closed, it is the per-passage disclosure, which needs no
                        JavaScript; with Detail at "Show every step", ReaderController opens it
                        and detail.css hides its summary, so it reads as the passage's text.
                      */}
                      {/*
                        ON THE WHOLE-PAPER PAGE THE STEPS LOAD WHEN THEY OPEN (stepsBody.ts), as
                        on the other papers (PaperPage). Here the five disclosures, embedded
                        lessons and all, were 39,606 bytes of the live page's gzipped HTML and
                        46,599 of its flight data: 86 KB of 178 KB. The section's own page renders
                        them inline; this one holds a real link to it.
                      */}
                      <details className="local-steps reading-version" data-reading={2}>
                        <summary>Show every step here: {a.title}</summary>
                        {section ? (
                          <ReadingBlocks
                            blocks={a.readings.steps}
                            foundations={foundations}
                            embed
                            contextLabel={`${a.title}, reading steps`}
                            equations={equationsById}
                          />
                        ) : (
                          <p
                            className="fine"
                            data-steps-body={a.id}
                            data-steps-src={`/papers/${paper.id}/${a.section}/`}
                          >
                            <a
                              href={`/papers/${paper.id}/${a.section}/#${a.id}`}
                              aria-label={`Read every step on this section’s own page: ${a.title}`}
                            >
                              Read every step on this section&rsquo;s own page
                            </a>
                            , where they are part of the page.
                          </p>
                        )}
                      </details>
                      {(missingSteps.lessons as readonly CompiledMissingStepLesson[])
                        .filter((lesson) => lesson.argument === a.id)
                        .map((lesson) => (
                          <MissingStepDisclosure key={lesson.id} lesson={lesson} />
                        ))}
                      {/* The explorer cards, as on every other paper: loaded on first opening on
                          the whole-paper page, server-rendered on the section's own page. They
                          were rendered in full here for every argument, twelve cards with their
                          props repeated in the flight data, and the page was 312,857 bytes
                          gzipped on BUILD 22 against its 250,000 budget. The formula in the
                          reading carries the colour; the cards are for exploring it. */}
                      <ArgumentEquations
                        paperId={paper.id}
                        argumentId={a.id}
                        lazy={!section}
                        sectionHref={`/papers/${paper.id}/${a.section}/#${a.id}`}
                        title={a.title}
                      />
                      {/* R3, THE HISTORIAN'S MARGIN, IS A DISCLOSURE (am-read-shell-routes-3ua). It was
                          an aside marked hidden that only the modern lens showed, and the lens is set
                          by script, so with JavaScript off nothing reached it. Now it is closed and
                          openable without script; with script the lens decides as before
                          (reader.css hides it at "paper", ReaderController opens it at "modern"). */}
                      <details className="modern-margin callout-limit" data-reading="3">
                        <summary>
                          <h4>Modern qualifications</h4>
                        </summary>
                        <ReadingBlocks blocks={a.readings.margin} foundations={foundations} />
                      </details>
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
                    {/* What ?view=german shows in the passage's place: the ways to the faces that
                        hold the source. The notice above them ("The reviewed German, aligned
                        English, gloss, facsimile, and split view for this passage are not yet
                        available") went: false once they were, and review copy besides
                        (D-2026-09-25-no-review-status-banners). */}
                    <div data-face-source hidden>
                      <p>
                        <a href="/papers/brownian-motion/view/german/">
                          Read the German source for the whole paper →
                        </a>
                      </p>
                      {englishSource && (
                        <p>
                          <a href={englishSource.href}>{englishSource.label}</a>
                        </p>
                      )}
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
                      {a.prerequisites.length > 0 && (
                        <p>
                          Earlier step:{" "}
                          {a.prerequisites.map((x) => {
                            const prereq = payload.arguments.find((p) => p.id === x.id);
                            return (
                              <a key={x.id} href={`/papers/${paper.id}/#${x.id}`}>
                                {prereq?.title ?? x.id}
                              </a>
                            );
                          })}
                        </p>
                      )}
                    </details>
                    <PassageActionsBar
                      paperId={paper.id}
                      passageId={a.id}
                      passageLabel={a.title}
                      actions={passageActionsFromArgument(a)}
                      originalHref={originalHref(paper.id, sources, a.section)}
                    />
                    <p className="fine">
                      Source context:{" "}
                      {a.citations.map((id) => {
                        const c = payload.citations.find((c) => c.id === id);
                        if (!c) return null;
                        return (
                          <a key={id} href={c.url}>
                            {c.locator}
                          </a>
                        );
                      })}
                    </p>
                  </article>
                ))}
            </section>
          ))}
          {section ? (
            <SectionPager paperId={paper.id} sections={paper.sections} current={section} />
          ) : null}
        </div>
        <StickyLabRegion>
          <section id="lab-bm-01" className="reader-inline-lab">
            <h2>Try the displacement argument yourself</h2>
            <p>
              Once open, the tracer ensemble stays open while you change the detail or read a
              lesson. It runs a new trial only when you apply its settings; opening an explanation
              never starts one.
            </p>
            <LazyInlineTracerLab />
          </section>
        </StickyLabRegion>
      </ReaderLayout>
      <section className="reader-downloads">
        <h2>Read in another form</h2>
        <p>
          <a href={payload.exports.markdown}>Download the full explanation as Markdown</a> ·{" "}
          <a href={payload.exports.json}>The same explanation as data (JSON)</a> ·{" "}
          <a href="/foundations/">Browse the foundation library</a>
        </p>
      </section>
      <dialog className="clarification-dialog" data-clarification-dialog aria-modal="true">
        {/* The X, first so the question line wraps round it; ReaderController wires it, and a press
            outside the lesson, to "Return to the exact step". Escape still goes back one step. */}
        <ModalCloseButton
          label="Close the lesson and return to the passage"
          data-clarification-close
        />
        {/* The question stays above the lesson; the reading settings and the way back sit
            after it, so on a phone the lesson opens on the first screen. The X is sticky, so a
            reader can still leave from anywhere in a long lesson. */}
        <p className="fine reader-compass-question">
          <strong>The question we were answering:</strong> <span data-compass-question />
        </p>
        {foundations.map((f) => (
          <section key={f.id} data-foundation-panel={f.id} hidden>
            <h2 id={`clarification-${f.id}`} tabIndex={-1}>
              {f.title}
            </h2>
            {/* The body loads when this lesson opens (src/reader/lessonBody.ts), from its own
                page; the dialog carried every lesson in full and put the Brownian page over its
                HTML budget. Without JavaScript the dialog never opens and each lesson link is a
                real link to that page. */}
            <div data-lesson-body={f.id}>
              <p className="fine">Loading the lesson.</p>
            </div>
            <p>
              <a
                href={`/foundations/${f.id}/`}
                aria-label={`Open ${f.title} as a full reading page`}
              >
                Open this as a full reading page →
              </a>
            </p>
          </section>
        ))}
        <nav className="reader-compass" aria-label="Explanation compass">
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
      </dialog>
    </div>
  );
}
