import { parseScaledDecimal } from "../../units/decimalScale.ts";
import { BM03_DEFAULTS, type Bm03Parameters } from "./definition.ts";
import { validateBm03Parameters } from "./parameters.ts";

export function encodeBm03Settings(p: Bm03Parameters): string {
  if (validateBm03Parameters(p).kind !== "accepted") {
    throw new TypeError("Cannot share invalid configuration integral settings.");
  }
  const q = new URLSearchParams({ config: "1" });
  for (const k of Object.keys(BM03_DEFAULTS) as (keyof Bm03Parameters)[]) {
    q.set(k, String(p[k]));
  }
  return `?${q}`;
}

export function decodeBm03Settings(
  search: string,
):
  | { kind: "absent" }
  | { kind: "settings"; parameters: Bm03Parameters }
  | { kind: "invalid"; message: string } {
  if (!search || search === "?") return { kind: "absent" };
  const invalid = () => ({
    kind: "invalid" as const,
    message:
      "This configuration integral link is incomplete or unsupported. The worked example is unchanged.",
  });
  if (search.length > 4096) return invalid();
  const q = new URLSearchParams(search);
  const keys = Object.keys(BM03_DEFAULTS) as (keyof Bm03Parameters)[];
  if (
    q.get("config") !== "1" ||
    q.size !== keys.length + 1 ||
    [...q.keys()].some((k) => k !== "config" && !keys.includes(k as keyof Bm03Parameters))
  ) {
    return invalid();
  }
  const p: Record<string, string | number> = {};
  try {
    for (const k of keys) {
      if (q.getAll(k).length !== 1) return invalid();
      const v = q.get(k);
      if (v === null) return invalid();
      if (k === "model" || k === "step" || k === "notation") {
        p[k] = v;
      } else {
        p[k] = parseScaledDecimal(v, 0);
      }
    }
  } catch {
    return invalid();
  }
  const result = validateBm03Parameters(p);
  return result.kind === "accepted" ? { kind: "settings", parameters: result.data } : invalid();
}
