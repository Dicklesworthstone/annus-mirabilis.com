import { Fragment, type ReactNode } from "react";
import type { Stage } from "../content/schemas/journey.ts";
import type { KnowledgeCard } from "./cards/types.ts";
import { DiscoveryStageNotes } from "./notes/StageNotes.tsx";

/** The route's prose, premises and worked guidance read the same stage as its compiler record. */
export function AuthoredJourneyStage({
  stage,
  shelf,
  afterExplanation,
  afterFirstParagraph,
  children,
}: Readonly<{
  stage: Stage;
  shelf: readonly KnowledgeCard[];
  /** Existing rich content can stay in its original place before the added guidance. */
  afterExplanation?: ReactNode;
  /** The printed formula belongs between the coefficient stage's two original paragraphs. */
  afterFirstParagraph?: ReactNode;
  children?: ReactNode;
}>) {
  const { support } = stage;
  return (
    <section id={stage.id} data-stage-id={stage.id} aria-labelledby={`${stage.id}-question`}>
      <p className="step-number">
        {stage.id.replace("step-", "")} / {stage.title}
      </p>
      <h2 id={`${stage.id}-question`}>{stage.question}</h2>
      {/* Optional private notes appear only when the route provides a shared notebook. */}
      <DiscoveryStageNotes
        stageId={stage.id}
        prompt={support.prediction?.prompt ?? stage.question}
      />
      {support.explanation.split("\n\n").map((paragraph, index) => (
        <Fragment key={paragraph}>
          <p data-stage-prose="">{paragraph}</p>
          {index === 0 ? afterFirstParagraph : null}
        </Fragment>
      ))}
      {afterExplanation}
      {support.transferCase && (
        <details>
          <summary>{support.transferCase.condition}</summary>
          <p>{support.transferCase.explanation}</p>
          <p>
            <strong>What changes:</strong> {support.transferCase.whatChanges}
          </p>
          <p>
            <strong>What still holds:</strong> {support.transferCase.whatStaysValid}
          </p>
        </details>
      )}
      <details data-stage-premises="">
        <summary>What this step uses</summary>
        <p>{stage.computeFromShelf}</p>
        <ul>
          {stage.premiseRefs.map((reference) => {
            const card = shelf.find((entry) => entry.id === reference.cardId);
            const source = card?.sources[0];
            const title =
              typeof source === "string"
                ? source
                : typeof source === "object" &&
                    source !== null &&
                    "title" in source &&
                    typeof source.title === "string"
                  ? source.title
                  : "Read the premise";
            return (
              <li key={reference.cardId}>
                <a href={`#card-${reference.cardId}`}>{title}</a>
                {reference.importId
                  ? " (imported from 1905)"
                  : card
                    ? ` (${card.date.latestYear})`
                    : ""}
              </li>
            );
          })}
        </ul>
        <p>The reasoning tools:</p>
        <ul>
          {stage.reasoning.map((reason) => (
            <li key={reason.foundationId}>
              <a href={`/foundations/${reason.foundationId}/`}>{reason.label}</a>
            </li>
          ))}
        </ul>
        {stage.instrument && (
          <p>
            <a href={`/lab/${stage.instrument.instrumentId}/`}>
              Explore this step in the laboratory
            </a>
          </p>
        )}
      </details>
      <details data-stage-worked-example="">
        <summary>Work through this step</summary>
        <p>{support.workedExample.prompt}</p>
        <ol>
          {support.workedExample.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p>{support.workedExample.result}</p>
        <p>{support.partialComparison.given}</p>
        <p>{support.partialComparison.toComplete}</p>
        <details>
          <summary>Compare your reasoning</summary>
          <p>{support.partialComparison.explanation}</p>
        </details>
        {support.prediction && (
          <>
            <p>{support.prediction.prompt}</p>
            <ul>
              {support.prediction.choices?.map((choice) => (
                <li key={choice}>{choice}</li>
              ))}
            </ul>
            <details>
              <summary>What the premises decide so far</summary>
              <p>{support.prediction.explanation}</p>
            </details>
          </>
        )}
      </details>
      {children}
    </section>
  );
}
