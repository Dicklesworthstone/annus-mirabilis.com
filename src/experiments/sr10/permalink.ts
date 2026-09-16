import { SR10_DEFAULTS, type Sr10Parameters } from "./definition.ts";
import { validateSr10Parameters } from "./parameters.ts";

export function encodeSr10Settings(p: Sr10Parameters): string {
  const q = new URLSearchParams();
  q.set("v", String(p.beta));
  q.set("phi", String(p.propagationAngleDeg));
  if (p.initialEnergyJ !== 1.0) q.set("E", String(p.initialEnergyJ));
  if (p.initialVolumeM3 !== 1.0) q.set("V", String(p.initialVolumeM3));
  if (p.initialAmplitude !== 1.0) q.set("A", String(p.initialAmplitude));
  if (!p.showCountermodel) q.set("countermodel", "0");
  return `?${q}`;
}

export function decodeSr10Settings(
  search: string,
):
  | { kind: "none" }
  | { kind: "settings"; parameters: Sr10Parameters }
  | { kind: "invalid"; message: string } {
  if (!search || search === "?") return { kind: "none" };
  const q = new URLSearchParams(search);
  const trackedKeys = ["v", "phi", "E", "V", "A", "countermodel"];
  if (![...q.keys()].some((k) => trackedKeys.includes(k))) return { kind: "none" };

  const candidate: Sr10Parameters = {
    ...SR10_DEFAULTS,
    beta: q.has("v") ? Number(q.get("v")) : SR10_DEFAULTS.beta,
    propagationAngleDeg: q.has("phi")
      ? Number(q.get("phi"))
      : SR10_DEFAULTS.propagationAngleDeg,
    initialEnergyJ: q.has("E") ? Number(q.get("E")) : SR10_DEFAULTS.initialEnergyJ,
    initialVolumeM3: q.has("V") ? Number(q.get("V")) : SR10_DEFAULTS.initialVolumeM3,
    initialAmplitude: q.has("A") ? Number(q.get("A")) : SR10_DEFAULTS.initialAmplitude,
    showCountermodel: q.has("countermodel") ? q.get("countermodel") !== "0" : SR10_DEFAULTS.showCountermodel,
  };

  const checked = validateSr10Parameters(candidate);
  if (checked.kind !== "accepted") {
    return { kind: "invalid", message: "Failed to validate SR-10 permalink parameters" };
  }
  return { kind: "settings", parameters: checked.data };
}
