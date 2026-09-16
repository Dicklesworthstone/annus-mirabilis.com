import { formatScaledDecimal, parseScaledDecimal } from "../../units/decimalScale.ts";
import { BM08_DEFAULTS, type Bm08Parameters } from "./definition.ts";
import { validateBm08Parameters } from "./parameters.ts";
export type CameraDraft = Record<keyof Bm08Parameters, string>;
const powers: Partial<Record<keyof Bm08Parameters, number>> = {
  D: 12,
  sigma: 6,
  flowDrift: 6,
  stageDrift: 6,
  coverage: 2,
};
export function toCameraDraft(p: Bm08Parameters): CameraDraft {
  return Object.fromEntries(
    (Object.keys(BM08_DEFAULTS) as (keyof Bm08Parameters)[]).map((k) => [
      k,
      typeof p[k] === "number" ? formatScaledDecimal(p[k] as number, powers[k] ?? 0) : String(p[k]),
    ]),
  ) as CameraDraft;
}
export function fromCameraDraft(draft: CameraDraft): Bm08Parameters {
  const p: Record<string, number | string | boolean> = {};
  for (const k of Object.keys(BM08_DEFAULTS) as (keyof Bm08Parameters)[]) {
    if (typeof BM08_DEFAULTS[k] === "number") p[k] = parseScaledDecimal(draft[k], powers[k] ?? 0);
    else p[k] = draft[k];
  }
  const r = validateBm08Parameters(p);
  if (r.kind !== "accepted")
    throw new TypeError(
      r.kind === "refused"
        ? String(r.refusal.details?.requirements ?? r.refusal.message)
        : r.outcome.message,
    );
  return r.data;
}
