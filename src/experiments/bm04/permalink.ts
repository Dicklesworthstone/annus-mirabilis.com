import { parseScaledDecimal } from "../../units/decimalScale.ts";
import { carriesTapeLink } from "../permalink/codecCore.ts";
import { BM04_DEFAULTS, type Bm04Parameters } from "./definition.ts";
import { validateBm04Parameters } from "./parameters.ts";

const keys = Object.keys(BM04_DEFAULTS) as (keyof Bm04Parameters)[];

export function encodeBm04Settings(p: Bm04Parameters): string {
  if (validateBm04Parameters(p).kind !== "accepted") {
    throw new TypeError("Cannot share invalid drift-diffusion balance settings.");
  }
  const q = new URLSearchParams({ bm: "4" });
  for (const key of keys) {
    q.set(key, String(p[key]));
  }
  return `?${q.toString()}`;
}

export type Bm04SettingsLink = Readonly<
  | { kind: "absent" }
  | { kind: "settings"; parameters: Bm04Parameters }
  | { kind: "invalid"; message: string }
>;

/** Links are untrusted input. Loading a link never schedules a calculation. */
export function decodeBm04Settings(search: string): Bm04SettingsLink {
  // A ?tape= address is the draft tape's to read (draftTape.ts), not an invalid settings link.
  if (!search || search === "?" || carriesTapeLink(search)) return { kind: "absent" };
  const invalid = (): Bm04SettingsLink => ({
    kind: "invalid",
    message:
      "This drift-diffusion link is incomplete or unsupported. The worked example has not been changed.",
  });
  if (search.length > 4096) return invalid();
  const q = new URLSearchParams(search);
  if (
    q.get("bm") !== "4" ||
    q.size !== keys.length + 1 ||
    [...q.keys()].some((k) => k !== "bm" && !keys.includes(k as keyof Bm04Parameters))
  ) {
    return invalid();
  }
  const p: Record<string, unknown> = {};
  try {
    for (const key of keys) {
      if (q.getAll(key).length !== 1) return invalid();
      const v = q.get(key);
      if (v === null) return invalid();
      if (key === "profile") {
        p[key] = v;
      } else {
        p[key] = parseScaledDecimal(v, 0);
      }
    }
  } catch {
    return invalid();
  }
  const checked = validateBm04Parameters(p);
  return checked.kind === "accepted" ? { kind: "settings", parameters: checked.data } : invalid();
}
