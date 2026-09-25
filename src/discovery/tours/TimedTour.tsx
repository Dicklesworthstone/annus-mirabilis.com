/**
 * A timed tour without equations (am-tour-15min-mass-energy-nqz1): every step rendered in place, at
 * detail 0, from the record content/tours/<id>.yaml as src/content/tours/tours.ts resolves it.
 *
 * What each kind of step shows:
 * - first encounter: the paper's own entrance, through the shared renderer the paper page uses;
 * - reading: each paragraph's R0 overview, and a way to the passage that explains it, labelled as
 *   leaving the equation-free path;
 * - instrument: the prompt's question and its three choices, each opening its response in a native
 *   <details>, so the step works without JavaScript and nothing is scored. The laboratories do not
 *   yet have the equation-free presentation a tour needs (they never read the tour presentation
 *   context), so the step says so plainly and links the full laboratory, which shows equations. It
 *   never shows a picture in the instrument's place;
 * - journey stage: the journey's own move summary, by reference, labelled a draft while it is one.
 */
import { validateEntranceRecord } from "../../content/entrances/entranceRecord.ts";
import type { Tour, TourStep } from "../../content/tours/tours.ts";
import entranceExample from "../../generated/mass-energy-entrance.json";
import type { MassEnergyEntranceScenario } from "../../reader/entrances/massEnergyExample.ts";
import { LazyMassEnergyFirstEncounter } from "../../reader/lazyIslands.tsx";

/** "ME-01" for me-01: the name the laboratory page carries. */
const labName = (id: string) => id.toUpperCase();
const minutesText = (m: number) => `${m} ${m === 1 ? "minute" : "minutes"}`;

function FirstEncounter({ step }: { step: Extract<TourStep, { kind: "first-encounter" }> }) {
  if (step.recordId !== "entrance-mass-energy")
    return (
      <p className="notice">
        This paper's first encounter cannot be shown inside a tour yet.{" "}
        <a href={`/papers/mass-energy/#${step.anchor}`}>Open it on the paper's page</a>.
      </p>
    );
  return (
    // As the paper page mounts it (PaperPage.tsx), from the same prepared record and scenarios.
    <LazyMassEnergyFirstEncounter
      record={validateEntranceRecord(entranceExample.record)}
      scenarios={entranceExample.scenarios as readonly MassEnergyEntranceScenario[]}
      sourceDigest={entranceExample.sourceDigest}
    />
  );
}

function Reading({ paper, step }: { paper: string; step: Extract<TourStep, { kind: "reading" }> }) {
  const passage = step.paragraphs.flatMap((p) => p.passages)[0];
  return (
    <>
      {step.paragraphs.map((p) => (
        <p key={p.anchor} data-tour-anchor={p.anchor}>
          {p.r0}
        </p>
      ))}
      {passage ? (
        <p className="fine">
          <a href={`/papers/${paper}/#${passage}`}>
            See this in the paper (this leaves the equation-free path)
          </a>
        </p>
      ) : null}
    </>
  );
}

function Instrument({ step }: { step: Extract<TourStep, { kind: "instrument" }> }) {
  return (
    <div data-instrument-step={step.instrumentId} data-prompt-id={step.promptId}>
      <p className="notice">
        The equation-free version of {labName(step.instrumentId)} is not built yet, so this step
        asks its question here. The laboratory itself shows equations.
      </p>
      <p>
        <strong>{step.question}</strong>
      </p>
      <p className="fine">Open the answer you expect. Nothing is scored.</p>
      {step.choices.map((c) => (
        <details key={c.candidateId} data-candidate-id={c.candidateId}>
          <summary>{c.text}</summary>
          <p>{c.response}</p>
        </details>
      ))}
      <div className="guided-tour-actions">
        <a href={`/lab/${step.instrumentId}/`}>
          Open {labName(step.instrumentId)} in full (this shows equations)
        </a>
      </div>
    </div>
  );
}

function JourneyStage({ step }: { step: Extract<TourStep, { kind: "journey-stage" }> }) {
  return (
    <>
      <p data-move-summary={step.journeyId}>{step.summary}</p>
      {/* No "This summary is a draft: no physics reviewer has checked it yet."
          (D-2026-09-25-no-review-status-banners); the step's reviewState stays in its record. */}
      <div className="guided-tour-actions">
        <a href={step.href}>Follow the longer discovery path</a>
      </div>
    </>
  );
}

export function TimedTour({ tour }: { tour: Tour }) {
  return (
    <article className="guided-tour-page" data-timed-tour={tour.id}>
      <header className="page-intro">
        <p className="eyebrow">
          Guided reading · About {minutesText(tour.totalMinutes)} · No equations
        </p>
        <h1>{tour.title}</h1>
        <p className="lead">{tour.introduction}</p>
        <p className="notice">
          The times are estimates for reading at a steady pace, and you can take as long as you
          like.
        </p>
      </header>
      <ol className="guided-tour-stops">
        {tour.steps.map((step, i) => (
          <li key={step.id} id={`tour-step-${step.id}`} data-step-kind={step.kind}>
            <section aria-labelledby={`title-${step.id}`}>
              <p className="eyebrow">
                Step {i + 1} of {tour.steps.length} · about {minutesText(step.minutes)}
              </p>
              <h2 id={`title-${step.id}`}>{step.title}</h2>
              <p>{step.purpose}</p>
              {step.kind === "first-encounter" ? <FirstEncounter step={step} /> : null}
              {step.kind === "reading" ? <Reading paper={tour.paper} step={step} /> : null}
              {step.kind === "instrument" ? <Instrument step={step} /> : null}
              {step.kind === "journey-stage" ? <JourneyStage step={step} /> : null}
            </section>
          </li>
        ))}
      </ol>
      <section id="tour-finish" aria-labelledby="tour-finish-title">
        <h2 id="tour-finish-title">What you can now say</h2>
        <p>{tour.completion}</p>
        <div className="guided-tour-actions">
          <a href={`/papers/${tour.paper}/`}>Read the full paper</a>
          <a href="/tours/">Choose another guided path</a>
        </div>
      </section>
    </article>
  );
}
