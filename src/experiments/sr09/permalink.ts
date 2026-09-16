import { SR09_DEFAULTS, type Sr09Parameters } from "./definition.ts";
import { validateSr09Parameters } from "./parameters.ts";

export function encodeSr09Settings(p: Sr09Parameters): string {
  const q = new URLSearchParams();
  q.set("v", String(p.beta));
  q.set("theta", String(p.propagationAngleDeg));
  q.set("nu", String(p.frequencyTHz));
  q.set("det_motion", p.detectorMotion);
  if (p.detectorSpeed !== 0) q.set("det_v", String(p.detectorSpeed));
  if (p.countingWindowCycles !== 10) q.set("win", String(p.countingWindowCycles));
  if (p.secondOrderSpeed !== 0.005) q.set("v_second", String(p.secondOrderSpeed));
  if (p.selectedEventId !== "sr-09-event-origin-tick") q.set("event", p.selectedEventId);
  if (p.showCovectorNote) q.set("covector", "1");
  return `?${q}`;
}

export function decodeSr09Settings(
  search: string,
):
  | { kind: "none" }
  | { kind: "settings"; parameters: Sr09Parameters }
  | { kind: "invalid"; message: string } {
  if (!search || search === "?") return { kind: "none" };
  const q = new URLSearchParams(search);
  const trackedKeys = [
    "v",
    "theta",
    "nu",
    "det_motion",
    "det_v",
    "win",
    "v_second",
    "event",
    "covector",
  ];
  if (![...q.keys()].some((k) => trackedKeys.includes(k))) return { kind: "none" };

  const candidate: Sr09Parameters = {
    ...SR09_DEFAULTS,
    beta: q.has("v") ? Number(q.get("v")) : SR09_DEFAULTS.beta,
    propagationAngleDeg: q.has("theta")
      ? Number(q.get("theta"))
      : SR09_DEFAULTS.propagationAngleDeg,
    frequencyTHz: q.has("nu") ? Number(q.get("nu")) : SR09_DEFAULTS.frequencyTHz,
    detectorMotion:
      (q.get("det_motion") as Sr09Parameters["detectorMotion"]) || SR09_DEFAULTS.detectorMotion,
    detectorSpeed: q.has("det_v") ? Number(q.get("det_v")) : SR09_DEFAULTS.detectorSpeed,
    countingWindowCycles: q.has("win") ? Number(q.get("win")) : SR09_DEFAULTS.countingWindowCycles,
    secondOrderSpeed: q.has("v_second")
      ? Number(q.get("v_second"))
      : SR09_DEFAULTS.secondOrderSpeed,
    selectedEventId: q.get("event") || SR09_DEFAULTS.selectedEventId,
    showCovectorNote: q.get("covector") === "1",
  };

  const checked = validateSr09Parameters(candidate);
  if (checked.kind !== "accepted") {
    return { kind: "invalid", message: "Failed to validate SR-09 permalink parameters" };
  }
  return { kind: "settings", parameters: checked.data };
}
