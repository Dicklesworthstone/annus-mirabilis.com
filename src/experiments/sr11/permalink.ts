import { SR11_DEFAULTS, type Sr11Parameters } from "./definition.ts";
import { validateSr11Parameters } from "./parameters.ts";

export function encodeSr11Settings(p: Sr11Parameters): string {
  const q = new URLSearchParams();
  q.set("b", String(p.beta));
  q.set("phi", String(p.incidentAngleDeg));
  q.set("u", String(p.incidentEnergyDensity));
  q.set("am", String(p.mirrorArea));
  q.set("frame", p.frame);
  q.set("units", p.unitLayer);
  return `?${q}`;
}

export function decodeSr11Settings(
  search: string,
):
  | { kind: "none" }
  | { kind: "settings"; parameters: Sr11Parameters }
  | { kind: "invalid"; message: string } {
  if (!search || search === "?") return { kind: "none" };
  const q = new URLSearchParams(search);
  const trackedKeys = ["b", "phi", "u", "am", "frame", "units"];
  if (![...q.keys()].some((k) => trackedKeys.includes(k))) return { kind: "none" };

  const betaVal = q.has("b") ? Number(q.get("b")) : SR11_DEFAULTS.beta;
  const phiVal = q.has("phi") ? Number(q.get("phi")) : SR11_DEFAULTS.incidentAngleDeg;
  const uVal = q.has("u") ? Number(q.get("u")) : SR11_DEFAULTS.incidentEnergyDensity;
  const amVal = q.has("am") ? Number(q.get("am")) : SR11_DEFAULTS.mirrorArea;
  const frameVal = q.get("frame") === "mirror" ? "mirror" : "lab";
  const unitsVal = q.get("units") === "gaussian" ? "gaussian" : "si";

  const candidate: Sr11Parameters = {
    beta: betaVal,
    incidentAngleDeg: phiVal,
    incidentEnergyDensity: uVal,
    mirrorArea: amVal,
    frame: frameVal,
    unitLayer: unitsVal,
  };

  const checked = validateSr11Parameters(candidate);
  if (checked.kind !== "accepted") {
    return { kind: "invalid", message: "The link settings are outside the model domain." };
  }
  return { kind: "settings", parameters: checked.data };
}
