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

  if (
    !boundaryStr &&
    !dispStr &&
    !lStr &&
    !inStr &&
    !cardStr &&
    !modeStr &&
    !pulseStr &&
    !notationStr
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

export function encodeMe03Settings(p: Me03Parameters): string {
  const params = new URLSearchParams();
  if (p.boundary !== ME03_DEFAULTS.boundary) {
    params.set("boundary", p.boundary);
  }
  if (p.disposition !== ME03_DEFAULTS.disposition) {
    params.set("disposition", p.disposition);
  }
  if (p.emittedEnergy !== ME03_DEFAULTS.emittedEnergy) {
    params.set("L", String(p.emittedEnergy));
  }
  if (p.inputEnergy !== ME03_DEFAULTS.inputEnergy) {
    params.set("Ein", String(p.inputEnergy));
  }
  if (p.cardId !== ME03_DEFAULTS.cardId) {
    params.set("card", p.cardId);
  }
  if (p.mode !== ME03_DEFAULTS.mode) {
    params.set("mode", p.mode);
  }
  if (p.pulseSystem !== ME03_DEFAULTS.pulseSystem) {
    params.set("pulses", p.pulseSystem);
  }
  if (p.notation !== ME03_DEFAULTS.notation) {
    params.set("notation", p.notation);
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}
