/**
 * Reader-facing currency of the displayed numbers (am-inst-execution-labels-5ywv).
 * Stale, running, refused, and accepted are distinguished by heading, sentence,
 * `data-currency-state`, and border style. Color is never the only cue.
 *
 * A refusal's registered code stays on `data-refusal-code`; visible text is the
 * registry sentence, never the code.
 */
import type { ReactElement } from "react";
import type { RequestRefusal } from "../results/refusals.ts";
import { type CurrencyState, currencyCopyFor } from "./currencyState.ts";
import "./executionChrome.css";

export type CurrencyIndicatorProps = Readonly<{
  state: CurrencyState;
  refusal?: RequestRefusal | null;
}>;

export function CurrencyIndicator({ state, refusal }: CurrencyIndicatorProps): ReactElement {
  const copy = currencyCopyFor(state);
  const refusalMessage =
    state === "refused" && refusal !== null && refusal !== undefined ? refusal.message : undefined;
  return (
    <p
      className="execution-currency"
      data-currency-state={state}
      data-refusal-code={refusalMessage !== undefined && refusal ? refusal.code : undefined}
      role={state === "accepted" ? undefined : "status"}
      aria-busy={state === "running" ? true : undefined}
    >
      <strong className="execution-currency-heading">{copy.heading}</strong>
      <span className="execution-currency-text">{copy.text}</span>
      {refusalMessage !== undefined ? (
        <span className="execution-currency-refusal">{refusalMessage}</span>
      ) : null}
    </p>
  );
}
