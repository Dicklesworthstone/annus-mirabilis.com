import { C_SI } from "../../physics/reference/fields.ts";
import { SR12_DEFAULTS, type Sr12Parameters } from "./definition.ts";
import { validateSr12Parameters } from "./parameters.ts";

export function encodeSr12Settings(p: Sr12Parameters): string {
  const q = new URLSearchParams();
  q.set("mode", p.mode);
  q.set("rho", String(p.chargeDensity));
  q.set("jx", String(p.currentDensityX));
  q.set("jy", String(p.currentDensityY));
  q.set("jz", String(p.currentDensityZ));
  q.set("v", String(p.boost / C_SI));
  q.set("ux", String(p.carrierVelocityX / C_SI));
  q.set("uy", String(p.carrierVelocityY / C_SI));
  q.set("uz", String(p.carrierVelocityZ / C_SI));
  q.set("r", String(p.sphereRadius));
  q.set("i", String(p.loopCurrent));
  q.set("lx", String(p.loopLengthX));
  q.set("ly", String(p.loopLengthY));
  q.set("units", p.unitLayer);
  q.set("frame", p.descriptionFrame);
  return `?${q}`;
}

export function decodeSr12Settings(
  search: string,
):
  | { kind: "none" }
  | { kind: "settings"; parameters: Sr12Parameters }
  | { kind: "invalid"; message: string } {
  if (!search || search === "?") return { kind: "none" };
  const q = new URLSearchParams(search);
  const trackedKeys = [
    "mode",
    "rho",
    "jx",
    "jy",
    "jz",
    "v",
    "ux",
    "uy",
    "uz",
    "r",
    "i",
    "lx",
    "ly",
    "units",
    "frame",
  ];
  if (![...q.keys()].some((k) => trackedKeys.includes(k))) return { kind: "none" };

  const boostVal = q.has("v") ? Number(q.get("v")) * C_SI : SR12_DEFAULTS.boost;
  const uxVal = q.has("ux") ? Number(q.get("ux")) * C_SI : SR12_DEFAULTS.carrierVelocityX;
  const uyVal = q.has("uy") ? Number(q.get("uy")) * C_SI : SR12_DEFAULTS.carrierVelocityY;
  const uzVal = q.has("uz") ? Number(q.get("uz")) * C_SI : SR12_DEFAULTS.carrierVelocityZ;

  const modeVal = (q.get("mode") ?? "neutral-conductor") as Sr12Parameters["mode"];

  const candidate: Sr12Parameters = {
    ...SR12_DEFAULTS,
    mode: [
      "neutral-conductor",
      "convection",
      "moving-sphere",
      "gaussian-pulse",
      "current-loop",
    ].includes(modeVal)
      ? modeVal
      : "neutral-conductor",
    chargeDensity: q.has("rho") ? Number(q.get("rho")) : SR12_DEFAULTS.chargeDensity,
    currentDensityX: q.has("jx") ? Number(q.get("jx")) : SR12_DEFAULTS.currentDensityX,
    currentDensityY: q.has("jy") ? Number(q.get("jy")) : SR12_DEFAULTS.currentDensityY,
    currentDensityZ: q.has("jz") ? Number(q.get("jz")) : SR12_DEFAULTS.currentDensityZ,
    boost: boostVal,
    carrierVelocityX: uxVal,
    carrierVelocityY: uyVal,
    carrierVelocityZ: uzVal,
    sphereRadius: q.has("r") ? Number(q.get("r")) : SR12_DEFAULTS.sphereRadius,
    loopCurrent: q.has("i") ? Number(q.get("i")) : SR12_DEFAULTS.loopCurrent,
    loopLengthX: q.has("lx") ? Number(q.get("lx")) : SR12_DEFAULTS.loopLengthX,
    loopLengthY: q.has("ly") ? Number(q.get("ly")) : SR12_DEFAULTS.loopLengthY,
    unitLayer: q.get("units") === "gaussian" ? "gaussian" : "si",
    descriptionFrame: q.get("frame") === "moving" ? "moving" : "stationary",
  };

  const checked = validateSr12Parameters(candidate);
  if (checked.kind !== "accepted") {
    return { kind: "invalid", message: "The link settings are outside the model domain." };
  }
  return { kind: "settings", parameters: checked.data };
}
