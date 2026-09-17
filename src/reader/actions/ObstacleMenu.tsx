/**
 * "What is getting in the way?" (am-read-passage-actions-vbe): exactly the
 * six frozen obstacle choices. Authored responses open inline via a real
 * `<details>` disclosure (keyboard, no JavaScript). A kind with no authored
 * response is said as unavailable -- never filled with generated help.
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
  readonly passageLabel: string;
  readonly passageId: string;
  /** When true, every kind is offered; missing ones are unavailable, not omitted. */
  readonly hard: boolean;
}

export function ObstacleMenu({ responses, passageLabel, passageId, hard }: ObstacleMenuProps) {
  const hasAny = OBSTACLE_KIND_IDS.some((kind) => responses?.[kind] !== undefined);
  if (!hard && !hasAny) return null;

  return (
    <details className="obstacle-menu" data-obstacle-menu>
      <summary>What is getting in the way?</summary>
      <ul>
        {OBSTACLE_KIND_IDS.map((kind) => {
          const detail = responses?.[kind];
          if (!detail) {
            return (
              <li key={kind} data-obstacle-kind={kind} data-obstacle-unavailable="">
                <p>
                  <strong>{OBSTACLE_LABELS[kind]}</strong>
                </p>
                <p className="notice">
                  This answer is not yet authored for this passage. No gloss, foundation, or
                  invented explanation is offered in its place.
                </p>
              </li>
            );
          }
          const links = detail.foundationLinks ?? [];
          return (
            <li key={kind}>
              <details
                className="obstacle-response"
                data-obstacle-kind={kind}
                id={`${passageId}-obstacle-${kind}`}
              >
                <summary aria-label={`${OBSTACLE_LABELS[kind]}: ${passageLabel}`}>
                  {OBSTACLE_LABELS[kind]}
                </summary>
                <p>{detail.explanation}</p>
                {links.length > 0 ? (
                  <p>
                    {links.map((link) => (
                      <a
                        key={link.foundationId}
                        href={`/foundations/${link.foundationId}/`}
                        data-foundation={link.foundationId}
                        data-return-caption={link.returnCaption ?? `Return to ${passageLabel}.`}
                        aria-label={`Open the explanation that addresses this: ${OBSTACLE_LABELS[kind]}`}
                      >
                        Open the explanation that addresses this
                      </a>
                    ))}
                  </p>
                ) : null}
              </details>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
