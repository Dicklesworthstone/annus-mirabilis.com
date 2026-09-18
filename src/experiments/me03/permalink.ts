import {
  ME03_DEFAULTS,
  type Me03Boundary,
  type Me03CardId,
  type Me03Mode,
  type Me03Notation,
  type Me03Parameters,
  type Me03PulseSystem,
  type Me03RadiationDisposition,
} from "./definition.ts";
import { validateMe03Parameters } from "./parameters.ts";

export type Me03PermalinkResult =
  | { kind: "none" }
  | { kind: "settings"; parameters: Me03Parameters }
  | { kind: "invalid"; message: string };

export function decodeMe03Settings(search: string): Me03PermalinkResult {
  if (!search || search === "?") return { kind: "none" };
  const params = new URLSearchParams(search);
  const boundaryStr = params.get("boundary");
  const dispStr = params.get("disposition");
  const lStr = params.get("L");
  const inStr = params.get("Ein");
  const cardStr = params.get("card");
  const modeStr = params.get("mode");
  const pulseStr = params.get("pulses");
  const notationStr = params.get("notation");
  const mStr = params.get("M");
  const ellStr = params.get("ell");
  const eStr = params.get("E");
  const lightMassStr = params.get("lightMass");
  const magStr = params.get("mag");

  if (
    !boundaryStr &&
    !dispStr &&
    !lStr &&
    !inStr &&
    !cardStr &&
    !modeStr &&
    !pulseStr &&
    !notationStr &&
    !mStr &&
    !ellStr &&
    !eStr &&
    !lightMassStr &&
    !magStr
  ) {
    return { kind: "none" };
  }

  const candidate: Me03Parameters = {
    ...ME03_DEFAULTS,
    boundary: (boundaryStr as Me03Boundary) ?? ME03_DEFAULTS.boundary,
    disposition: (dispStr as Me03RadiationDisposition) ?? ME03_DEFAULTS.disposition,
    emittedEnergy: lStr !== null ? Number.parseFloat(lStr) : ME03_DEFAULTS.emittedEnergy,
    inputEnergy: inStr !== null ? Number.parseFloat(inStr) : ME03_DEFAULTS.inputEnergy,
    cardId: (cardStr as Me03CardId) ?? ME03_DEFAULTS.cardId,
    mode: (modeStr as Me03Mode) ?? ME03_DEFAULTS.mode,
    pulseSystem: (pulseStr as Me03PulseSystem) ?? ME03_DEFAULTS.pulseSystem,
    notation: (notationStr as Me03Notation) ?? ME03_DEFAULTS.notation,
    boxMass:
      mStr !== null && Number.isFinite(Number.parseFloat(mStr))
        ? Number.parseFloat(mStr)
        : ME03_DEFAULTS.boxMass,
    boxLength:
      ellStr !== null && Number.isFinite(Number.parseFloat(ellStr))
        ? Number.parseFloat(ellStr)
        : ME03_DEFAULTS.boxLength,
    pulseEnergy:
      eStr !== null && Number.isFinite(Number.parseFloat(eStr))
        ? Number.parseFloat(eStr)
        : ME03_DEFAULTS.pulseEnergy,
    assignLightMass:
      lightMassStr !== null ? lightMassStr === "true" : ME03_DEFAULTS.assignLightMass,
    magnification:
      magStr !== null && Number.isFinite(Number.parseFloat(magStr))
        ? Number.parseFloat(magStr)
        : ME03_DEFAULTS.magnification,
  };

  const validation = validateMe03Parameters(candidate);
  if (validation.kind === "refused") {
    return {
      kind: "invalid",
      message: "The link settings are outside the model domain and could not be loaded.",
    };
  }

  return { kind: "settings", parameters: validation.data };
}

export function encodeMe03Settings(p: Partial<Me03Parameters>): string {
  const params = new URLSearchParams();
  if (p.boundary !== undefined && p.boundary !== ME03_DEFAULTS.boundary) {
    params.set("boundary", p.boundary);
  }
  if (p.disposition !== undefined && p.disposition !== ME03_DEFAULTS.disposition) {
    params.set("disposition", p.disposition);
  }
  if (p.emittedEnergy !== undefined && p.emittedEnergy !== ME03_DEFAULTS.emittedEnergy) {
    params.set("L", String(p.emittedEnergy));
  }
  if (p.inputEnergy !== undefined && p.inputEnergy !== ME03_DEFAULTS.inputEnergy) {
    params.set("Ein", String(p.inputEnergy));
  }
  if (p.cardId !== undefined && p.cardId !== ME03_DEFAULTS.cardId) {
    params.set("card", p.cardId);
  }
  if (p.mode !== undefined && p.mode !== ME03_DEFAULTS.mode) {
    params.set("mode", p.mode);
  }
  if (p.pulseSystem !== undefined && p.pulseSystem !== ME03_DEFAULTS.pulseSystem) {
    params.set("pulses", p.pulseSystem);
  }
  if (p.notation !== undefined && p.notation !== ME03_DEFAULTS.notation) {
    params.set("notation", p.notation);
  }
  if (p.boxMass !== undefined && p.boxMass !== ME03_DEFAULTS.boxMass) {
    params.set("M", String(p.boxMass));
  }
  if (p.boxLength !== undefined && p.boxLength !== ME03_DEFAULTS.boxLength) {
    params.set("ell", String(p.boxLength));
  }
  if (p.pulseEnergy !== undefined && p.pulseEnergy !== ME03_DEFAULTS.pulseEnergy) {
    params.set("E", String(p.pulseEnergy));
  }
  if (p.assignLightMass !== undefined && p.assignLightMass !== ME03_DEFAULTS.assignLightMass) {
    params.set("lightMass", String(p.assignLightMass));
  }
  if (p.magnification !== undefined && p.magnification !== ME03_DEFAULTS.magnification) {
    params.set("mag", String(p.magnification));
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}
