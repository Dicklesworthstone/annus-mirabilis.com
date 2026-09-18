import { settingBoolean, settingChoice, settingNumber, settingsQuery } from "../permalinkSettings.ts";
import { ME01_DEFAULTS, type Me01Parameters } from "./definition.ts";
import { validateMe01Parameters } from "./parameters.ts";

export type Me01PermalinkResult =
  | { kind: "none" }
  | { kind: "settings"; parameters: Me01Parameters }
  | { kind: "invalid"; message: string };

export function decodeMe01Settings(search: string): Me01PermalinkResult {
  try {
    const query = settingsQuery(search, ["v", "phi", "L", "premise", "notation", "offsets", "step", "angle", "internal", "constant"]);
    if (!query) return { kind: "none" };
    const checked = validateMe01Parameters({
      frameSpeed: settingNumber(query, "v", ME01_DEFAULTS.frameSpeed),
      emissionAngle: settingNumber(query, "phi", ME01_DEFAULTS.emissionAngle),
      emittedEnergyRestFrame: settingNumber(query, "L", ME01_DEFAULTS.emittedEnergyRestFrame),
      premise: settingChoice(query, "premise", ["unchanged", "relaxed"], ME01_DEFAULTS.premise),
      notation: settingChoice(query, "notation", ["printed", "modern"], ME01_DEFAULTS.notation),
      offsetDisplay: settingChoice(query, "offsets", ["symbolic", "offsets"], ME01_DEFAULTS.offsetDisplay),
      step: settingChoice(query, "step", ["intro", "moving-pulses", "sum-angle", "two-balances", "subtraction-move", "premise-kinetic"], ME01_DEFAULTS.step),
      cancelAngleFactors: settingBoolean(query, "angle", ME01_DEFAULTS.cancelAngleFactors),
      cancelInternalEnergies: settingBoolean(query, "internal", ME01_DEFAULTS.cancelInternalEnergies),
      cancelAdditiveConstant: settingBoolean(query, "constant", ME01_DEFAULTS.cancelAdditiveConstant),
    });
    if (checked.kind !== "accepted") throw new Error("The link settings are outside the model domain and could not be loaded.");
    return { kind: "settings", parameters: checked.data };
  } catch (error) {
    return { kind: "invalid", message: error instanceof Error ? error.message : "Invalid two-ledger settings link." };
  }
}

export function encodeMe01Settings(p: Me01Parameters): string {
  const query = new URLSearchParams();
  const values = { v: p.frameSpeed, phi: p.emissionAngle, L: p.emittedEnergyRestFrame,
    premise: p.premise, notation: p.notation, offsets: p.offsetDisplay, step: p.step,
    angle: p.cancelAngleFactors ? "1" : "0", internal: p.cancelInternalEnergies ? "1" : "0",
    constant: p.cancelAdditiveConstant ? "1" : "0" };
  const defaults = { v: ME01_DEFAULTS.frameSpeed, phi: ME01_DEFAULTS.emissionAngle, L: ME01_DEFAULTS.emittedEnergyRestFrame,
    premise: ME01_DEFAULTS.premise, notation: ME01_DEFAULTS.notation, offsets: ME01_DEFAULTS.offsetDisplay, step: ME01_DEFAULTS.step,
    angle: "1", internal: "1", constant: "1" };
  for (const key of Object.keys(values) as (keyof typeof values)[]) {
    if (values[key] !== defaults[key]) query.set(key, String(values[key]));
  }
  const search = query.size ? `?${query}` : "";
  if (decodeMe01Settings(search).kind === "invalid") throw new Error("Cannot share invalid two-ledger parameters.");
  return search;
}
