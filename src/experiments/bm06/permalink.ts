import { BM06_DEFAULTS, type Bm06Parameters } from "./definition.ts";
import { validateBm06Parameters } from "./parameters.ts";

const keys = Object.keys(BM06_DEFAULTS) as (keyof Bm06Parameters)[];
const decimal = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const stringKeys = new Set([
  "gridProfile",
  "copiedDiffusivityInstanceId",
  "copiedDiffusivityRunId",
]);
export function encodeBm06Settings(input: Bm06Parameters): string {
  if (validateBm06Parameters(input).kind !== "accepted")
    throw new TypeError("Cannot share invalid settings.");
  const query = new URLSearchParams({ bm: "2" });
  for (const key of keys)
    query.set(key, typeof input[key] === "boolean" ? (input[key] ? "1" : "0") : String(input[key]));
  return `?${query.toString()}`;
}
export type SettingsLink = Readonly<
  | { kind: "absent" }
  | { kind: "settings"; parameters: Bm06Parameters }
  | { kind: "invalid"; message: string }
>;
/** Links are untrusted input. Loading a link never schedules a calculation. */
export function decodeBm06Settings(search: string): SettingsLink {
  if (!search || search === "?") return { kind: "absent" };
  const invalid = (): SettingsLink => ({
    kind: "invalid",
    message:
      "This settings link is incomplete or unsupported. The worked example has not been changed.",
  });
  if (search.length > 2048) return invalid();
  const query = new URLSearchParams(search);
  // Version 1 could only request a central spike. Preserve that experiment for old links.
  // Version 2 must explicitly name its profile, and malformed links never choose one silently.
  const legacy = query.get("bm") === "1";
  const linkKeys = legacy ? keys.filter((key) => key !== "gridProfile") : keys;
  if (
    (!legacy && query.get("bm") !== "2") ||
    query.getAll("bm").length !== 1 ||
    query.size !== linkKeys.length + 1 ||
    [...query.keys()].some((k) => k !== "bm" && !linkKeys.includes(k as keyof Bm06Parameters))
  )
    return invalid();
  const input: Record<string, number | boolean | string> = legacy ? { gridProfile: "spike" } : {};
  for (const key of linkKeys) {
    if (query.getAll(key).length !== 1) return invalid();
    const value = query.get(key)!;
    if (key === "gridEnabled") {
      if (value !== "1" && value !== "0") return invalid();
      input[key] = value === "1";
    } else if (stringKeys.has(key)) {
      input[key] = value;
    } else {
      if (!decimal.test(value)) return invalid();
      input[key] = Number(value);
    }
  }
  const checked = validateBm06Parameters(input);
  return checked.kind === "accepted" ? { kind: "settings", parameters: checked.data } : invalid();
}
