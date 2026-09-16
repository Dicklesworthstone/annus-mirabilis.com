import { parseScaledDecimal } from "../../units/decimalScale.ts";
import type {
  Lq06ForkAChoice,
  Lq06Parameters,
  Lq06ProposedEnergy,
  Lq06SubexpressionChoice,
} from "./definition.ts";
import { validateLq06Parameters } from "./parameters.ts";

export type DecodedLq06Settings =
  | Readonly<{ kind: "settings"; parameters: Lq06Parameters }>
  | Readonly<{ kind: "empty" }>
  | Readonly<{ kind: "invalid"; message: string }>;

export function encodeLq06Settings(p: Lq06Parameters): string {
  const q = new URLSearchParams();
  q.set("e", (p.radiationEnergy * 1e9).toFixed(4)); // in nJ
  q.set("nu", (p.frequency / 1e12).toFixed(2)); // in THz
  q.set("n", String(p.gasParticles));
  q.set("v", p.volumeRatio.toFixed(4));
  q.set("t", p.temperature.toFixed(0));
  q.set("sub", p.selectedSubexpression);
  q.set("elem", p.proposedEnergyElement);
  q.set("fork", p.forkAChoice);
  q.set("cset", p.constantSetId);
  return q.toString();
}

export function decodeLq06Settings(search: string): DecodedLq06Settings {
  if (!search || search === "?") return { kind: "empty" };
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const invalid = (): DecodedLq06Settings => ({
    kind: "invalid",
    message:
      "This coefficient matching link is incomplete or unsupported. The worked example is unchanged.",
  });
  if (raw.length > 4096) return invalid();

  const q = new URLSearchParams(raw);
  const requiredKeys = ["e", "nu", "n", "v", "t", "sub", "elem", "fork"];
  if (!requiredKeys.every((k) => q.has(k))) return invalid();

  try {
    const eNanoJ = parseScaledDecimal(q.get("e") ?? "", 0);
    const nuTHz = parseScaledDecimal(q.get("nu") ?? "", 0);
    const n = Number.parseInt(q.get("n") ?? "", 10);
    const v = parseScaledDecimal(q.get("v") ?? "", 0);
    const t = parseScaledDecimal(q.get("t") ?? "", 0);
    const sub = q.get("sub") as Lq06SubexpressionChoice;
    const elem = q.get("elem") as Lq06ProposedEnergy;
    const fork = q.get("fork") as Lq06ForkAChoice;
    const cset = q.get("cset") ?? "modern-si-2019";

    const computation = validateLq06Parameters({
      radiationEnergy: eNanoJ * 1e-9,
      frequency: nuTHz * 1e12,
      gasParticles: n,
      volumeRatio: v,
      temperature: t,
      selectedSubexpression: sub,
      proposedEnergyElement: elem,
      forkAChoice: fork,
      constantSetId: cset,
    });

    if (computation.kind !== "accepted") return invalid();
    return { kind: "settings", parameters: computation.data };
  } catch {
    return invalid();
  }
}
