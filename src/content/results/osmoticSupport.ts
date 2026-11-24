/** Join the actual pressure equation to the volume calculation shown in Brownian section 2. */
import pressureRecord from "../../../content/equations/brownian-motion/eq-model-bm-osmotic-pressure.json";
import { brownianOsmoticExpressions } from "../../equations/derivations/brownianOsmotic.ts";
import {
  brownianOsmoticCheckRows,
  verifyBrownianOsmotic,
} from "../../equations/derivations/brownianOsmoticProof.ts";
import { projectDerivationSymbols } from "../../equations/derivations/projectSymbols.ts";
import type { EquationRecord } from "../../equations/record.ts";
import { ResultCardsError } from "./printedChecks.ts";
import type { CheckedResultSupport } from "./supportDeclarations.ts";

export const osmoticSupportAssumptions = [
  {
    id: "bm-osmotic-statistical-free-energy",
    label: "The statistical free-energy starting point",
    explanation:
      "Admit the statistical relation F = −(RT/N) ln B with a fixed phase-space measure. The cancellation and calculus do not prove that statistical theory.",
  },
  {
    id: "bm-osmotic-independent-placements",
    label: "Independent placements in a homogeneous dilute suspension",
    explanation:
      "Each particle contributes its own accessible-volume factor, so B = J Vⁿ. Equal one-particle probabilities alone do not establish independent joint placements.",
  },
  {
    id: "bm-osmotic-volume-independent-factor",
    label: "The remaining factor is independent of volume",
    explanation:
      "The same J applies as the selective wall moves. If J depends on volume, its logarithmic derivative supplies an additional pressure term that this law does not include.",
  },
  {
    id: "bm-osmotic-isothermal-work",
    label: "Equilibrium work at fixed temperature and particle count",
    explanation:
      "Use p = −∂F/∂V for a wall that confines particles and admits solvent. Hold temperature, particle count and reference volume fixed; all logarithm arguments and divisors are positive.",
  },
] as const;

function unsupported(cardId: string, reason: string): never {
  throw new ResultCardsError("result-support-osmotic-not-checked", `${cardId}: ${reason}`);
}

export function checkedOsmoticSupport(
  cardId: string,
  declaration: Readonly<{ conclusion: string; scope: string }>,
  conclusion: EquationRecord,
  equations: readonly EquationRecord[],
): CheckedResultSupport {
  const matches = equations.filter((record) => record.id === pressureRecord.id);
  const actual = matches[0];
  if (
    matches.length !== 1 ||
    !actual ||
    conclusion.id !== pressureRecord.id ||
    declaration.conclusion !== pressureRecord.id ||
    actual.paper !== pressureRecord.paper ||
    actual.argument !== pressureRecord.argument ||
    actual.notation !== pressureRecord.notation ||
    actual.unitSystem !== pressureRecord.unitSystem ||
    actual.tree.kind !== "relation" ||
    actual.tree.operator !== "=" ||
    JSON.stringify(actual.assumptions) !== JSON.stringify(pressureRecord.assumptions)
  )
    unsupported(
      cardId,
      "The osmotic conclusion and its declared physical premises must remain intact.",
    );

  // Check the supplied equation, never the owner's default conclusion in its place.
  const densityPressure = projectDerivationSymbols(actual.tree, (symbol) => symbol.quantityId);
  if (densityPressure.kind !== "relation")
    unsupported(cardId, "The osmotic conclusion must be a relation.");
  const report = verifyBrownianOsmotic({ ...brownianOsmoticExpressions, densityPressure });
  const checked = new Set(report.rows.filter((row) => row.status === "pass").map((row) => row.id));
  if (report.status !== "pass" || brownianOsmoticCheckRows.some((id) => !checked.has(id)))
    unsupported(
      cardId,
      "The pressure equation does not follow from the stated volume calculation.",
    );

  return {
    kind: "checked-proof",
    proofId: "bm-osmotic-volume",
    title: "Follow the independent volume factors to osmotic pressure",
    href: "/papers/brownian-motion/s2/#bm-osmotic-derivation",
    conclusion: { equationId: actual.id, title: actual.title },
    scope: declaration.scope,
    assumptions: osmoticSupportAssumptions,
  };
}
