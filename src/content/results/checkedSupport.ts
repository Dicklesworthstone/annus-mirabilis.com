/**
 * Join result declarations to the actual proof owners used by the reader.
 * Owners check the supplied canonical equation records before returning. A saved title,
 * fixture chain or generated JSON payload cannot stand in for that calculation.
 *
 * These are teaching derivations. They are deliberately separate from projectSupport's
 * source-order graph projection: the checks establish conditional algebra and limits,
 * never the physical premises or historical fidelity.
 */
import dopplerRecord from "../../../content/equations/special-relativity/eq-model-sr-doppler-factor.json";
import frequencyRecord from "../../../content/equations/special-relativity/eq-model-sr-doppler-ratio.json";
import workIntegralRecord from "../../../content/equations/special-relativity/eq-model-sr-electron-work-integral.json";
import workResultRecord from "../../../content/equations/special-relativity/eq-model-sr-electron-work-result.json";
import densityRecord from "../../../content/equations/special-relativity/eq-model-sr-light-density.json";
import energyRecord from "../../../content/equations/special-relativity/eq-model-sr-light-energy.json";
import volumeRecord from "../../../content/equations/special-relativity/eq-model-sr-light-volume.json";
import longitudinalRecord from "../../../content/equations/special-relativity/eq-model-sr-longitudinal-mass.json";
import laboratoryRecord from "../../../content/equations/special-relativity/eq-model-sr-transverse-mass-laboratory.json";
import printedRecord from "../../../content/equations/special-relativity/eq-model-sr-transverse-mass-printed.json";
import type { Expression } from "../../equations/ast.ts";
import { buildMassEnergyElimination } from "../../equations/derivations/massEnergyElimination.ts";
import { buildMassEnergyLowSpeed } from "../../equations/derivations/massEnergyLowSpeed.ts";
import {
  srElectronLaboratory,
  srElectronLongitudinal,
  srElectronTransverse,
  srElectronWork,
} from "../../equations/derivations/srElectron.ts";
import { srLightComplexDerivation } from "../../equations/derivations/srLightComplex.ts";
import { structurallyEqual } from "../../equations/derivations/treeUtils.ts";
import type { DerivationChain } from "../../equations/derivations/types.ts";
import { verifyChain } from "../../equations/derivations/verifyChain.ts";
import type { EquationRecord } from "../../equations/record.ts";
import { ResultCardsError } from "./printedChecks.ts";
import type { ResultCardRecord } from "./resultCards.ts";
import type { CheckedResultSupport, ResultProofId } from "./supportDeclarations.ts";

type SRProofId = Extract<ResultProofId, `sr-${string}`>;
type ProofRecord = Readonly<{
  id: string;
  paper: string;
  argument: string;
  tree: unknown;
}>;
type SRProof = Readonly<{
  conclusion: string;
  title: string;
  href: string;
  records: readonly ProofRecord[];
  chains: readonly DerivationChain[];
}>;

/**
 * Each route is the one the explanation face renders. The records are the same imports its
 * owner uses; a separately supplied equation corpus must agree before its result gets support.
 * Only routes whose every transformation is executable belong here. A passing preview report
 * for authored, unchecked calculus is not a checked proof.
 */
const SR_PROOFS: Readonly<Record<SRProofId, SRProof>> = {
  "sr-light-complex-energy": {
    conclusion: energyRecord.id,
    title: "Follow the energy of the whole light packet",
    href: "/papers/special-relativity/s8/#sr-light-complex-derivation",
    records: [dopplerRecord, frequencyRecord, densityRecord, volumeRecord, energyRecord],
    chains: [srLightComplexDerivation],
  },
  "sr-electron-force-conventions": {
    conclusion: printedRecord.id,
    title: "Follow each force and acceleration back to its frame",
    href: "/papers/special-relativity/s10/#sr-electron-conventions-derivation",
    records: [longitudinalRecord, printedRecord, laboratoryRecord],
    chains: [srElectronLongitudinal, srElectronTransverse, srElectronLaboratory],
  },
  "sr-electron-work": {
    conclusion: workResultRecord.id,
    title: "Follow the force through the work integral",
    href: "/papers/special-relativity/s10/#sr-electron-work-derivation",
    records: [longitudinalRecord, workIntegralRecord, workResultRecord],
    chains: [srElectronLongitudinal, srElectronWork],
  },
};

function checkedSRSupport(
  cardId: string,
  declaration: Readonly<{ proofId: SRProofId; conclusion: string; scope: string }>,
  conclusion: EquationRecord,
  equations: readonly EquationRecord[],
): CheckedResultSupport {
  const proof = SR_PROOFS[declaration.proofId];
  if (conclusion.paper !== "special-relativity" || declaration.conclusion !== proof.conclusion)
    throw new ResultCardsError(
      "result-support-derivation-conclusion-missing",
      `${cardId}: ${declaration.proofId} does not establish ${declaration.conclusion}.`,
    );

  const records = proof.records.map((expected) => {
    const matches = equations.filter((equation) => equation.id === expected.id);
    const actual = matches[0];
    if (
      matches.length !== 1 ||
      !actual ||
      actual.paper !== expected.paper ||
      actual.argument !== expected.argument ||
      !structurallyEqual(actual.tree, expected.tree as Expression)
    )
      throw new ResultCardsError(
        "result-support-derivation-record-mismatch",
        `${cardId}: ${expected.id} is missing, repeated, or differs from the derivation's canonical equation.`,
      );
    return actual;
  });

  for (const chain of proof.chains) {
    const report = verifyChain(chain, { isPublicationGate: true });
    if (
      !report.passed ||
      !report.isPublicationReady ||
      report.stepReports.length !== chain.steps.length ||
      report.stepReports.length === 0 ||
      report.stepReports.some((step) => step.verificationStatus !== "verified")
    )
      throw new ResultCardsError(
        "result-support-derivation-not-checked",
        `${cardId}: ${chain.id} does not have a checked result for every transformation.`,
      );
  }

  // Preserve the premises authored with the equations, avoiding repeated copies when several
  // outputs share them. This is plain build output; the browser receives no checker or registry.
  const seen = new Set<string>();
  const assumptions = records.flatMap((record) => {
    const distinct = record.assumptions.filter((assumption) => {
      if (seen.has(assumption)) return false;
      seen.add(assumption);
      return true;
    });
    return distinct.length > 0
      ? [{ id: record.id, label: record.title, explanation: distinct.join(" ") }]
      : [];
  });
  return {
    kind: "checked-proof",
    proofId: declaration.proofId,
    title: proof.title,
    href: proof.href,
    conclusion: { equationId: conclusion.id, title: conclusion.title },
    scope: declaration.scope,
    assumptions,
  };
}

export function checkedSupportFor(
  card: Pick<ResultCardRecord, "id" | "paper" | "arguments" | "support">,
  equations: readonly EquationRecord[],
): CheckedResultSupport | undefined {
  const declaration = card.support;
  if (declaration.kind === "no-checked-proof") return undefined;
  const conclusion = equations.find((equation) => equation.id === declaration.conclusion);
  if (
    conclusion?.paper !== card.paper ||
    !conclusion.argument ||
    !card.arguments.includes(conclusion.argument)
  )
    throw new ResultCardsError(
      "result-support-conclusion-mismatch",
      `${card.id}: ${declaration.conclusion} is not an equation of this card's argument.`,
    );

  if (Object.hasOwn(SR_PROOFS, declaration.proofId))
    return checkedSRSupport(
      card.id,
      { ...declaration, proofId: declaration.proofId as SRProofId },
      conclusion,
      equations,
    );

  if (card.paper !== "mass-energy")
    throw new ResultCardsError(
      "result-support-conclusion-mismatch",
      `${card.id}: a mass-energy proof cannot establish this paper's result.`,
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
