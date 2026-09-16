/**
 * Currency of the numbers on screen (am-inst-execution-labels-5ywv): whether the
 * displayed accepted snapshot still matches the requested inputs. This is a
 * different axis from the four public execution labels (which engine produced
 * the last accepted snapshot). The engine label does not change while a request
 * is in flight; this indicator does.
 *
 * The four states are mutually exclusive and each is reachable from the real
 * instance store:
 * - accepted: last request published a matching snapshot
 * - running: a request is pending (`data-pending="true"`)
 * - refused: the last request was refused; the previous snapshot remains
 * - stale: requested input revision differs from the accepted one, the request
 *   is no longer in flight, and there is no refusal (reachable by pausing an
 *   outstanding setup-change)
 */
import type { ExperimentView } from "../store/instanceStore.ts";

export const CURRENCY_STATES = ["accepted", "running", "refused", "stale"] as const;
export type CurrencyState = (typeof CURRENCY_STATES)[number];

export type CurrencyCopy = Readonly<{
  heading: string;
  text: string;
}>;

/**
 * Ordinary-language copy for each currency state. Color is never the only
 * distinction: each state also has a unique heading, a unique sentence, and a
 * unique `data-currency-state` value.
 */
export function currencyCopyFor(state: CurrencyState): CurrencyCopy {
  switch (state) {
    case "accepted":
      return Object.freeze({
        heading: "Current",
        text: "These numbers match the current settings.",
      });
    case "running":
      return Object.freeze({
        heading: "Running",
        text: "A new calculation is in progress. The numbers shown belong to the previous accepted inputs.",
      });
    case "refused":
      return Object.freeze({
        heading: "Refused",
        text: "The last request was refused. The numbers shown belong to the last accepted inputs.",
      });
    case "stale":
      return Object.freeze({
        heading: "Not current",
        text: "These numbers belong to earlier accepted inputs, not the settings now shown.",
      });
    default: {
      const exhaustive: never = state;
      throw new Error(`Unhandled currency state: ${String(exhaustive)}`);
    }
  }
}

/**
 * Derives the currency of the displayed numbers from the store view. Returns
 * `undefined` when no accepted snapshot exists yet (there are no numbers to
 * describe as current or not).
 */
export function deriveCurrencyState(view: ExperimentView): CurrencyState | undefined {
  if (!view.accepted) return undefined;
  if (view.refusal !== null || view.status === "refused") return "refused";
  if (view.pending) return "running";
  const requestedInput = view.requested?.revisions.input;
  if (requestedInput !== undefined && requestedInput !== view.accepted.revisions.input) {
    return "stale";
  }
  return "accepted";
}

export type CurrencyAttributes = Readonly<{
  "data-currency-state": CurrencyState;
}>;

export function currencyAttributes(state: CurrencyState): CurrencyAttributes {
  return Object.freeze({ "data-currency-state": state });
}
