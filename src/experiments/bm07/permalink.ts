import { parseScaledDecimal } from "../../units/decimalScale.ts";
import { BM07_DEFAULTS, type Bm07Parameters } from "./definition.ts";
import { validateBm07Parameters } from "./parameters.ts";
export function encodeBm07Settings(p: Bm07Parameters): string {
  if (validateBm07Parameters(p).kind !== "accepted")
    throw new TypeError("Cannot share invalid inference settings.");
  // A shared link never schedules the repeated-experiment computation.
  const q = new URLSearchParams({ inference: "1" });
  for (const k of Object.keys(BM07_DEFAULTS) as (keyof Bm07Parameters)[])
    q.set(k, String(k === "coverageTrials" ? 0 : p[k]));
  return `?${q}`;
}
export function decodeBm07Settings(
  search: string,
):
  | { kind: "absent" }
  | { kind: "settings"; parameters: Bm07Parameters }
  | { kind: "invalid"; message: string } {
  if (!search || search === "?") return { kind: "absent" };
  const invalid = () => ({
    kind: "invalid" as const,
    message: "This inference link is incomplete or unsupported. The worked example is unchanged.",
  });
  if (search.length > 4096) return invalid();
  const q = new URLSearchParams(search),
    keys = Object.keys(BM07_DEFAULTS) as (keyof Bm07Parameters)[];
  if (
    q.get("inference") !== "1" ||
    q.size !== keys.length + 1 ||
    [...q.keys()].some((k) => k !== "inference" && !keys.includes(k as keyof Bm07Parameters))
  )
    return invalid();
  const p: Record<string, string | number | boolean> = {};
  try {
    for (const k of keys) {
      if (q.getAll(k).length !== 1) return invalid();
      const v = q.get(k)!;
      if (typeof BM07_DEFAULTS[k] === "number") p[k] = parseScaledDecimal(v, 0);
      else if (k === "radiusKnown") {
        if (!["true", "false"].includes(v)) return invalid();
        p[k] = v === "true";
      } else p[k] = v;
    }
  } catch {
    return invalid();
  }
  const r = validateBm07Parameters(p);
  return r.kind === "accepted" && r.data.coverageTrials === 0
    ? { kind: "settings", parameters: r.data }
    : invalid();
}
