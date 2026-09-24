import { carriesTapeLink } from "./permalink/codecCore.ts";

/**
 * Strict, bounded URL settings. A typo must not silently select a different scientific setup.
 * An address carrying a ?tape= link is not a settings link, so it is not read as one: its "tape"
 * key failed as an unknown setting, and ME-02 said "Unknown setting: tape." over a restored state.
 */
export function settingsQuery(search: string, allowed: readonly string[]): URLSearchParams | null {
  if (!search || search === "?" || carriesTapeLink(search)) return null;
  if (search.length > 4096) throw new Error("The settings link is too long.");
  const params = new URLSearchParams(search);
  if (!params.size) return null;
  for (const key of params.keys()) {
    if (!allowed.includes(key)) throw new Error(`Unknown setting: ${key}.`);
    if (params.getAll(key).length !== 1) throw new Error(`Repeated setting: ${key}.`);
  }
  return params;
}

export function settingNumber(params: URLSearchParams, key: string, fallback: number): number {
  const raw = params.get(key);
  if (raw === null) return fallback;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw)) {
    throw new Error(`Setting ${key} must be a complete decimal number.`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || (value === 0 && /[1-9]/.test(raw.split(/[eE]/)[0] ?? ""))) {
    throw new Error(`Setting ${key} is outside the representable numeric range.`);
  }
  return value;
}

export function settingChoice<T extends string>(
  params: URLSearchParams,
  key: string,
  choices: readonly T[],
  fallback: T,
): T {
  const value = params.get(key);
  if (value === null) return fallback;
  if (!choices.includes(value as T)) throw new Error(`Unknown value for ${key}: ${value}.`);
  return value as T;
}

export function settingBoolean(params: URLSearchParams, key: string, fallback: boolean): boolean {
  return settingChoice(params, key, ["0", "1"], fallback ? "1" : "0") === "1";
}
