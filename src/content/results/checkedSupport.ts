/**
 * Join result declarations to the actual proof owners used by the mass-energy reader.
 * Both owners check the supplied canonical equation records before returning. A saved title,
 * fixture chain or generated JSON payload cannot stand in for that calculation.
 *
 * These are modern teaching derivations. They are deliberately separate from projectSupport's
 * source-order DerivationChain contract: the certificates prove conditional algebra and limits,
 * never the physical premises or historical fidelity.
 */
import { buildMassEnergyElimination } from "../../equations/derivations/massEnergyElimination.ts";
import { buildMassEnergyLowSpeed } from "../../equations/derivations/massEnergyLowSpeed.ts";
import type { EquationRecord } from "../../equations/record.ts";
import { ResultCardsError } from "./printedChecks.ts";
import type { ResultCardRecord } from "./resultCards.ts";
import type { CheckedResultSupport } from "./supportDeclarations.ts";

export function checkedSupportFor(
  card: Pick<ResultCardRecord, "id" | "paper" | "arguments" | "support">,
  equations: readonly EquationRecord[],
): CheckedResultSupport | undefined {
  const declaration = card.support;
  if (declaration.kind === "no-checked-proof") return undefined;
  const conclusion = equations.find((equation) => equation.id === declaration.conclusion);
  if (
    card.paper !== "mass-energy" ||
    conclusion?.paper !== card.paper ||
    !conclusion.argument ||
    !card.arguments.includes(conclusion.argument)
  )
    throw new ResultCardsError(
      "result-support-conclusion-mismatch",
      `${card.id}: ${declaration.conclusion} is not an equation of this card's argument.`,
    );

  if (declaration.proofId === "me-ledger-elimination") {
    const proof = buildMassEnergyElimination(equations);
    if (!proof.certificate.steps.some((step) => step.equation === conclusion.id))
      throw new ResultCardsError(
        "result-support-elimination-conclusion-missing",
        `${card.id}: the ledger elimination does not establish ${conclusion.id}.`,
      );
    return {
      kind: "checked-proof",
      proofId: declaration.proofId,
      title: "Follow the two energy accounts, step by step",
      href: "/papers/mass-energy/#me-ledger-derivation",
      conclusion: { equationId: conclusion.id, title: conclusion.title },
      scope: declaration.scope,
      assumptions: proof.premises,
    };
  }

  if (declaration.proofId !== "me-low-speed-coefficient")
    throw new ResultCardsError(
      "result-support-owner-missing",
      `${card.id}: no calculation owner is registered for this proof.`,
    );
  const proof = buildMassEnergyLowSpeed(equations);
  // Use the conclusion's dependency set: the quadratic expansion does not need the
  // inertia-identification premise that the final mass conclusion requires.
  const requirements = proof.requirements.find(
    (step) =>
      step.step === (conclusion.id === "eq-model-me-mass-decrease" ? "identify" : "kinetic"),
  );
  // The factor and exact drop are inputs to this owner. Only the quadratic approximation and
  // the limiting mass coefficient are its conclusions; citing an input as proved is refused.
  if (
    !["eq-model-me-quadratic-drop", "eq-model-me-mass-decrease"].includes(conclusion.id) ||
    !proof.equationIds.includes(conclusion.id) ||
    !requirements
  )
    throw new ResultCardsError(
      "result-support-limit-conclusion-missing",
      `${card.id}: the low-speed argument does not establish ${conclusion.id}.`,
    );
  const needed = new Set(requirements.premises);
  return {
    kind: "checked-proof",
    proofId: declaration.proofId,
    title: "Follow the low-speed limit to the mass conclusion",
    href: "/papers/mass-energy/#me-low-speed-derivation",
    conclusion: { equationId: conclusion.id, title: conclusion.title },
    scope: declaration.scope,
    assumptions: proof.premises.filter((premise) => needed.has(premise.id)),
  };
}
