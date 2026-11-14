import type { PaperPayload } from "../../content/compiler/compile.ts";
import { paneDomId } from "../anchors/paneIds.ts";
import { ReadingBlocks } from "../Blocks.tsx";
import { FaceChooser } from "../FaceChooser.tsx";
import type { FaceAvailability } from "../faceAvailability.ts";
import type { BilingualEdition } from "../faces/bilingualLoader.ts";
import { ExplainerFragments } from "../faces/ExplainerFragments.tsx";
import type { FaceId } from "../faces/registry.ts";
import { resultCardsFor } from "../faces/results/fromRecords.ts";
import { ResultCard } from "../faces/results/ResultCard.tsx";
import { InlineMathText } from "../InlineMathText.tsx";
import { paperEquations } from "../paperEquations.ts";
import { faceLinkHref, paperPath } from "../paperRoutes.ts";
import { loadPassageProjections } from "../projections/passageProjections.ts";
import { ROOT_ARMING_SOURCE } from "../rootArming.inline.ts";
import { SplitEnhancer } from "./SplitEnhancer.tsx";
import { SplitInlineTerms } from "./SplitInlineTerms.tsx";
import { SplitSource } from "./SplitSource.tsx";
import { splitSourceSection } from "./sourceSection.ts";
import "./split.css";

export class SplitReadingError extends Error {
  readonly code = "split-section-missing";
  constructor(paper: string, section: string | undefined) {
    super(`No split reading section for ${paper}/${section ?? "first"}.`);
    this.name = "SplitReadingError";
  }
}

/**
 * A study face at section grain, like the gloss: the whole-paper route opens the first section.
 * Source, translation and all four authored readings are static. The island only selects and
 * navigates the already rendered text; numerical results come from their existing projections.
 */
export async function SplitReadingView({
  payload,
  edition,
  section,
  availability,
}: {
  payload: PaperPayload;
  edition: BilingualEdition | null;
  section?: string | undefined;
  availability: Readonly<Partial<Record<FaceId, FaceAvailability>>>;
}) {
  const { paper, foundations } = payload;
  const selected = paper.sections.find((s) => s.id === (section ?? paper.sections[0]?.id));
  if (!selected) throw new SplitReadingError(paper.id, section);
  const args = payload.arguments.filter((a) => a.section === selected.id);
  const argumentSections = Object.fromEntries(payload.arguments.map((a) => [a.id, a.section]));
  const source = edition ? splitSourceSection(edition, selected.id) : null;
  const [projections, allCards] = await Promise.all([
    loadPassageProjections(paper.id, { edition, payload }),
    resultCardsFor(paper.id),
  ]);
  const cards = (allCards ?? []).filter((card) => card.sectionAnchors.includes(selected.id));
  const equations = paperEquations(paper.id);
  const rowIds = new Set(
    [...(source?.rows ?? []), ...(source?.footnoteRows ?? [])].map((r) => r.key),
  );

  return (
    <div className="reader-root split-reader" data-reader-root data-ready="true" data-view="split">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: shared tested reader readiness source. */}
      <script dangerouslySetInnerHTML={{ __html: ROOT_ARMING_SOURCE }} />
      <SplitInlineTerms paper={paper.id} />
      <ExplainerFragments />
      <header className="page-intro">
        <p className="eyebrow">Read · {paper.title} · Split reading</p>
        <h1>{selected.title}</h1>
        <p className="lead">Read the source alongside its explanation, one section at a time.</p>
      </header>
      <FaceChooser
        paperId={paper.id}
        section={section}
        current="split"
        availability={availability}
      />

      <div
        className="split-reading"
        data-split=""
        data-split-comparison
        data-split-source="parallel"
        data-split-companion="reading"
      >
        <nav className="split-sections" aria-label={`Sections of ${paper.title}`}>
          <p className="eyebrow">Choose a section</p>
          <ol>
            {paper.sections.map((s) => (
              <li key={s.id}>
                <a
                  href={faceLinkHref(paper.id, "split", s.id)}
                  aria-current={s.id === selected.id ? "page" : undefined}
                  data-split-section-link
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <fieldset className="split-controls" data-split-controls hidden disabled>
          <legend>Compare reading faces</legend>
          <label htmlFor="split-source-choice">
            Source
            <select id="split-source-choice" data-split-source-choice defaultValue="parallel">
              <option value="parallel">German and English</option>
              <option value="german">German source</option>
              <option value="english">English translation</option>
              <option value="gloss">Interlinear gloss</option>
            </select>
          </label>
          <label htmlFor="split-companion-choice">
            Alongside
            <select id="split-companion-choice" data-split-companion-choice defaultValue="reading">
              <option value="reading">Explanation</option>
              <option value="results">Results</option>
            </select>
          </label>
          <button type="button" className="secondary" data-split-swap>
            Swap pane order
          </button>
        </fieldset>
        <p className="notice" data-split-notice role="status" hidden />
        <noscript>
          <p className="fine">
            The bilingual source and explanation are both available below. Section links and
            explanation disclosures work without JavaScript.
          </p>
        </noscript>
        <nav className="split-pane-tabs" data-split-tabs aria-label="Split reading faces">
          <a id="split-source-tab" href="#split-source-pane" data-split-tab="source">
            German and English
          </a>
          <a id="split-companion-tab" href="#split-companion-pane" data-split-tab="companion">
            Explanation
          </a>
        </nav>

        <div className="split-columns" data-split-columns>
          <section
            id="split-source-pane"
            className="split-pane"
            data-split-pane="parallel"
            data-split-role="source"
            aria-labelledby="split-source-heading"
          >
            <header className="split-pane-heading">
              <h2 id="split-source-heading" data-split-source-label>
                German and English
              </h2>
              <a data-split-source-face-link href={faceLinkHref(paper.id, "parallel", selected.id)}>
                Open this source on its own
              </a>
            </header>
            {edition && source && source.blocks.length > 0 ? (
              <SplitSource
                edition={edition}
                source={source}
                projections={projections}
                argumentSections={argumentSections}
                section={selected.id}
              />
            ) : (
              <p>
                The source text for this section is unavailable.{" "}
                <a href={faceLinkHref(paper.id, "facsimile", selected.id)}>Open the journal scan</a>
                .
              </p>
            )}
          </section>
          <section
            id="split-companion-pane"
            className="split-pane"
            data-split-pane="reading"
            data-split-role="companion"
            aria-labelledby="split-companion-heading"
          >
            <header className="split-pane-heading">
              <h2 id="split-companion-heading" data-split-companion-label>
                Explanation
              </h2>
              <a data-split-companion-face-link href={paperPath(paper.id, selected.id)}>
                Open this explanation on its own
              </a>
            </header>
            <div data-split-explanation>
              {args.map((a) => {
                const projection = projections.byArgument[a.id];
                const sourceLinks = projection?.german ?? [];
                return (
                  <article
                    className="split-argument"
                    key={a.id}
                    id={paneDomId(a.id, "secondary")}
                    data-anchor={a.id}
                    aria-labelledby={`split-title-${a.id}`}
                  >
                    <span id={a.id} className="split-argument-anchor" />
                    <h3 id={`split-title-${a.id}`}>{a.title}</h3>
                    <p className="split-question">
                      <InlineMathText text={a.question} />
                    </p>
                    <ReadingBlocks
                      blocks={a.readings.full}
                      foundations={foundations}
                      equations={equations}
                      scope={{ paper: paper.id, section: a.section, where: `${a.id} full` }}
                    />
                    {(
                      [
                        ["overview", "In one breath"],
                        ["steps", "Show every step"],
                        ["margin", "Margin notes"],
                      ] as const
                    ).map(([reading, label]) => (
                      <details key={reading} className="split-reading-details">
                        <summary>
                          {label}: {a.title}
                        </summary>
                        <ReadingBlocks
                          blocks={a.readings[reading]}
                          foundations={foundations}
                          equations={equations}
                          scope={{
                            paper: paper.id,
                            section: a.section,
                            where: `${a.id} ${reading}`,
                          }}
                        />
                      </details>
                    ))}
                    <details className="split-reading-details">
                      <summary>Premises and limits: {a.title}</summary>
                      <h4>Premises</h4>
                      <ul>
                        {a.premises.map((text) => (
                          <li key={text}>
                            <InlineMathText text={text} />
                          </li>
                        ))}
                      </ul>
                      <h4>Where this argument stops</h4>
                      <ul>
                        {a.limitations.map((text) => (
                          <li key={text}>
                            <InlineMathText text={text} />
                          </li>
                        ))}
                      </ul>
                    </details>
                    {sourceLinks.length > 0 ? (
                      <nav className="split-passage-links" aria-label={`Source for ${a.title}`}>
                        <p className="eyebrow">Read beside the source</p>
                        <ul>
                          {sourceLinks.map((link) => {
                            const id = decodeURIComponent(link.href.split("#")[1] ?? "");
                            const local = rowIds.has(id);
                            const sourceSection = source?.sectionOf.get(id);
                            const href = local
                              ? `#split-row-${id}`
                              : sourceSection
                                ? `${faceLinkHref(paper.id, "split", sourceSection)}#${id}`
                                : link.href;
                            return (
                              <li key={link.href}>
                                <a href={href} data-split-go={local ? "source" : undefined}>
                                  {link.label}
                                </a>
                              </li>
                            );
                          })}
                        </ul>
                      </nav>
                    ) : null}
                    <nav className="split-passage-links" aria-label={`Continue from ${a.title}`}>
                      <ul>
                        <li>
                          <a href={`${paperPath(paper.id, selected.id)}#${a.id}`}>
                            Open the full reading tools for {a.title}
                          </a>
                        </li>
                        {(projection?.instrument ?? []).map((link) => (
                          <li key={link.href}>
                            <a href={link.href}>Try it: {link.label}</a>
                          </li>
                        ))}
                        {(projection?.journey ?? []).map((link) => (
                          <li key={link.href}>
                            <a href={link.href}>{link.label}</a>
                          </li>
                        ))}
                      </ul>
                    </nav>
                  </article>
                );
              })}
              {args.length === 0 ? (
                <p>
                  This section has no explanation passage. Choose another section or read its
                  source.
                </p>
              ) : null}
            </div>
            <div data-split-results hidden>
              {cards.map((card) => (
                <ResultCard key={card.resultId} card={card} equations={equations} />
              ))}
              <section className="split-result-recaps" aria-labelledby="split-recaps-heading">
                <h3 id="split-recaps-heading">This section's argument</h3>
                {args.map((a) => (
                  <article key={a.id}>
                    <h4>{a.title}</h4>
                    <p>
                      <InlineMathText text={a.recap} />
                    </p>
                    <a href={`#${paneDomId(a.id, "secondary")}`} data-split-go="explanation">
                      Read this explanation
                    </a>
                  </article>
                ))}
                {cards.length === 0 ? (
                  <p>
                    No separate result card belongs to this section.{" "}
                    <a href={faceLinkHref(paper.id, "results")}>Read the paper's results</a>.
                  </p>
                ) : null}
              </section>
            </div>
          </section>
        </div>
        <SplitEnhancer
          paper={paper.id}
          section={selected.id}
          sections={paper.sections.map((s) => s.id)}
          argumentSections={argumentSections}
          sectionHrefs={Object.fromEntries(
            paper.sections.map((s) => [s.id, faceLinkHref(paper.id, "split", s.id)]),
          )}
          faceHrefs={{
            parallel: faceLinkHref(paper.id, "parallel", selected.id),
            german: faceLinkHref(paper.id, "german", selected.id),
            english: faceLinkHref(paper.id, "english", selected.id),
            gloss: faceLinkHref(paper.id, "gloss", selected.id),
            reading: paperPath(paper.id, selected.id),
            results: faceLinkHref(paper.id, "results", selected.id),
          }}
        />
      </div>
    </div>
  );
}
