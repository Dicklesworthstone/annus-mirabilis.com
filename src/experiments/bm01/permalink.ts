import { parseScaledDecimal } from "../../units/decimalScale.ts";
import { carriesTapeLink } from "../permalink/codecCore.ts";
import { BM01_DEFAULTS, type Bm01Parameters } from "./definition.ts";
import { validateBm01Parameters } from "./parameters.ts";
export function encodeBm01Settings(p: Bm01Parameters): string {
  const checked = validateBm01Parameters(p);
  if (checked.kind !== "accepted") throw new TypeError("Cannot share invalid tracer settings.");
  const q = new URLSearchParams({ tracers: "1" });
  for (const k of Object.keys(BM01_DEFAULTS) as (keyof Bm01Parameters)[])
    q.set(k, String(checked.data[k]));
  return `?${q}`;
}
export function decodeBm01Settings(
  search: string,
):
  | { kind: "absent" }
  | { kind: "settings"; parameters: Bm01Parameters }
  | { kind: "invalid"; message: string } {
  // A ?tape= address is the draft tape's to read (draftTape.ts), not an invalid settings link.
  if (!search || search === "?" || carriesTapeLink(search)) return { kind: "absent" };
  const invalid = () => ({
    kind: "invalid" as const,
    message: "This tracer link is incomplete or unsupported. The worked example is unchanged.",
  });
  if (search.length > 4096) return invalid();
  const q = new URLSearchParams(search),
    keys = Object.keys(BM01_DEFAULTS);
  if (!q.has("tracers")) return { kind: "absent" };
  const legacy = !q.has("constantSetId");
  if (
    q.get("tracers") !== "1" ||
    q.size !== keys.length + 1 - (legacy ? 1 : 0) ||
    [...q.keys()].some((k) => k !== "tracers" && !keys.includes(k))
  )
    return invalid();
  const p: Record<string, string | number> = {};
  try {
    for (const k of keys) {
      if (legacy && k === "constantSetId") {
        p[k] = BM01_DEFAULTS.constantSetId;
        continue;
      }
      if (q.getAll(k).length !== 1) return invalid();
      const v = q.get(k);
      if (v === null) return invalid();
      p[k] = ["seed", "statistic", "constantSetId"].includes(k) ? v : parseScaledDecimal(v, 0);
    }
  } catch {
    return invalid();
  }
  const result = validateBm01Parameters(p);
  return result.kind === "accepted" ? { kind: "settings", parameters: result.data } : invalid();
}
