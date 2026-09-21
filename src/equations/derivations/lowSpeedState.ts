import type { LowSpeedCertificate } from "./massEnergyLowSpeed.ts";
import { LowSpeedProofError } from "./massEnergyLowSpeed.ts";

/** Browser-side dependency projection only; no symbolic algebra or physics. */
type Dependencies = Pick<LowSpeedCertificate, "premises" | "requirements">;
export type LowSpeedOrder = 2 | 4 | 6;
export type LowSpeedSelection = Readonly<{ selected: readonly string[]; order: LowSpeedOrder }>;
export function assessLowSpeed(proof: Dependencies, selection: LowSpeedSelection) {
  const known = proof.premises.map((p) => p.id);
  if (
    ![2, 4, 6].includes(selection.order) ||
    new Set(selection.selected).size !== selection.selected.length ||
    selection.selected.some((id) => !known.includes(id))
  )
    throw new LowSpeedProofError(
      "premise-selection-invalid",
      "Invalid low-speed premise selection or approximation order.",
    );
  return proof.requirements.map((step) => {
    const missing = step.premises.filter((id) => !selection.selected.includes(id));
    return {
      id: step.step,
      status: missing.length ? ("blocked" as const) : ("supported" as const),
      missing,
    };
  });
}
export function lowSpeedHref(proof: Dependencies, selection: LowSpeedSelection): string {
  assessLowSpeed(proof, selection);
  const query = new URLSearchParams({ mel: "1", "mel-order": String(selection.order) });
  const omitted = proof.premises.map((p) => p.id).filter((id) => !selection.selected.includes(id));
  if (omitted.length) query.set("mel-off", omitted.join(","));
  return `/papers/mass-energy/?${query}#me-low-speed-derivation`;
}
export function decodeLowSpeedSetup(
  proof: Dependencies,
  search: string,
):
  | { kind: "absent" }
  | { kind: "invalid"; message: string }
  | { kind: "setup"; selection: LowSpeedSelection } {
  const invalid = () => ({
    kind: "invalid" as const,
    message:
      "This low-speed link is unsupported or ambiguous. The complete all-premise explanation remains selected.",
  });
  if (search.length > 8192) return invalid();
  const query = new URLSearchParams(search);
  if (!["mel", "mel-order", "mel-off"].some((key) => query.has(key))) return { kind: "absent" };
  if (
    query.getAll("mel").length !== 1 ||
    query.get("mel") !== "1" ||
    query.getAll("mel-order").length > 1 ||
    query.getAll("mel-off").length > 1
  )
    return invalid();
  const order = query.get("mel-order") ?? "2";
  if (!["2", "4", "6"].includes(order)) return invalid();
  const raw = query.get("mel-off"),
    omitted = raw === null ? [] : raw.split(",");
  const all = proof.premises.map((p) => p.id);
  if (new Set(omitted).size !== omitted.length || omitted.some((id) => !all.includes(id)))
    return invalid();
  return {
    kind: "setup",
    selection: {
      selected: all.filter((id) => !omitted.includes(id)),
      order: Number(order) as LowSpeedOrder,
    },
  };
}
