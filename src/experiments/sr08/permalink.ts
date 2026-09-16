import { C_SI } from "../../physics/reference/fields.ts";
import { SR08_DEFAULTS, type Sr08Parameters } from "./definition.ts";
import { validateSr08Parameters } from "./parameters.ts";

export function encodeSr08Settings(p: Sr08Parameters): string {
  const q = new URLSearchParams();
  q.set("ex", String(p.electricFieldX));
  q.set("ey", String(p.electricFieldY));
  q.set("ez", String(p.electricFieldZ));
  q.set("bx", String(p.magneticFieldX));
  q.set("by", String(p.magneticFieldY));
  q.set("bz", String(p.magneticFieldZ));
  q.set("v", String(p.boost / C_SI));
  q.set("q", String(p.testCharge));
  q.set("ux", String(p.chargeVelocityX / C_SI));
  q.set("uy", String(p.chargeVelocityY / C_SI));
  q.set("uz", String(p.chargeVelocityZ / C_SI));
  q.set("units", p.unitLayer);
  q.set("frame", p.descriptionFrame);
  if (!p.decomposeComponents) q.set("decomp", "0");
  if (p.detectorMotion) {
    q.set("det", "1");
    q.set("det_v", String(p.detectorSpeed / C_SI));
  }
  return `?${q}`;
}

export function decodeSr08Settings(
  search: string,
):
  | { kind: "none" }
  | { kind: "settings"; parameters: Sr08Parameters }
  | { kind: "invalid"; message: string } {
  if (!search || search === "?") return { kind: "none" };
  const q = new URLSearchParams(search);
  const trackedKeys = [
    "ex",
    "ey",
    "ez",
    "bx",
    "by",
    "bz",
    "v",
    "q",
    "ux",
    "uy",
    "uz",
    "units",
    "frame",
  ];
  if (![...q.keys()].some((k) => trackedKeys.includes(k))) return { kind: "none" };

  const boostVal = q.has("v") ? Number(q.get("v")) * C_SI : SR08_DEFAULTS.boost;
  const uxVal = q.has("ux") ? Number(q.get("ux")) * C_SI : SR08_DEFAULTS.chargeVelocityX;
  const uyVal = q.has("uy") ? Number(q.get("uy")) * C_SI : SR08_DEFAULTS.chargeVelocityY;
  const uzVal = q.has("uz") ? Number(q.get("uz")) * C_SI : SR08_DEFAULTS.chargeVelocityZ;
  const detVVal = q.has("det_v") ? Number(q.get("det_v")) * C_SI : 0;

  const candidate: Sr08Parameters = {
    ...SR08_DEFAULTS,
    electricFieldX: q.has("ex") ? Number(q.get("ex")) : SR08_DEFAULTS.electricFieldX,
    electricFieldY: q.has("ey") ? Number(q.get("ey")) : SR08_DEFAULTS.electricFieldY,
    electricFieldZ: q.has("ez") ? Number(q.get("ez")) : SR08_DEFAULTS.electricFieldZ,
    magneticFieldX: q.has("bx") ? Number(q.get("bx")) : SR08_DEFAULTS.magneticFieldX,
    magneticFieldY: q.has("by") ? Number(q.get("by")) : SR08_DEFAULTS.magneticFieldY,
    magneticFieldZ: q.has("bz") ? Number(q.get("bz")) : SR08_DEFAULTS.magneticFieldZ,
    boost: boostVal,
    testCharge: q.has("q") ? Number(q.get("q")) : SR08_DEFAULTS.testCharge,
    chargeVelocityX: uxVal,
    chargeVelocityY: uyVal,
    chargeVelocityZ: uzVal,
    unitLayer: q.get("units") === "gaussian" ? "gaussian" : "si",
    descriptionFrame: q.get("frame") === "moving" ? "moving" : "stationary",
    decomposeComponents: q.get("decomp") !== "0",
    detectorMotion: q.get("det") === "1",
    detectorSpeed: detVVal,
  };

  const checked = validateSr08Parameters(candidate);
  if (checked.kind !== "accepted") {
    return { kind: "invalid", message: "The link settings are outside the model domain." };
  }
  return { kind: "settings", parameters: checked.data };
}
