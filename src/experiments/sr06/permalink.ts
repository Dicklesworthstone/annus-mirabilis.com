import { SR06_DEFAULTS, type Sr06Parameters } from "./definition.ts";
import { validateSr06Parameters } from "./parameters.ts";

export function encodeSr06Settings(p: Sr06Parameters): string {
  const q = new URLSearchParams();
  q.set("v", String(p.frameBeta));
  q.set("w", String(p.movingSpeed));
  q.set("alpha", String(p.alphaDeg));
  q.set("mode", p.mode);
  if (p.mode === "two-boosts") {
    q.set("v2", String(p.secondBeta));
    q.set("alpha2", String(p.secondAngleDeg));
  }
  if (p.showRapidity) q.set("rapidity", "1");
  return `?${q}`;
}

export function decodeSr06Settings(
  search: string,
):
  | { kind: "none" }
  | { kind: "settings"; parameters: Sr06Parameters }
  | { kind: "invalid"; message: string } {
  if (!search || search === "?") return { kind: "none" };
  const q = new URLSearchParams(search);
  if (![...q.keys()].some((k) => ["v", "w", "alpha", "mode"].includes(k))) return { kind: "none" };
  const mode = q.get("mode");
  const candidate: Sr06Parameters = {
    ...SR06_DEFAULTS,
    frameBeta: q.has("v") ? Number(q.get("v")) : SR06_DEFAULTS.frameBeta,
    movingSpeed: q.has("w") ? Number(q.get("w")) : SR06_DEFAULTS.movingSpeed,
    alphaDeg: q.has("alpha") ? Number(q.get("alpha")) : SR06_DEFAULTS.alphaDeg,
    mode:
      mode === "angled" || mode === "two-boosts" || mode === "collinear"
        ? mode
        : SR06_DEFAULTS.mode,
    secondBeta: q.has("v2") ? Number(q.get("v2")) : SR06_DEFAULTS.secondBeta,
    secondAngleDeg: q.has("alpha2") ? Number(q.get("alpha2")) : SR06_DEFAULTS.secondAngleDeg,
    showRapidity: q.get("rapidity") === "1",
  };
  const checked = validateSr06Parameters(candidate);
  if (checked.kind !== "accepted")
    return { kind: "invalid", message: "The link settings are outside the model domain." };
  return { kind: "settings", parameters: checked.data };
}
