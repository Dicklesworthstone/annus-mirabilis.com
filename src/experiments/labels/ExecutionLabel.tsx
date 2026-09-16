/**
 * Public execution label (am-inst-execution-labels-5ywv). Props are exactly
 * the derived state: a loader or artifact-loaded flag has no field to travel
 * through. The four wordings and `data-execution-label` values come from
 * `executionLabelFor`.
 */
import type { ReactElement } from "react";
import type { ExecutionStateKind } from "../provenance/executionState.ts";
import { executionLabelFor } from "./executionLabelFor.ts";
import "./executionChrome.css";

export type ExecutionLabelProps = Readonly<{
  state: ExecutionStateKind;
}>;

export function ExecutionLabel({ state }: ExecutionLabelProps): ReactElement {
  const info = executionLabelFor(state);
  return (
    <p
      className="execution-label badge"
      data-execution-label={info.dataExecutionLabel}
      data-execution-state={state}
    >
      {info.text}
    </p>
  );
}
