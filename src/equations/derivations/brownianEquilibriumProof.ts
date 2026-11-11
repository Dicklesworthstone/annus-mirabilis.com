/**
 * Compose the seven equilibrium transformations, retaining the admitted starting balance.
 * Local checks alone do not show that the result of one step was used by the next.
 */
import molarRecord from "../../../content/equations/brownian-motion/eq-model-bm-diffusivity-molar.json";
import {
  brownianEquilibriumDerivation,
  brownianEquilibriumInput,
  brownianEquilibriumResult,
} from "./brownianSource.ts";
import { structurallyEqual } from "./treeUtils.ts";
import type { DerivationChain } from "./types.ts";
import { type ChainVerificationReport, verifyChain } from "./verifyChain.ts";

const STAGES = [
  ["bm-equilibrium-read-pressure-balance", "add-subtract-multiply-divide"],
  ["bm-equilibrium-multiply-by-mobility", "add-subtract-multiply-divide"],
  ["bm-equilibrium-name-drift-flux", "substitute"],
  ["bm-equilibrium-match-opposing-fluxes", "substitute"],
  ["bm-equilibrium-cancel-nonzero-gradient", "add-subtract-multiply-divide"],
  ["bm-equilibrium-insert-stokes-mobility", "substitute"],
  ["bm-equilibrium-collect-diffusivity", "collect"],
] as const;

function dependencyProblem(chain: DerivationChain): string | undefined {
  const first = chain.steps[0];
  const last = chain.steps.at(-1);
  if (
    chain.steps.length !== STAGES.length ||
    !first ||
    !last ||
    STAGES.some(
      ([id, kind], index) =>
        chain.steps[index]?.id !== id || chain.steps[index]?.rule.kind !== kind,
    )
  )
    return "The equilibrium proof requires its seven named transformations in order.";
  if (!structurallyEqual(first.from, brownianEquilibriumInput))
    return "The equilibrium proof must start from the admitted isothermal osmotic balance.";
  for (let index = 1; index < chain.steps.length; index++) {
    const previous = chain.steps[index - 1];
    const current = chain.steps[index];
    if (!previous || !current || !structurallyEqual(previous.to, current.from))
      return "Each equilibrium transformation must consume the preceding result exactly.";
  }
  if (
    chain.target !== molarRecord.id ||
    chain.targetStepId !== last.id ||
    !structurallyEqual(last.to, brownianEquilibriumResult)
  )
    return "The equilibrium proof must reach the canonical molar diffusivity equation.";
  if (
    chain.steps.some(
      (step) =>
        step.rule.kind === "add-subtract-multiply-divide" && step.rule.params.simplify !== true,
    ) ||
    last.rule.params.exact !== true
  )
    return "The equilibrium algebra requires exact arithmetic and collection checks.";
  return undefined;
}

/** Build-time owner: conditional physics, checked arithmetic and a connected chain of results. */
export function verifyBrownianEquilibrium(
  chain: DerivationChain = brownianEquilibriumDerivation,
): ChainVerificationReport {
  const report = verifyChain(chain, { isPublicationGate: true });
  const problem =
    dependencyProblem(chain) ??
    (report.stepReports.some((step) => step.verificationStatus !== "verified")
      ? "Every equilibrium transformation requires an executable check."
      : undefined);
  if (!problem) return report;
  return Object.freeze({
    ...report,
    passed: false,
    isPublicationReady: false,
    errors: Object.freeze([...report.errors, problem]),
  });
}
