/**
 * Instrument chrome for the execution label, currency indicator, and model
 * note (am-inst-execution-labels-5ywv). Labs spread the matching data
 * attributes on the instrument root; this cluster sits in the heading.
 */
import type { ReactElement } from "react";
import type { ExecutionStateKind } from "../provenance/executionState.ts";
import type { RequestRefusal } from "../results/refusals.ts";
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
  /**
   * A refusal raised while VALIDATING the request, before anything reached the worker (am-ig23).
   *
   * `deriveCurrencyState` reads `view.refusal`, which is the store's, so a request refused by a
   * parameter schema never marks the accepted readouts stale: the reader is shown numbers from the
   * last accepted settings with no sign that the ones they just entered were rejected. Measured on
   * bm-08 after entering an exposure of 0.3 s - no element in the lab carried
   * `data-currency-state`, and none carried `data-refusal-code` either.
   *
   * It is an override rather than a change to the store, because the store is right: no snapshot was
   * requested of the worker, so nothing in the instance was refused. What was refused was the
   * reader's form.
   */
  validationRefusal?: RequestRefusal | null | undefined;
}>;

export function ExecutionChrome({
  state,
  view,
  modelNote,
  validationRefusal,
}: ExecutionChromeProps): ReactElement {
  const currency = validationRefusal ? "refused" : deriveCurrencyState(view);
  // Only news is shown: running, refused or stale (dispatch 259). "These numbers match the current
  // settings" is the state a reader assumes, and as a boxed chip above every instrument it read as
  // debug output. The accepted state stays on the instrument root as data-currency-state.
  return (
    <div className="execution-chrome">
      <ExecutionLabel state={state} />
      {currency !== undefined && currency !== "accepted" ? (
        <CurrencyIndicator state={currency} refusal={validationRefusal ?? view.refusal} />
      ) : null}
      {modelNote !== undefined ? <ModelNote data={modelNote} /> : null}
    </div>
  );
}
