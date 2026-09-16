/**
 * `data-execution-label`, `data-result-status`, and `data-refusal-code` (am-inst-execution-
 * labels-5ywv), emitted on the same instrument root as the identity attributes of a different
 * bead (am-rt-snapshot-store-aft's `instrumentRootAttributes`) -- spread alongside them, never
 * merged into that module, which this bead does not own. `data-instrument-id`,
 * `data-instance-id`, `data-run-id`, `data-snapshot-version`, and the pending/revision
 * attributes come from that module; this one owns only the four values in the table this bead
 * was assigned.
 */
import type { ExecutionStateKind } from "../provenance/executionState.ts";
import type { ExperimentView } from "../store/instanceStore.ts";
import { type DataExecutionLabelValue, executionLabelFor } from "./executionLabelFor.ts";

export type ExecutionLabelAttributes = Readonly<{
  "data-execution-label": DataExecutionLabelValue;
}>;

/** The label attribute is a pure function of the derived state alone -- never of loader or
 * pending state -- so it changes only when an accepted snapshot changes the derived state. */
export function executionLabelAttributes(state: ExecutionStateKind): ExecutionLabelAttributes {
  return Object.freeze({ "data-execution-label": executionLabelFor(state).dataExecutionLabel });
}

export type ResultAttributes = Readonly<{
  "data-result-status"?: string;
  "data-refusal-code"?: string;
}>;

/**
 * `primaryOutputId` is matched against each accepted output's `quantityId`
 * (am-rt-typed-results-mqb's `ResultIdentity`). A refusal takes precedence: its registered
 * code becomes `data-refusal-code`, and no `data-result-status` is emitted, matching "a
 * refusal code in visible text is a leak; codes belong in data attributes and logs."
 */
export function resultAttributes(view: ExperimentView, primaryOutputId: string): ResultAttributes {
  if (view.refusal) {
    return Object.freeze({ "data-refusal-code": view.refusal.code });
  }
  const output = view.accepted?.outputs.find((o) => o.quantityId === primaryOutputId);
  if (!output) return Object.freeze({});
  return Object.freeze({ "data-result-status": output.status });
}
