import { parseScaledDecimal } from "../../units/decimalScale.ts";
import { carriesTapeLink } from "../permalink/codecCore.ts";
import { LQ05_DEFAULTS, type Lq05Parameters, type Lq05View } from "./definition.ts";
import { validateLq05Parameters } from "./parameters.ts";

export type DecodedLq05Settings =
  | Readonly<{ kind: "settings"; parameters: Lq05Parameters }>
  | Readonly<{ kind: "empty" }>
  | Readonly<{ kind: "invalid"; message: string }>;

export function encodeLq05Settings(p: Lq05Parameters): string {
  const q = new URLSearchParams();
  q.set("n", String(p.n));
  q.set("f", String(p.f));
  q.set("view", p.view);
  q.set("locked", p.locked ? "1" : "0");
  q.set("seed", p.seed);
  q.set("trials", String(p.trials));
  return q.toString();
}

export function decodeLq05Settings(search: string): DecodedLq05Settings {
  if (!search || search === "?" || carriesTapeLink(search)) return { kind: "empty" };
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const invalid = (): DecodedLq05Settings => ({
    kind: "invalid",
    message:
      "This independent configuration link is incomplete or unsupported. The worked example is unchanged.",
  });
  if (raw.length > 4096) return invalid();

  const q = new URLSearchParams(raw);
  const keys = Object.keys(LQ05_DEFAULTS) as (keyof Lq05Parameters)[];
  if (!keys.every((k) => q.has(k))) return invalid();

  const p: Record<string, string | number | boolean> = {};
  try {
    for (const k of keys) {
      if (q.getAll(k).length !== 1) return invalid();
      const v = q.get(k);
      if (v === null) return invalid();
      if (k === "view") {
        p[k] = v as Lq05View;
      } else if (k === "locked") {
        p[k] = v === "1" || v === "true";
      } else if (k === "seed") {
        p[k] = v;
      } else {
        p[k] = parseScaledDecimal(v, 0);
      }
    }
  } catch {
    return invalid();
  }

  const computation = validateLq05Parameters(p);
  if (computation.kind !== "accepted") return invalid();
  return { kind: "settings", parameters: computation.data };
}
