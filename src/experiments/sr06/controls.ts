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
  if (r.kind !== "accepted")
    throw new TypeError(
      r.kind === "refused"
        ? String(r.refusal.details?.requirements ?? r.refusal.message)
        : "Invalid settings.",
    );
  return r.data;
}
