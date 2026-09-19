import type { CheckedLinearCertificate } from "./linearCertificate.ts";

/** Client-safe projection of build-checked dependencies; never an algebra checker. */
export function assessLinearCertificate(proof: CheckedLinearCertificate, selected: readonly string[]) {
  const known = new Set(proof.premises.map(p => p.id));
  if (new Set(selected).size !== selected.length || selected.some(id => !known.has(id)))
    throw new Error("Equality certificate: Unknown or duplicated selected premise.");
  const active = new Set(selected);
  return proof.requirements.map(step => {
    const missing = step.premises.filter(id => !active.has(id));
    return { id: step.step, status: missing.length ? "blocked" as const : "supported" as const, missing };
  });
}
/** Links carry only omissions and a format version; never proof results or HTML. */
export function proofSetupHref(proof: CheckedLinearCertificate, selected: readonly string[]): string {
  assessLinearCertificate(proof, selected);
  const omitted = proof.premises.map(p => p.id).filter(id => !selected.includes(id));
  const query = new URLSearchParams({ mep: "1" });
  if (omitted.length) query.set("mep-off", omitted.join(","));
  return `/papers/mass-energy/?${query}#me-ledger-derivation`;
}
export function decodeProofSetup(proof: CheckedLinearCertificate, search: string):
  | { kind: "absent" } | { kind: "invalid"; message: string } | { kind: "setup"; selected: readonly string[] } {
  const invalid = () => ({ kind: "invalid" as const, message: "This derivation link is unsupported or ambiguous. All stated premises remain selected." });
  if (search.length > 8192) return invalid();
  const query = new URLSearchParams(search);
  if (!query.has("mep") && !query.has("mep-off")) return { kind: "absent" };
  if (query.getAll("mep").length !== 1 || query.get("mep") !== "1" || query.getAll("mep-off").length > 1) return invalid();
  const raw = query.get("mep-off");
  const omitted = raw === null ? [] : raw.split(",");
  const all = proof.premises.map(p => p.id);
  if (new Set(omitted).size !== omitted.length || omitted.some(id => !all.includes(id))) return invalid();
  return { kind: "setup", selected: all.filter(id => !omitted.includes(id)) };
}
