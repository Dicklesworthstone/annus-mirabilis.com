import { parseScaledDecimal } from "../../units/decimalScale.ts";
import { carriesTapeLink } from "../permalink/codecCore.ts";
import type { Lq07Channels, Lq07Parameters, Lq07Regime } from "./definition.ts";
import { validateLq07Parameters } from "./parameters.ts";

export type DecodedLq07Settings =
  | Readonly<{ kind: "settings"; parameters: Lq07Parameters }>
  | Readonly<{ kind: "empty" }>
  | Readonly<{ kind: "invalid"; message: string }>;

export function encodeLq07Settings(p: Lq07Parameters): string {
  const q = new URLSearchParams();
  q.set("nu1", String(p.nu1));
  q.set("nu2", String(p.nu2));
  q.set("regime", p.regime);
  q.set("k", String(p.multiQuantumK));
  q.set("Tsrc", String(p.sourceTemperatureK));
  q.set("Tbody", String(p.bodyTemperatureK));
  q.set("Pabs", String(p.absorbedPowerMicrowatts));
  q.set("Y", String(p.quantumYield));
  q.set("channels", p.channels);
  return q.toString();
}

export function decodeLq07Settings(search: string): DecodedLq07Settings {
  if (!search || search === "?" || carriesTapeLink(search)) return { kind: "empty" };
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const invalid = (): DecodedLq07Settings => ({
    kind: "invalid",
    message:
      "This fluorescence budget link is incomplete or unsupported. The worked example is unchanged.",
  });
  if (raw.length > 4096) return invalid();

  const q = new URLSearchParams(raw);
  const requiredKeys = ["nu1", "nu2", "regime", "k", "Tsrc", "Tbody", "Pabs", "Y", "channels"];
  if (!requiredKeys.every((k) => q.has(k))) return invalid();

  try {
    const nu1 = parseScaledDecimal(q.get("nu1") ?? "", 0);
    const nu2 = parseScaledDecimal(q.get("nu2") ?? "", 0);
    const regime = q.get("regime") as Lq07Regime;
    const multiQuantumK = parseScaledDecimal(q.get("k") ?? "", 0);
    const sourceTemperatureK = parseScaledDecimal(q.get("Tsrc") ?? "", 0);
    const bodyTemperatureK = parseScaledDecimal(q.get("Tbody") ?? "", 0);
    const absorbedPowerMicrowatts = parseScaledDecimal(q.get("Pabs") ?? "", 0);
    const quantumYield = parseScaledDecimal(q.get("Y") ?? "", 0);
    const channels = q.get("channels") as Lq07Channels;

    const computation = validateLq07Parameters({
      nu1,
      nu2,
      regime,
      multiQuantumK,
      sourceTemperatureK,
      bodyTemperatureK,
      absorbedPowerMicrowatts,
      quantumYield,
      channels,
    });

    if (computation.kind !== "accepted") return invalid();
    return { kind: "settings", parameters: computation.data };
  } catch {
    return invalid();
  }
}
