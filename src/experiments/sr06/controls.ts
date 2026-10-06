import { ParameterRefusalError } from "../results/applyFailure.ts";
import { SR06_DEFAULTS, type Sr06Parameters } from "./definition.ts";
import { validateSr06Parameters } from "./parameters.ts";

export type Sr06Draft = Record<keyof Sr06Parameters, string>;

export function toSr06Draft(p: Sr06Parameters): Sr06Draft {
  return Object.fromEntries(
    (Object.keys(SR06_DEFAULTS) as (keyof Sr06Parameters)[]).map((k) => [k, String(p[k])]),
  ) as Sr06Draft;
}

export function fromSr06Draft(draft: Sr06Draft): Sr06Parameters {
  const p: Record<string, number | string | boolean> = {};
  for (const k of Object.keys(SR06_DEFAULTS) as (keyof Sr06Parameters)[]) {
    // A cleared field is not a number: Number("") would read it as 0 and apply it without a word
    // (dispatch 165), so it goes to the validator as NaN and is refused by name.
    if (typeof SR06_DEFAULTS[k] === "number")
      p[k] = draft[k].trim() === "" ? Number.NaN : Number(draft[k]);
    else if (k === "showRapidity") p[k] = draft[k] === "true";
    else p[k] = draft[k];
  }
  const r = validateSr06Parameters(p);
  // THE REFUSAL TRAVELS WITH THE THROW (am-ig23). This flattened a typed refusal to its sentence one layer
  // below any component that could show it, so the code, the ranked repairs and the staleness marking were
  // destroyed here and the catch upstream could not tell a refusal from an ordinary programming error.
  //
  // AND THE OTHER BRANCH WAS DEAD CODE, which only showed when the types were asked. The old expression ended
  // `: "Invalid settings."`, reading as the message for an execution outcome; Sr06ParameterCheck has no
  // outcome variant at all - it is `accepted | refused` - so that literal could never reach a reader. I first
  // wrote this conversion assuming the outcome existed and kept its message, and tsc said the value was
  // `never`.
  if (r.kind !== "accepted") throw new ParameterRefusalError(r.refusal);
  return r.data;
}
