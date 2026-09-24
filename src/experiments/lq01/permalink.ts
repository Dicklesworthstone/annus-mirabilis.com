import { parseScaledDecimal } from "../../units/decimalScale.ts";
import { carriesTapeLink } from "../permalink/codecCore.ts";
import { LQ01_DEFAULTS, type Lq01Parameters } from "./definition.ts";
import { validateLq01Parameters } from "./parameters.ts";

const keys = Object.keys(LQ01_DEFAULTS) as (keyof Lq01Parameters)[];

export function encodeLq01Settings(p: Lq01Parameters): string {
  if (validateLq01Parameters(p).kind !== "accepted") {
    throw new TypeError("Cannot share invalid wave description settings.");
  }
  const q = new URLSearchParams({ lq: "1" });
  for (const key of keys) {
    q.set(key, String(p[key]));
  }
  return `?${q.toString()}`;
}

export type Lq01SettingsLink = Readonly<
  | { kind: "absent" }
  | { kind: "settings"; parameters: Lq01Parameters }
  | { kind: "invalid"; message: string }
>;

/**
 * Links are untrusted input. Loading a link never schedules a calculation. A ?tape= address is the
 * draft tape's to read (draftTape.ts), so this older reader leaves it alone rather than calling it
 * an invalid settings link.
 */
export function decodeLq01Settings(search: string): Lq01SettingsLink {
  if (!search || search === "?" || carriesTapeLink(search)) return { kind: "absent" };
  const invalid = (): Lq01SettingsLink => ({
    kind: "invalid",
    message:
      "This wave description link is incomplete or unsupported. The worked example has not been changed.",
  });
  if (search.length > 4096) return invalid();
  const q = new URLSearchParams(search);
  if (
    q.get("lq") !== "1" ||
    q.size !== keys.length + 1 ||
    [...q.keys()].some((k) => k !== "lq" && !keys.includes(k as keyof Lq01Parameters))
  ) {
    return invalid();
  }
  const p: Record<string, unknown> = {};
  try {
    for (const key of keys) {
      if (q.getAll(key).length !== 1) return invalid();
      const v = q.get(key);
      if (v === null) return invalid();
      if (key === "readout" || key === "mode" || key === "screenPosition") {
        p[key] = v;
      } else {
        p[key] = parseScaledDecimal(v, 0);
      }
    }
  } catch {
    return invalid();
  }
  const checked = validateLq01Parameters(p);
  return checked.kind === "accepted" ? { kind: "settings", parameters: checked.data } : invalid();
}
