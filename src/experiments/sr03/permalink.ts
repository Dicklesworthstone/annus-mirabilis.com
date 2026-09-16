import { parseScaledDecimal } from "../../units/decimalScale.ts";
import { type Sr03Parameters } from "./definition.ts";
import { validateSr03Parameters } from "./parameters.ts";

const requiredKeys = ["rodRestFrame", "v", "L0", "measuringFrame", "endpointPairId", "R"] as const;

export type Sr03SettingsLink = Readonly<
  | { kind: "absent" }
  | { kind: "settings"; parameters: Sr03Parameters }
  | { kind: "invalid"; message: string }
>;

export function encodeSr03Settings(p: Sr03Parameters): string {
  if (validateSr03Parameters(p).kind !== "accepted") {
    throw new TypeError("Cannot share invalid rod simultaneity settings.");
  }
  const q = new URLSearchParams({ sr: "3" });
  for (const key of requiredKeys) {
    q.set(key, String(p[key]));
  }
  if (p.customT1 !== undefined) q.set("customT1", String(p.customT1));
  if (p.customX1 !== undefined) q.set("customX1", String(p.customX1));
  if (p.customT2 !== undefined) q.set("customT2", String(p.customT2));
  if (p.customX2 !== undefined) q.set("customX2", String(p.customX2));
  return `?${q.toString()}`;
}

export function decodeSr03Settings(search: string): Sr03SettingsLink {
  if (!search || search === "?") return { kind: "absent" };
  const invalid = (): Sr03SettingsLink => ({
    kind: "invalid",
    message:
      "This rod simultaneity link is incomplete or unsupported. The worked example has not been changed.",
  });
  if (search.length > 4096) return invalid();
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (q.get("sr") !== "3") return invalid();

  const allAllowed = ["sr", ...requiredKeys, "customT1", "customX1", "customT2", "customX2"];
  if ([...q.keys()].some((k) => !allAllowed.includes(k))) {
    return invalid();
  }
  for (const k of requiredKeys) {
    if (!q.has(k)) return invalid();
  }

  const raw: Record<string, unknown> = {};
  raw.rodRestFrame = q.get("rodRestFrame");
  raw.measuringFrame = q.get("measuringFrame");
  raw.endpointPairId = q.get("endpointPairId");

  try {
    raw.v = parseScaledDecimal(q.get("v")!, 0);
    raw.L0 = parseScaledDecimal(q.get("L0")!, 0);
    raw.R = parseScaledDecimal(q.get("R")!, 0);
    if (q.has("customT1")) raw.customT1 = parseScaledDecimal(q.get("customT1")!, 0);
    if (q.has("customX1")) raw.customX1 = parseScaledDecimal(q.get("customX1")!, 0);
    if (q.has("customT2")) raw.customT2 = parseScaledDecimal(q.get("customT2")!, 0);
    if (q.has("customX2")) raw.customX2 = parseScaledDecimal(q.get("customX2")!, 0);
  } catch {
    return invalid();
  }

  const checked = validateSr03Parameters(raw);
  return checked.kind === "accepted" ? { kind: "settings", parameters: checked.data } : invalid();
}
