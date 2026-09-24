import { parseScaledDecimal } from "../../units/decimalScale.ts";
import { carriesTapeLink } from "../permalink/codecCore.ts";
import { BM08_DEFAULTS, type Bm08Parameters } from "./definition.ts";
import { validateBm08Parameters } from "./parameters.ts";
export function encodeBm08Settings(p: Bm08Parameters): string {
  if (validateBm08Parameters(p).kind !== "accepted")
    throw new TypeError("Cannot share invalid camera settings.");
  // A shared link never schedules the repeated-experiment computation.
  const q = new URLSearchParams({ camera: "1" });
  for (const k of Object.keys(BM08_DEFAULTS) as (keyof Bm08Parameters)[])
    q.set(k, String(k === "coverageTrials" ? 0 : p[k]));
  return `?${q}`;
}
export function decodeBm08Settings(
  search: string,
):
  | { kind: "absent" }
  | { kind: "settings"; parameters: Bm08Parameters }
  | { kind: "invalid"; message: string } {
  // A ?tape= address is the draft tape's to read (draftTape.ts), not an invalid settings link.
  if (!search || search === "?" || carriesTapeLink(search)) return { kind: "absent" };
  const invalid = () => ({
    kind: "invalid" as const,
    message: "This camera link is incomplete or unsupported. The worked example is unchanged.",
  });
  if (search.length > 4096) return invalid();
  const q = new URLSearchParams(search),
    keys = Object.keys(BM08_DEFAULTS) as (keyof Bm08Parameters)[];
  if (
    q.get("camera") !== "1" ||
    q.size !== keys.length + 1 ||
    [...q.keys()].some((k) => k !== "camera" && !keys.includes(k as keyof Bm08Parameters))
  )
    return invalid();
  const p: Record<string, string | number | boolean> = {};
  try {
    for (const k of keys) {
      if (q.getAll(k).length !== 1) return invalid();
      const v = q.get(k)!;
      if (typeof BM08_DEFAULTS[k] === "number") p[k] = parseScaledDecimal(v, 0);
      else p[k] = v;
    }
  } catch {
    return invalid();
  }
  const r = validateBm08Parameters(p);
  return r.kind === "accepted" && r.data.coverageTrials === 0
    ? { kind: "settings", parameters: r.data }
    : invalid();
}
