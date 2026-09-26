import type { ReactNode } from "react";
import type { WorldCheck as WorldCheckType } from "../content/schemas/journey.ts";
import "./journeySkeleton.css";

export interface WorldCheckProps {
  readonly check: WorldCheckType;
  /**
   * The prediction computed from the instrument's accepted snapshot, rendered by the page that
   * owns that snapshot (plan §9.1 item 7). Given, it replaces the static description of the
   * instrument, the quantity id and the expected value, which a reader cannot use.
   */
  readonly live?: ReactNode | undefined;
}

const KIND_WORDS: Readonly<Record<string, string>> = {
  "measured-fact": "A measured fact",
  "printed-prediction": "A printed prediction",
  "theoretical-bound": "A theoretical bound",
};

/**
 * The journey's result set against the world (dispatch 276): the claim, the worked value beside
 * the laboratory's live one, and what was measured later. One container, a quiet field with an ink
 * rule (journeySkeleton.css); its parts are columns of text, not boxes, and nothing is in the
 * accent. The build's names (the constant set, the later record, the quantity) are carried as
 * data, not printed.
 */
export function WorldCheck({ check, live }: WorldCheckProps) {
  const {
    id,
    claim,
    instrumentId,
    expected,
    tolerance,
    laterEvidence,
    staticWorkedExample,
    comparisonKind,
  } = check;

  return (
    <article
      id={id}
      className="journey-world-check"
      data-world-check-id={id}
      data-comparison-kind={comparisonKind}
    >
      <p className="eyebrow">Check it against the world</p>
      <p className="fine journey-world-check-kind">
        {KIND_WORDS[comparisonKind] ?? comparisonKind}
      </p>
      <p>{claim}</p>

      <div className="journey-world-check-columns">
        <div data-constant-set={staticWorkedExample.constantSetId}>
          <p className="eyebrow">Worked value</p>
          <p>{staticWorkedExample.label}</p>
          <p className="journey-world-check-value">
            {staticWorkedExample.value} {staticWorkedExample.unit}
          </p>
        </div>
        {live ?? (
          <div>
            <p className="eyebrow">In the laboratory</p>
            <p>
              <a href={`/lab/${instrumentId}/`}>Open the laboratory</a>
            </p>
            <p className="journey-world-check-value">
              Expected: {String(expected)}
              {tolerance?.relative !== undefined ? ` (±${tolerance.relative * 100}%)` : null}
            </p>
          </div>
        )}
      </div>

      {laterEvidence ? (
        <p className="fine" data-later-record={laterEvidence.recordId}>
          <strong>Measured later, in {laterEvidence.year}.</strong> {laterEvidence.description}
        </p>
      ) : null}
    </article>
  );
}
