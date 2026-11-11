/** A result names its supporting calculation, or records why no checked proof is available. */
export const RESULT_PROOF_IDS = [
  "bm-equilibrium-diffusivity",
  "me-ledger-elimination",
  "me-low-speed-coefficient",
  "sr-light-complex-energy",
  "sr-electron-force-conventions",
  "sr-electron-work",
] as const;
export type ResultProofId = (typeof RESULT_PROOF_IDS)[number];

export type ResultSupportDeclaration =
  | Readonly<{
      kind: "checked-proof";
      proofId: ResultProofId;
      conclusion: string;
      /** Which part of the card the calculation establishes, with its limits. */
      scope: string;
    }>
  | Readonly<{ kind: "no-checked-proof"; reason: string }>;

/** Plain build output. The reader receives no symbolic checker or equation registry. */
export type CheckedResultSupport = Readonly<{
  kind: "checked-proof";
  proofId: ResultProofId;
  title: string;
  href: string;
  conclusion: Readonly<{ equationId: string; title: string }>;
  scope: string;
  assumptions: readonly Readonly<{ id: string; label: string; explanation: string }>[];
}>;

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Report malformed declarations alongside the card's other unresolved references. */
export function checkSupportDeclaration(
  raw: unknown,
): Readonly<{ support?: ResultSupportDeclaration; problems: readonly string[] }> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw))
    return { problems: ["support must name a checked proof or explain why none is available"] };
  const value = raw as Record<string, unknown>;
  const problems: string[] = [];
  if (value.kind === "no-checked-proof") {
    const reason = text(value.reason);
    if (!reason) problems.push("support without a checked proof requires a reason");
    if (Object.keys(value).some((key) => !["kind", "reason"].includes(key)))
      problems.push("support cannot declare both a proof and its absence");
    return problems.length > 0
      ? { problems }
      : { support: { kind: "no-checked-proof", reason }, problems };
  }
  if (value.kind !== "checked-proof")
    return { problems: ["support kind must be checked-proof or no-checked-proof"] };
  const proofId = text(value.proofId);
  const conclusion = text(value.conclusion);
  const scope = text(value.scope);
  if (!(RESULT_PROOF_IDS as readonly string[]).includes(proofId))
    problems.push(`support proof ${proofId || "(none)"} has no registered calculation owner`);
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(conclusion))
    problems.push("support must name a conclusion equation by its stable id");
  if (!scope) problems.push("support must state which claim the proof establishes and its scope");
  if (Object.keys(value).some((key) => !["kind", "proofId", "conclusion", "scope"].includes(key)))
    problems.push("support carries an unrecognized field");
  return problems.length > 0
    ? { problems }
    : {
        support: { kind: "checked-proof", proofId: proofId as ResultProofId, conclusion, scope },
        problems,
      };
}
