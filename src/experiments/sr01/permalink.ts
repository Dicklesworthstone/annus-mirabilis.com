import { carriesTapeLink } from "../permalink/codecCore.ts";
import { SR01_DEFAULTS, type Sr01Parameters } from "./definition.ts";
import { validateSr01Parameters } from "./parameters.ts";

export type Sr01PermalinkResult =
  | { kind: "none" }
  | { kind: "settings"; parameters: Sr01Parameters }
  | { kind: "invalid"; message: string };

const KEYS: readonly { key: keyof Sr01Parameters; param: string }[] = [
  { key: "stationSeparationLs", param: "ab" },
  { key: "emissionTimeA", param: "ta" },
  { key: "clockOffsetB", param: "offb" },
  { key: "rodBeta", param: "rodv" },
  { key: "pairBeta", param: "pairv" },
  { key: "pairSeparationLs", param: "pairl" },
  { key: "frameBeta", param: "frame" },
];

export function decodeSr01Settings(search: string): Sr01PermalinkResult {
  if (!search || search === "?" || carriesTapeLink(search)) return { kind: "none" };
  const invalid = (): Sr01PermalinkResult => ({
    kind: "invalid",
    message:
      "The link settings are incomplete, ambiguous, or outside the model domain. The prepared example is unchanged.",
  });
  if (search.length > 4096) return invalid();
  const params = new URLSearchParams(search);
  if (!KEYS.some(({ param }) => params.has(param))) return { kind: "none" };

  const candidate: Sr01Parameters = { ...SR01_DEFAULTS };
  const mutable = candidate as unknown as Record<string, number>;
  for (const { key, param } of KEYS) {
    const raw = params.get(param);
    if (raw !== null) {
      if (
        params.getAll(param).length !== 1 ||
        !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())
      )
        return invalid();
      mutable[key] = Number(raw);
    }
  }

  const validation = validateSr01Parameters(candidate);
  if (validation.kind === "refused") {
    return {
      kind: "invalid",
      message: "The link settings are outside the model domain and could not be loaded.",
    };
  }
  return { kind: "settings", parameters: validation.data };
}

export function encodeSr01Settings(p: Sr01Parameters): string {
  const params = new URLSearchParams();
  for (const { key, param } of KEYS) {
    if (p[key] !== SR01_DEFAULTS[key]) params.set(param, String(p[key]));
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}
