import { ME01_DEFAULTS, type Me01Parameters } from "./definition.ts";
import { validateMe01Parameters } from "./parameters.ts";

export type Me01PermalinkResult =
  | { kind: "none" }
  | { kind: "settings"; parameters: Me01Parameters }
  | { kind: "invalid"; message: string };

export function decodeMe01Settings(search: string): Me01PermalinkResult {
  if (!search || search === "?") return { kind: "none" };
  const params = new URLSearchParams(search);
  const vStr = params.get("v");
  const phiStr = params.get("phi");
  const lStr = params.get("L");
  const premiseStr = params.get("premise");
  const notationStr = params.get("notation");

  if (!vStr && !phiStr && !lStr && !premiseStr && !notationStr) {
    return { kind: "none" };
  }

  const candidate: Me01Parameters = {
    ...ME01_DEFAULTS,
    frameSpeed: vStr !== null ? Number.parseFloat(vStr) : ME01_DEFAULTS.frameSpeed,
    emissionAngle: phiStr !== null ? Number.parseFloat(phiStr) : ME01_DEFAULTS.emissionAngle,
    emittedEnergyRestFrame:
      lStr !== null ? Number.parseFloat(lStr) : ME01_DEFAULTS.emittedEnergyRestFrame,
    premise: premiseStr === "relaxed" ? "relaxed" : ME01_DEFAULTS.premise,
    notation: notationStr === "modern" ? "modern" : ME01_DEFAULTS.notation,
  };

  const validation = validateMe01Parameters(candidate);
  if (validation.kind === "refused") {
    return {
      kind: "invalid",
      message: "The link settings are outside the model domain and could not be loaded.",
    };
  }

  return { kind: "settings", parameters: validation.data };
}

export function encodeMe01Settings(p: Me01Parameters): string {
  const params = new URLSearchParams();
  if (p.frameSpeed !== ME01_DEFAULTS.frameSpeed) {
    params.set("v", String(p.frameSpeed));
  }
  if (p.emissionAngle !== ME01_DEFAULTS.emissionAngle) {
    params.set("phi", String(p.emissionAngle));
  }
  if (p.emittedEnergyRestFrame !== ME01_DEFAULTS.emittedEnergyRestFrame) {
    params.set("L", String(p.emittedEnergyRestFrame));
  }
  if (p.premise !== ME01_DEFAULTS.premise) {
    params.set("premise", p.premise);
  }
  if (p.notation !== ME01_DEFAULTS.notation) {
    params.set("notation", p.notation);
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}
