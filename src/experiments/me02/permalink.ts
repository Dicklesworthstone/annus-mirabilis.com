import {
  settingBoolean,
  settingChoice,
  settingNumber,
  settingsQuery,
} from "../permalinkSettings.ts";
import { ME02_DEFAULTS, type Me02Parameters } from "./definition.ts";
import { validateMe02Parameters } from "./parameters.ts";

export type Me02PermalinkResult =
  | { kind: "none" }
  | { kind: "settings"; parameters: Me02Parameters }
  | { kind: "invalid"; message: string };

export function decodeMe02Settings(search: string): Me02PermalinkResult {
  try {
    const query = settingsQuery(search, ["beta", "L", "unit", "axis", "naive", "notation"]);
    if (!query) return { kind: "none" };
    const checked = validateMe02Parameters({
      beta: settingNumber(query, "beta", ME02_DEFAULTS.beta),
      emittedEnergy: settingNumber(query, "L", ME02_DEFAULTS.emittedEnergy),
      energyUnit: settingChoice(
        query,
        "unit",
        ["normalized", "erg", "joule"],
        ME02_DEFAULTS.energyUnit,
      ),
      speedAxis: settingChoice(query, "axis", ["linear", "logarithmic"], ME02_DEFAULTS.speedAxis),
      showNaive: settingBoolean(query, "naive", ME02_DEFAULTS.showNaive),
      notation: settingChoice(query, "notation", ["printed", "modern"], ME02_DEFAULTS.notation),
    });
    if (checked.kind !== "accepted")
      throw new Error("The linked settings are outside the coefficient model domain.");
    return { kind: "settings", parameters: checked.data };
  } catch (error) {
    return {
      kind: "invalid",
      message: error instanceof Error ? error.message : "Invalid coefficient settings link.",
    };
  }
}

export function encodeMe02Settings(parameters: Me02Parameters): string {
  const checked = validateMe02Parameters(parameters);
  if (checked.kind !== "accepted") throw new Error("Cannot share invalid coefficient parameters.");
  const p = checked.data;
  return `?${new URLSearchParams({
    beta: String(p.beta),
    L: String(p.emittedEnergy),
    unit: p.energyUnit,
    axis: p.speedAxis,
    naive: p.showNaive ? "1" : "0",
    notation: p.notation,
  })}`;
}
