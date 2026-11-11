/**
 * Join result declarations to the actual proof owners used by the reader.
 * Owners check the supplied canonical equation records before returning. A saved title,
 * fixture chain or generated JSON payload cannot stand in for that calculation.
 *
 * These are teaching derivations. They are deliberately separate from projectSupport's
 * source-order graph projection: the checks establish conditional algebra and limits,
 * never the physical premises or historical fidelity.
 */
import brownianMolarRecord from "../../../content/equations/brownian-motion/eq-model-bm-diffusivity-molar.json";
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
import { brownianEquilibriumDerivation } from "../../equations/derivations/brownianSource.ts";
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

type DerivationProofId = Extract<ResultProofId, `sr-${string}` | `bm-${string}`>;
type ProofRecord = Readonly<{
  id: string;
  paper: string;
  argument: string;
  tree: unknown;
  assumptions: readonly string[];
}>;
type DerivationProof = Readonly<{
  paper: string;
  conclusion: string;
  title: string;
  href: string;
  records: readonly ProofRecord[];
  chains: readonly DerivationChain[];
  premises?: CheckedResultSupport["assumptions"];
}>;

/**
 * Each route is the one the explanation face renders. The records are the same imports its
 * owner uses; a separately supplied equation corpus must agree before its result gets support.
 * Only routes whose every transformation is executable belong here. A passing preview report
 * for authored, unchecked calculus is not a checked proof.
 */
const DERIVATION_PROOFS: Readonly<Record<DerivationProofId, DerivationProof>> = {
  "bm-equilibrium-diffusivity": {
    paper: "brownian-motion",
    conclusion: brownianMolarRecord.id,
    title: "Follow the equilibrium balance to the diffusion coefficient",
    href: "/papers/brownian-motion/s3/#bm-equilibrium-derivation",
    records: [brownianMolarRecord],
    chains: [brownianEquilibriumDerivation],
    premises: [
      {
        id: "arg-bm-osmotic-suspended",
        label: "Dilute osmotic law",
        explanation:
          "The suspension is dilute and its particles are independent. The admitted osmotic " +
          "law is Π = nRT/N, with uniform positive absolute temperature.",
      },
      {
        id: "bm-isothermal-osmotic-equilibrium",
        label: "The same equilibrium in both descriptions",
        explanation:
          "The isothermal force balance and zero total particle flux describe the same " +
          "weak-force equilibrium. The thermodynamic construction of that state remains a premise.",
      },
      {
        id: "bm-drift-particle-flux",
        label: "Drift counts particles",
        explanation:
          "The drift particle flux is J_drift = nbK. It is compared with a particle flux, " +
          "rather than a mass flux or a velocity inferred from an irregular trajectory.",
      },
      {
        id: "bm-fick-flux",
        label: "Fick's diffusive flux",
        explanation:
          "The admitted transport law is J_diff = −D ∂n/∂x. At equilibrium it cancels the drift.",
      },
      {
        id: "bm-stokes-drag-dilute-spheres",
        label: "Stokes mobility and its domain",
        explanation:
          "The independently supplied mobility is b = 1/(6πηa), for dilute spheres in a " +
          "Newtonian liquid with slow no-slip drift. Viscosity, radius and N are positive.",
      },
      {
        id: "bm-nonzero-gradient-comparison",
        label: "A nonzero comparison gradient",
        explanation:
          "Cancelling ∂n/∂x requires a nonzero gradient in the selected weak-force equilibrium. " +
          "A uniform zero-force state gives 0 = 0 and does not determine D. Applying the " +
          "coefficient in that limit retains the linear-response model assumption.",
      },
    ],
  },
  "sr-light-complex-energy": {
    paper: "special-relativity",
    conclusion: energyRecord.id,
    title: "Follow the energy of the whole light packet",
    href: "/papers/special-relativity/s8/#sr-light-complex-derivation",
    records: [dopplerRecord, frequencyRecord, densityRecord, volumeRecord, energyRecord],
    chains: [srLightComplexDerivation],
  },
  "sr-electron-force-conventions": {
    paper: "special-relativity",
    conclusion: printedRecord.id,
    title: "Follow each force and acceleration back to its frame",
    href: "/papers/special-relativity/s10/#sr-electron-conventions-derivation",
    records: [longitudinalRecord, printedRecord, laboratoryRecord],
    chains: [srElectronLongitudinal, srElectronTransverse, srElectronLaboratory],
  },
  "sr-electron-work": {
    paper: "special-relativity",
    conclusion: workResultRecord.id,
    title: "Follow the force through the work integral",
    href: "/papers/special-relativity/s10/#sr-electron-work-derivation",
    records: [longitudinalRecord, workIntegralRecord, workResultRecord],
    chains: [srElectronLongitudinal, srElectronWork],
  },
};

function checkedDerivationSupport(
  cardId: string,
  declaration: Readonly<{ proofId: DerivationProofId; conclusion: string; scope: string }>,
  conclusion: EquationRecord,
  equations: readonly EquationRecord[],
): CheckedResultSupport {
  const proof = DERIVATION_PROOFS[declaration.proofId];
  if (conclusion.paper !== proof.paper || declaration.conclusion !== proof.conclusion)
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
      !structurallyEqual(actual.tree, expected.tree as Expression) ||
      JSON.stringify(actual.assumptions) !== JSON.stringify(expected.assumptions)
    )
      throw new ResultCardsError(
        "result-support-derivation-record-mismatch",
        `${cardId}: ${expected.id} is missing, repeated, or differs from the derivation's canonical equation or premises.`,
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
    assumptions: [...(proof.premises ?? []), ...assumptions],
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

  if (Object.hasOwn(DERIVATION_PROOFS, declaration.proofId))
    return checkedDerivationSupport(
      card.id,
      { ...declaration, proofId: declaration.proofId as DerivationProofId },
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
