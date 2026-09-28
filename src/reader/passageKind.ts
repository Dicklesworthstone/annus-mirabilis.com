/**
 * What kind of step a passage is, in a reader's words. The label above every passage printed the
 * record's taxonomy, "derivation · Within the stated model", letterspaced in capitals: the logical
 * role verbatim, and a model status that said the same thing for 34 of 42 passages. The role is
 * part of what the edition must show (AGENTS.md, "Four kinds of meaning"), so it stays, in plain
 * words; the model status is shown where it is the exception, an approximation, since "exact
 * within the stated model" is what every other passage is.
 */
const ROLE: Readonly<Record<string, string>> = {
  definition: "A definition",
  assumption: "An assumption",
  derivation: "A derivation",
  "heuristic-inference": "A heuristic step",
  "empirical-observation": "An observation",
  qualification: "A qualification",
  // The capstone records use two roles no argument passage carries: a result the paper takes from
  // elsewhere with its provenance shown, and a statement that reaches past what was argued for.
  // They live in this map rather than a second one beside it, because a label that means the same
  // thing in two places drifts in one of them (am-disc-capstones-infra-3352).
  "admitted-import": "An imported result",
  generalization: "A generalization",
};

/** The same labels, for a record that carries a logical role and no model status. */
export function roleLabel(logicalRole: string): string {
  return ROLE[logicalRole] ?? "A step";
}

export function passageKind(
  meaning: Readonly<{ logicalRole: string; modelStatus: string }>,
): string {
  const role = ROLE[meaning.logicalRole] ?? "A step";
  return meaning.modelStatus === "approximation" ? `${role}, to an approximation` : role;
}
