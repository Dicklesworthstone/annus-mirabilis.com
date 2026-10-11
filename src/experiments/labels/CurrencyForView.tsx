/**
 * WHEN A CURRENCY INDICATOR APPEARS, IN ONE PLACE (am-m79c).
 *
 * Three laboratories refuse a reader's form and render no `ExecutionChrome`, so they had no element a
 * refusal could mark: bm-03, bm-07 and sr-03 each write their own execution label by hand and the
 * chrome's currency half never reached them. A reader of those three entered an inadmissible value,
 * was told why, and was not told that the readouts beside the message were from the previous
 * settings.
 *
 * am-m79c records the choice this answers: "whether these six adopt `ExecutionChrome` (which brings
 * the model note and its own layout with it) or whether a currency indicator can be mounted beside a
 * hand-written execution label". Measured in the code, the second works: `CurrencyIndicator` is a
 * single `<p>` whose only imports are `currencyState.ts` and `executionChrome.css`, with no layout
 * dependency on the chrome's wrapper. Adopting the whole chrome would add a model note and a
 * different heading layout to three pages, which IS a reader-facing change; mounting the currency
 * half beside the label they already render is not.
 *
 * SO THE DECISION LIVES HERE RATHER THAN IN FOUR CALLERS. `ExecutionChrome` used to hold the
 * condition inline, and copying that ternary into three labs would have put the same rule in four
 * places -- the shape that lets one of them drift. This is the one function that answers "is there
 * something to say about the currency of these numbers, and what".
 */
import type { ReactElement } from "react";
import type { RequestRefusal } from "../results/refusals.ts";
import type { ExperimentView } from "../store/instanceStore.ts";
import { CurrencyIndicator } from "./CurrencyIndicator.tsx";
import { deriveCurrencyState } from "./currencyState.ts";

export type CurrencyForViewProps = Readonly<{
  view: ExperimentView;
  /**
   * A refusal raised while VALIDATING the reader's form, before anything reached the worker.
   *
   * It is an override rather than a change to the store, because the store is right: no snapshot was
   * requested, so nothing in the instance was refused. What was refused was the form.
   */
  validationRefusal?: RequestRefusal | null | undefined;
}>;

/**
 * The currency indicator for a view, or nothing.
 *
 * Only news is shown: running, refused or stale. "These numbers match the current settings" is the
 * state a reader assumes, and as a boxed chip above every instrument it read as debug output
 * (dispatch 259); the accepted state stays on the instrument root as `data-currency-state`.
 */
export function CurrencyForView({
  view,
  validationRefusal,
}: CurrencyForViewProps): ReactElement | null {
  const currency = validationRefusal ? "refused" : deriveCurrencyState(view);
  if (currency === undefined || currency === "accepted") return null;
  return <CurrencyIndicator state={currency} refusal={validationRefusal ?? view.refusal} />;
}
