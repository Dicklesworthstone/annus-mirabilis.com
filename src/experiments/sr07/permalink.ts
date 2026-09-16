import { SR07_DEFAULTS, type Sr07Parameters } from "./definition.ts";
import { validateSr07Parameters } from "./parameters.ts";

export function encodeSr07Settings(p: Sr07Parameters): string {
  const q = new URLSearchParams();
  q.set("eq", p.equationId);
  q.set("step", String(p.stepIndex));
  q.set("units", p.unitLayer);
  q.set("v", String(p.boostBeta));
  q.set("wave", p.wave);
  q.set("pol", p.polarization);
  return `?${q}`;
}

export function decodeSr07Settings(
  search: string,
):
  | { kind: "none" }
  | { kind: "settings"; parameters: Sr07Parameters }
  | { kind: "invalid"; message: string } {
  if (!search || search === "?") return { kind: "none" };
  const q = new URLSearchParams(search);
  if (![...q.keys()].some((k) => ["eq", "step", "v", "wave", "pol"].includes(k)))
    return { kind: "none" };
  const equationId = q.get("eq") ?? SR07_DEFAULTS.equationId;
  const unitLayer = q.get("units") ?? SR07_DEFAULTS.unitLayer;
  const wave = q.get("wave") ?? SR07_DEFAULTS.wave;
  const polarization = q.get("pol") ?? SR07_DEFAULTS.polarization;
  const candidate = {
    ...SR07_DEFAULTS,
    equationId: equationId as Sr07Parameters["equationId"],
    stepIndex: q.has("step") ? Number(q.get("step")) : SR07_DEFAULTS.stepIndex,
    unitLayer: unitLayer as Sr07Parameters["unitLayer"],
    boostBeta: q.has("v") ? Number(q.get("v")) : SR07_DEFAULTS.boostBeta,
    wave: wave as Sr07Parameters["wave"],
    polarization: polarization as Sr07Parameters["polarization"],
  };
  const checked = validateSr07Parameters(candidate);
  if (checked.kind !== "accepted")
    return { kind: "invalid", message: "The link settings are outside the model domain." };
  return { kind: "settings", parameters: checked.data };
}
