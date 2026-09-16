import { SR13_DEFAULTS, type Sr13Parameters } from "./definition.ts";
import { validateSr13Parameters } from "./parameters.ts";

export function encodeSr13Settings(p: Sr13Parameters): string {
  const q = new URLSearchParams();
  q.set("ex", String(p.electricFieldX));
  q.set("ey", String(p.electricFieldY));
  q.set("ez", String(p.electricFieldZ));
  q.set("bx", String(p.magneticFieldX));
  q.set("by", String(p.magneticFieldY));
  q.set("bz", String(p.magneticFieldZ));
  q.set("b", String(p.initialSpeed));
  q.set("dir", String(p.initialDirectionDeg));
  q.set("dt", String(p.integrationInterval));
  q.set("conv", p.forceConvention);
  q.set("lang", p.massLanguage);
  q.set("part", p.particle);
  if (p.particle === "custom") {
    if (p.customCharge !== undefined) q.set("q", String(p.customCharge));
    if (p.customMass !== undefined) q.set("m", String(p.customMass));
  }
  if (p.datasetOverlay !== "none") {
    q.set("ds", p.datasetOverlay);
  }
  return `?${q}`;
}

export function decodeSr13Settings(
  search: string,
):
  | { kind: "none" }
  | { kind: "settings"; parameters: Sr13Parameters }
  | { kind: "invalid"; message: string } {
  if (!search || search === "?") return { kind: "none" };
  const q = new URLSearchParams(search);
  const trackedKeys = ["ex", "ey", "ez", "bx", "by", "bz", "b", "dir", "dt", "conv", "lang", "part", "q", "m", "ds"];
  if (![...q.keys()].some((k) => trackedKeys.includes(k))) return { kind: "none" };

  const candidate: Sr13Parameters = {
    electricFieldX: q.has("ex") ? Number(q.get("ex")) : SR13_DEFAULTS.electricFieldX,
    electricFieldY: q.has("ey") ? Number(q.get("ey")) : SR13_DEFAULTS.electricFieldY,
    electricFieldZ: q.has("ez") ? Number(q.get("ez")) : SR13_DEFAULTS.electricFieldZ,
    magneticFieldX: q.has("bx") ? Number(q.get("bx")) : SR13_DEFAULTS.magneticFieldX,
    magneticFieldY: q.has("by") ? Number(q.get("by")) : SR13_DEFAULTS.magneticFieldY,
    magneticFieldZ: q.has("bz") ? Number(q.get("bz")) : SR13_DEFAULTS.magneticFieldZ,
    initialSpeed: q.has("b") ? Number(q.get("b")) : SR13_DEFAULTS.initialSpeed,
    initialDirectionDeg: q.has("dir") ? Number(q.get("dir")) : SR13_DEFAULTS.initialDirectionDeg,
    integrationInterval: q.has("dt") ? Number(q.get("dt")) : SR13_DEFAULTS.integrationInterval,
    forceConvention: q.get("conv") === "laboratory" ? "laboratory" : "source",
    massLanguage: q.get("lang") === "modern" ? "modern" : "1905",
    particle: q.get("part") === "custom" ? "custom" : "electron",
    customCharge: q.has("q") ? Number(q.get("q")) : SR13_DEFAULTS.customCharge,
    customMass: q.has("m") ? Number(q.get("m")) : SR13_DEFAULTS.customMass,
    datasetOverlay:
      q.get("ds") === "kaufmann-1902-1906" || q.get("ds") === "bucherer-1908"
        ? (q.get("ds") as "kaufmann-1902-1906" | "bucherer-1908")
        : "none",
  };

  const checked = validateSr13Parameters(candidate);
  if (checked.kind !== "accepted") {
    return { kind: "invalid", message: "The link settings are outside the model domain." };
  }
  return { kind: "settings", parameters: checked.data };
}
