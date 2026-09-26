/**
 * Instrument chrome for the execution label, currency indicator, and model
 * note (am-inst-execution-labels-5ywv). Labs spread the matching data
 * attributes on the instrument root; this cluster sits in the heading.
 */
import type { ReactElement } from "react";
import type { ExecutionStateKind } from "../provenance/executionState.ts";
import type { ExperimentView } from "../store/instanceStore.ts";
import { CurrencyIndicator } from "./CurrencyIndicator.tsx";
import { deriveCurrencyState } from "./currencyState.ts";
import { ExecutionLabel } from "./ExecutionLabel.tsx";
import { ModelNote } from "./ModelNote.tsx";
import type { ModelNoteData } from "./modelNoteData.ts";
import "./executionChrome.css";

export type ExecutionChromeProps = Readonly<{
  state: ExecutionStateKind;
  view: ExperimentView;
  modelNote?: ModelNoteData | undefined;
}>;

export function ExecutionChrome({ state, view, modelNote }: ExecutionChromeProps): ReactElement {
  const currency = deriveCurrencyState(view);
  // Only news is shown: running, refused or stale (dispatch 259). "These numbers match the current
  // settings" is the state a reader assumes, and as a boxed chip above every instrument it read as
  // debug output. The accepted state stays on the instrument root as data-currency-state.
  return (
    <div className="execution-chrome">
      <ExecutionLabel state={state} />
      {currency !== undefined && currency !== "accepted" ? (
        <CurrencyIndicator state={currency} refusal={view.refusal} />
      ) : null}
      {modelNote !== undefined ? <ModelNote data={modelNote} /> : null}
    </div>
  );
}
