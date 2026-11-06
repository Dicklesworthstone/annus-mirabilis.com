import type { Metadata } from "next";
import { KnowledgeCardView } from "../../discovery/cards/KnowledgeCard.tsx";
import { StatusLabel } from "../../discovery/cards/StatusLabel.tsx";
import { DeskCatalogueFilters } from "../../discovery/desk/DeskCatalogueFilters.tsx";
import { DeskPrint } from "../../discovery/desk/DeskPrint.tsx";
import { HistoricalExperiment } from "../../discovery/desk/HistoricalExperiment.tsx";
import { DESK_INSTRUMENT_BINDINGS } from "../../discovery/desk/instruments.ts";
import {
  DESK_QUESTIONS,
  DESK_TIMELINE_BOUNDARY,
  type DeskExperimentId,
  deskFilterEntry,
  deskJourneyStageLinks,
  deskSourceTitle,
} from "../../discovery/desk/model.ts";
import { loadDesk } from "../../discovery/desk/records.ts";
import {
  DeskWorkedExample,
  RadiationPressureExample,
} from "../../discovery/desk/WorkedExamples.tsx";
import {
  dateKindLabel,
  formatTimelineDate,
  TIMELINE_PAPER_NAMES,
} from "../../discovery/timeline/model.ts";
import "./desk.css";

export const metadata: Metadata = {
  title: "The 1904 desk: five objects, open questions",
  description:
    "Explore the observations, experiments and unresolved questions available before the four papers of 1905. Five objects connect historical sources to calculations you can change.",
  alternates: { canonical: "/1904/" },
};

const EXPERIMENT_TITLES: Readonly<Record<DeskExperimentId, string>> = {
  "lq-02": "Try the classical energy allocation",
  "signed-displacement": "Compare four signed displacements",
  "sr-04": "Apply the Galilean rule to objects and light",
  "shelf-michelson-morley": "Rotate the arms; compare contraction",
  "shelf-fizeau": "Compare three accounts of moving water",
  "shelf-maxwell-galilean": "Change coordinates in the wave equation",
};

export default function Desk1904Page() {
  const desk = loadDesk();
  const byCard = new Map(desk.catalogue.map((entry) => [entry.card.id, entry]));
  const available = desk.catalogue.filter((entry) => entry.card.status === "available").length;
  const parallel = desk.catalogue.length - available;
  return (
    <article
      className="desk-page"
      data-historical-cutoff="1904"
      data-edition-status="explanatory-preview"
    >
      <header className="page-intro">
        <p className="eyebrow">Before the four papers</p>
        <h1>The 1904 desk</h1>
        <p className="lead">Five objects. Established results. Questions still open.</p>
        <p>
          Choose an object, separate what can be measured from what might explain it, and try the
          consequences of an assumption. The sources and worked examples are readable before any
          experiment loads.
        </p>
        <p className="desk-reconstruction">{desk.reconstruction}</p>
      </header>
      <nav className="desk-object-nav" id="desk-objects" aria-label="Choose an object on the desk">
        {desk.objects.map((object, index) => (
          <a href={`#${object.id}`} key={object.id}>
            <span className="desk-object-number">0{index + 1}</span>
            <strong>{object.title}</strong>
            <span>{object.question}</span>
          </a>
        ))}
      </nav>
      <p className="desk-catalogue-jump">
        <a href="#desk-catalogue">Browse all {desk.catalogue.length} knowledge cards</a> ·{" "}
        <a href={DESK_TIMELINE_BOUNDARY}>See the end-of-1904 boundary on the timeline</a>
      </p>
      {desk.objects.map((object, index) => (
        <section
          className="desk-object"
          id={object.id}
          key={object.id}
          aria-labelledby={`${object.id}-title`}
        >
          <header className="desk-object-heading">
            <p className="eyebrow">Object 0{index + 1}</p>
            <h2 id={`${object.id}-title`}>{object.title}</h2>
            <p className="lead">{object.question}</p>
          </header>
          <p>{object.description}</p>
          <div className="desk-open-question">
            <h3>What remains unresolved?</h3>
            <p>{object.unresolved}</p>
          </div>
          <div className="desk-questions">
            <h3>Three questions to ask</h3>
            <p className="fine">
              Pause over a question, then open a possible response. These are prompts for reasoning,
              without a score.
            </p>
            {DESK_QUESTIONS.map((question, q) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{object.responses[q]}</p>
              </details>
            ))}
          </div>
          <details className="desk-established">
            <summary>
              Established results and their limits ({object.cardIds.length} source cards)
            </summary>
            <ul>
              {object.cardIds.map((id) => {
                const card = byCard.get(id)?.card;
                if (!card) throw new Error(`1904 desk: unresolved card ${id}`);
                return (
                  <li key={id}>
                    <a href={`#card-${id}`}>{deskSourceTitle(card)}</a>{" "}
                    <span className="fine">
                      (
                      {formatTimelineDate({
                        ...card.date,
                        kind: card.date.eventKind ?? "available",
                      })}
                      )
                    </span>
                    {card.status === "parallel-work" ? (
                      <>
                        <br />
                        <StatusLabel status={card.status} />
                      </>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </details>
          <div className="desk-tools">
            <h3>Tools for working it out</h3>
            <ul>
              {object.foundations.map((slug) => (
                <li key={slug}>
                  <a href={`/foundations/${slug}/`}>{desk.foundationTitles.get(slug)}</a>
                </li>
              ))}
            </ul>
            <p className="fine">
              Foundation lessons are learning aids and may discuss later developments; their
              contents are not additional premises on this desk.
            </p>
          </div>
          {object.experiments.map((id) => (
            <HistoricalExperiment
              id={id}
              title={EXPERIMENT_TITLES[id]}
              standalonePath={
                id === "signed-displacement"
                  ? undefined
                  : DESK_INSTRUMENT_BINDINGS[id].standalonePath
              }
              key={id}
            >
              <DeskWorkedExample id={id} />
            </HistoricalExperiment>
          ))}
          {object.id === "object-energy-ledger" ? <RadiationPressureExample /> : null}
          <p className="desk-onward">
            <a href={`/discover/${object.journey}/`}>
              Continue to the {TIMELINE_PAPER_NAMES[object.journey]?.toLowerCase()} discovery route
            </a>{" "}
            · <a href="#desk-catalogue">Compare the source cards</a> ·{" "}
            <a href="#desk-objects">Back to the objects</a>
          </p>
        </section>
      ))}
      <section
        id="desk-catalogue"
        className="desk-catalogue"
        aria-labelledby="desk-catalogue-title"
      >
        <header>
          <p className="eyebrow">The premise catalogue</p>
          <h2 id="desk-catalogue-title">What was available?</h2>
          <p>
            {available} cards were available by the end of 1904. {parallel} later parallel-work card
            is displayed with its explicit flag and is not a premise available to a 1904 reader.
            Dates retain the precision recorded by their sources.
          </p>
          <p>
            The catalogue excludes later evidence and the 1905 result imported into the
            mass-and-energy journey.{" "}
            <a href={DESK_TIMELINE_BOUNDARY}>Follow the timeline across the end-of-1904 boundary</a>{" "}
            for that material. Availability here does not establish that Einstein read a source.
          </p>
        </header>
        <DeskCatalogueFilters
          entries={desk.catalogue.map(deskFilterEntry)}
          objects={desk.objects.map(({ id, title }) => ({ id, title }))}
        />
        <ol className="desk-catalogue-list" id="desk-catalogue-list">
          {desk.catalogue.map(({ card, objectIds, journeys }) => (
            <li key={card.id} id={`desk-entry-${card.id}`} data-desk-entry={card.id}>
              <p className="desk-card-date">
                {dateKindLabel(card.date.eventKind ?? "available")}{" "}
                {formatTimelineDate({ ...card.date, kind: card.date.eventKind ?? "available" })}
              </p>
              <KnowledgeCardView
                card={card}
                relatedCard={card.relatedCardId ? byCard.get(card.relatedCardId)?.card : undefined}
              />
              <nav
                className="desk-card-links"
                aria-label={`Where this source is used: ${deskSourceTitle(card)}`}
              >
                {objectIds.map((id) => (
                  <a href={`#${id}`} key={id}>
                    {desk.objects.find((object) => object.id === id)?.title}
                  </a>
                ))}
                {journeys.map((journey) => (
                  <a href={`/discover/${journey}/#card-${card.id}`} key={journey}>
                    {TIMELINE_PAPER_NAMES[journey]} source and route
                  </a>
                ))}
                {journeys
                  .flatMap((journey) => deskJourneyStageLinks(card, journey))
                  .map((link) => (
                    <a href={link.href} key={link.href}>
                      {link.label}
                    </a>
                  ))}
                <a href={`/timeline/#t-${card.id}`}>Dated timeline entry</a>
              </nav>
            </li>
          ))}
        </ol>
        <noscript>
          <p>
            JavaScript is off, so every card is shown. Source cards and question responses still
            open with the keyboard or a click.
          </p>
        </noscript>
      </section>
      <DeskPrint />
    </article>
  );
}
