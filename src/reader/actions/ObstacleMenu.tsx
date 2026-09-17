/**
 * "What is getting in the way?" (am-read-passage-actions-vbe): exactly the
 * six frozen obstacle choices, each opening its authored response inline
 * via a real `<details>` disclosure -- keyboard operable and readable with
 * no JavaScript, per the bead's own "every action is a real link/disclosure"
 * requirement. Copy never asks the reader to self-diagnose; the labels
 * below are the neutral, concrete phrasing the bead specifies, not framed
 * as a difficulty admission.
 */

import {
  OBSTACLE_KIND_IDS,
  type ObstacleKindId,
  type ObstacleResponses,
} from "./passageActions.schema.ts";

const OBSTACLE_LABELS: Readonly<Record<ObstacleKindId, string>> = {
  unfamiliarWordOrSymbol: "An unfamiliar word or symbol",
  algebraicMove: "An algebraic move",
  physicalReason: "The physical reason for a step",
  connectionToPicture: "The connection to the picture",
  purposeOfCalculation: "The purpose of the calculation",
  tooMuchAtOnce: "Simply too much at once",
};

export interface ObstacleMenuProps {
  readonly responses: ObstacleResponses | undefined;
  /** For accessible names, e.g. "section 4, paragraph 2, sentence 1". */
  readonly passageLabel: string;
}

/** Renders nothing when no obstacle response exists for this passage: a missing response is a coverage gap, never filled with generated text. */
export function ObstacleMenu({ responses, passageLabel }: ObstacleMenuProps) {
  const available = OBSTACLE_KIND_IDS.filter((kind) => responses?.[kind] !== undefined);
  if (available.length === 0) return null;

  return (
    <details className="obstacle-menu" data-obstacle-menu>
      <summary>What is getting in the way?</summary>
      <ul>
        {available.map((kind) => {
          const detail = responses?.[kind];
          if (!detail) return null;
          return (
            <li key={kind}>
              <details className="obstacle-response" data-obstacle-kind={kind}>
                <summary aria-label={`${OBSTACLE_LABELS[kind]}: ${passageLabel}`}>
                  {OBSTACLE_LABELS[kind]}
                </summary>
                <p>{detail.explanation}</p>
              </details>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
