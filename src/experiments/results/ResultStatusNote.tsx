import type React from "react";
import {
  type AuthoredExplanation,
  explainOutcome,
  explainRefusal,
  explainResult,
  type ResolvedExplanation,
} from "./explanations.ts";
import type { ExecutionOutcome } from "./outcomes.ts";
import type { RequestRefusal } from "./refusals.ts";
import type { ParameterAction, ResultPayload, ScientificResult } from "./types.ts";

export interface ResultStatusNoteProps {
  readonly result?: ScientificResult | ResultPayload | undefined;
  readonly refusal?: RequestRefusal | undefined;
  readonly outcome?: ExecutionOutcome | undefined;
  readonly snapshotVersion?: number | undefined;
  readonly className?: string | undefined;
  readonly authored?: AuthoredExplanation | undefined;
  readonly onAction?: ((action: ParameterAction) => void) | undefined;
}

/**
 * ResultStatusNote
 *
 * Renders an accessible, reader-facing explanation and next action for an output
 * status, request refusal, or execution outcome.
 *
 * Requirements (am-rt-typed-results-mqb):
 * - Renders ordinary language with a next action and no raw identifier leakage.
 * - Renders NO live region (no aria-live) of its own (live regions are owned by am-a11y-graph-descriptions-vxe1).
 * - Carries the committed snapshotVersion on data-snapshot-version.
 */
export function ResultStatusNote({
  result,
  refusal,
  outcome,
  snapshotVersion,
  className = "result-status-note",
  authored,
  onAction,
}: ResultStatusNoteProps): React.JSX.Element | null {
  if (!result && !refusal && !outcome) {
    return null;
  }

  let explanation: ResolvedExplanation;
  if (result) {
    explanation = explainResult(result, authored);
  } else if (refusal) {
    explanation = explainRefusal(refusal);
  } else if (outcome) {
    explanation = explainOutcome(outcome);
  } else {
    return null;
  }

  return (
    <div
      className={className}
      data-snapshot-version={snapshotVersion !== undefined ? snapshotVersion : undefined}
      data-result-status={result ? result.status : undefined}
      data-refusal-code={refusal ? refusal.code : undefined}
      data-outcome={outcome ? outcome.outcome : undefined}
    >
      <p className="result-status-message">{explanation.message}</p>
      <p className="result-status-action">{explanation.nextAction}</p>
      {explanation.action && onAction && (
        <button
          type="button"
          className="result-status-action-button"
          onClick={() => {
            if (explanation.action && onAction) {
              onAction(explanation.action);
            }
          }}
        >
          Apply Recommended Setting
        </button>
      )}
    </div>
  );
}
