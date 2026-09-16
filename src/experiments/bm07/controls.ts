import { BM07_DEFAULTS, type Bm07Parameters } from "./definition.ts";
import { validateBm07Parameters } from "./parameters.ts";
import { formatScaledDecimal, parseScaledDecimal } from "../../units/decimalScale.ts";
export type InferenceDraft = Record<keyof Bm07Parameters, string>;
const powers: Partial<Record<keyof Bm07Parameters, number>> = { generatorEta: 3, eta: 3, generatorRadius: 6, a: 6, coverage: 2, inputCoverage: 2, temperatureError: 2, viscosityError: 2, radiusError: 2 };
export function toInferenceDraft(p: Bm07Parameters): InferenceDraft {
  return Object.fromEntries((Object.keys(BM07_DEFAULTS) as (keyof Bm07Parameters)[]).map(k => [k, typeof p[k] === "number" ? formatScaledDecimal(p[k] as number, powers[k] ?? 0) : String(p[k])])) as InferenceDraft;
}
export function fromInferenceDraft(draft: InferenceDraft): Bm07Parameters {
  const p: Record<string, number | string | boolean> = {};
  for (const k of Object.keys(BM07_DEFAULTS) as (keyof Bm07Parameters)[]) {
    if (typeof BM07_DEFAULTS[k] === "number") p[k] = parseScaledDecimal(draft[k], powers[k] ?? 0);
    else if (k === "radiusKnown") { if (!["true", "false"].includes(draft[k])) throw new TypeError("Declare whether an independent radius is known."); p[k] = draft[k] === "true"; }
    else p[k] = draft[k];
  }
  const r = validateBm07Parameters(p);
  if (r.kind !== "accepted") throw new TypeError(r.kind === "refused" ? String(r.refusal.details?.requirements ?? r.refusal.message) : r.outcome.message);
  return r.data;
}
