import { parseScaledDecimal } from "../../units/decimalScale.ts";
import { carriesTapeLink } from "../permalink/codecCore.ts";
import type { Lq09AbsorptionMode, Lq09Parameters } from "./definition.ts";
import { validateLq09Parameters } from "./parameters.ts";

export type DecodedLq09Settings =
  | Readonly<{ kind: "settings"; parameters: Lq09Parameters }>
  | Readonly<{ kind: "empty" }>
  | Readonly<{ kind: "invalid"; message: string }>;

export function encodeLq09Settings(p: Lq09Parameters): string {
  const q = new URLSearchParams();
  q.set("nu", (p.frequency / 1e12).toFixed(4)); // in THz
  q.set("jmol", p.ionizationEnergyEv.toFixed(4));
  q.set("popt", (p.incidentPower * 1e6).toFixed(4)); // in uW
  q.set("eta", p.absorptionEfficiency.toFixed(4));
  q.set("t", p.duration.toFixed(2));
  q.set("mode", p.absorptionMode);
  q.set("a", p.declaredFraction.toFixed(4));
  q.set("gas", p.gasName);
  q.set("cite", p.gasCitation);
  return q.toString();
}

export function decodeLq09Settings(search: string): DecodedLq09Settings {
  if (!search || search === "?" || carriesTapeLink(search)) return { kind: "empty" };
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const invalid = (): DecodedLq09Settings => ({
    kind: "invalid",
    message:
      "This ionization bounds link is incomplete or unsupported. The worked example is unchanged.",
  });
  if (raw.length > 4096) return invalid();

  const q = new URLSearchParams(raw);
  const requiredKeys = ["nu", "jmol", "popt", "eta", "t", "mode", "a", "gas", "cite"];
  if (!requiredKeys.every((k) => q.has(k))) return invalid();

  try {
    const nuTHz = parseScaledDecimal(q.get("nu") ?? "", 0);
    const jmol = parseScaledDecimal(q.get("jmol") ?? "", 0);
    const poptMicroW = parseScaledDecimal(q.get("popt") ?? "", 0);
    const eta = parseScaledDecimal(q.get("eta") ?? "", 0);
    const t = parseScaledDecimal(q.get("t") ?? "", 0);
    const mode = q.get("mode") as Lq09AbsorptionMode;
    const a = parseScaledDecimal(q.get("a") ?? "", 0);
    const gas = q.get("gas") ?? "";
    const cite = q.get("cite") ?? "";

    const computation = validateLq09Parameters({
      frequency: nuTHz * 1e12,
      ionizationEnergyEv: jmol,
      incidentPower: poptMicroW * 1e-6,
      absorptionEfficiency: eta,
      duration: t,
      absorptionMode: mode,
      declaredFraction: a,
      gasName: gas,
      gasCitation: cite,
    });

    if (computation.kind !== "accepted") return invalid();
    return { kind: "settings", parameters: computation.data };
  } catch {
    return invalid();
  }
}
