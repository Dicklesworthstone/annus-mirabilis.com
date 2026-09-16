import { formatScaledDecimal, parseScaledDecimal } from "../../units/decimalScale.ts";
import type {
  Lq06ForkAChoice,
  Lq06Parameters,
  Lq06ProposedEnergy,
  Lq06SubexpressionChoice,
} from "./definition.ts";
import { validateLq06Parameters } from "./parameters.ts";

export type DecodedLq06Settings =
  | Readonly<{ kind: "settings"; parameters: Lq06Parameters }>
  | Readonly<{ kind: "absent" }>
  | Readonly<{ kind: "invalid"; message: string }>;

export function encodeLq06Settings(p: Lq06Parameters): string {
  if (validateLq06Parameters(p).kind !== "accepted")
    throw new TypeError("Only valid accepted settings can be shared.");
  const q = new URLSearchParams();
  q.set("e", formatScaledDecimal(p.radiationEnergy, 9)); // in nJ
  q.set("nu", formatScaledDecimal(p.frequency, -12)); // in THz
  q.set("n", String(p.gasParticles));
  q.set("v", formatScaledDecimal(p.volumeRatio, 0));
  q.set("t", formatScaledDecimal(p.temperature, 0));
  q.set("sub", p.selectedSubexpression);
  q.set("elem", p.proposedEnergyElement);
  q.set("fork", p.forkAChoice);
  q.set("cset", p.constantSetId);
  return `?${q.toString()}`;
}

export function decodeLq06Settings(search: string): DecodedLq06Settings {
  if (!search || search === "?") return { kind: "absent" };
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const invalid = (): DecodedLq06Settings => ({
    kind: "invalid",
    message:
      "This coefficient matching link is incomplete or unsupported. The worked example is unchanged.",
  });
  if (raw.length > 4096) return invalid();

  const q = new URLSearchParams(raw);
  const requiredKeys = ["e", "nu", "n", "v", "t", "sub", "elem", "fork"];
  const allowed = new Set([...requiredKeys, "cset", "lq"]);
  if (
    !requiredKeys.every((k) => q.getAll(k).length === 1) ||
    [...q.keys()].some((k) => !allowed.has(k) || q.getAll(k).length !== 1)
  )
    return invalid();

  try {
    const energy = parseScaledDecimal(q.get("e") ?? "", 9);
    const frequency = parseScaledDecimal(q.get("nu") ?? "", -12);
    const count = q.get("n") ?? "";
    if (!/^[1-9]\d*$/.test(count)) return invalid();
    const n = Number(count);
    if (!Number.isSafeInteger(n)) return invalid();
    const v = parseScaledDecimal(q.get("v") ?? "", 0);
    const t = parseScaledDecimal(q.get("t") ?? "", 0);
    const sub = q.get("sub") as Lq06SubexpressionChoice;
    const elem = q.get("elem") as Lq06ProposedEnergy;
    const fork = q.get("fork") as Lq06ForkAChoice;
    const cset = q.get("cset") ?? "modern-si-2019";

    const computation = validateLq06Parameters({
      radiationEnergy: energy,
      frequency,
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
