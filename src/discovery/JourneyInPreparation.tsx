/**
 * In-preparation placeholder for Discovery Journey routes.
 * Specification: am-disc-journey-framework-umbg, AGENTS.md (§7.1)
 *
 * Receives ONLY bibliographic props so draft content cannot leak.
 */

import "./discovery.css";

export interface JourneyInPreparationProps {
  readonly paperId: string;
  readonly germanTitle: string;
  readonly englishTitle: string;
  readonly citation?: string | undefined;
}

export function JourneyInPreparation({
  paperId,
  germanTitle,
  englishTitle,
  citation,
}: JourneyInPreparationProps) {
  return (
    <article
      className="journey in-preparation"
      data-journey-in-preparation
      data-theme="kramgasse-night"
    >
      <header>
        <p className="eyebrow">Discover · A route you could take</p>
        <h1 lang="de">{germanTitle}</h1>
        <p className="subtitle">{englishTitle}</p>
        {citation && <p className="citation">{citation}</p>}
      </header>

      <section className="in-preparation-notice" data-in-preparation-notice>
        <h2>This journey is in preparation.</h2>
        <p>
          The discovery journey for this paper has not yet been published. The critical reading
          edition and companion materials remain available.
        </p>
        {paperId === "light-quanta" && (
          <section aria-labelledby="light-quanta-investigation-link">
            <h3 id="light-quanta-investigation-link">Investigate entropy, counting and emission</h3>
            <p>
              Carry a computed radiation state through coefficient matching, compare independent and
              locked configurations, and test one-variable photoelectric predictions. This
              explanatory workbench is not the historical journey.
            </p>
            <p>
              <a className="button" href="/discover/light-quanta/investigate/">
                Work through the connected light-quanta investigation →
              </a>
            </p>
            <p>
              <a className="button" href="/papers/light-quanta/#entry-light-quanta">
                Start with a counting example, no algebra required →
              </a>
            </p>
          </section>
        )}
        {paperId === "special-relativity" && (
          <section aria-labelledby="special-relativity-investigation-link">
            <h3 id="special-relativity-investigation-link">
              Construct a map and choose a measurement
            </h3>
            <p>
              Assemble the light-direction constraints, identify the still-undetermined scale, and
              test which event pairs measure a moving-frame length. This explanatory investigation
              is not the historical journey.
            </p>
            <p>
              <a className="button" href="/discover/special-relativity/investigate/">
                Build and test the relativity argument →
              </a>
            </p>
            <p>
              <a className="button" href="/papers/special-relativity/#entry-special-relativity">
                Start with one flash and two clocks, no algebra required →
              </a>
            </p>
          </section>
        )}
        {paperId === "mass-energy" && (
          <section aria-labelledby="mass-energy-investigation-link">
            <h3 id="mass-energy-investigation-link">Try the two-ledger argument workbench</h3>
            <p>
              Assemble a conditional derivation, inspect an unresolved offset, and distinguish a
              derivation from a consistency check that assumes its conclusion. The worked route and
              the existing laboratory are available now. This explanatory investigation is not the
              full journey or its historical knowledge shelf.
            </p>
            <p>
              <a className="button" href="/discover/mass-energy/investigate/">
                Build and test the mass–energy argument →
              </a>
            </p>
          </section>
        )}
        <p className="actions">
          <a className="button" href={`/papers/${paperId}/`}>
            Read the paper edition →
          </a>
          <a href="/papers/">Back to paper catalogue</a>
        </p>
      </section>
    </article>
  );
}
