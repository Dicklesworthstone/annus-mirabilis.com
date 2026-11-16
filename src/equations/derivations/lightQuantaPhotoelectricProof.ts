/** Check the connected energy argument, including the admitted meaning of its substitution. */
import {
  photoelectricChain,
  photoelectricEquations,
  photoelectricPremises,
} from "./lightQuantaPhotoelectric.ts";
import { structurallyEqual } from "./treeUtils.ts";
import type { DerivationChain, PremiseRef } from "./types.ts";
import { type ChainVerificationReport, verifyChain } from "./verifyChain.ts";

function samePremises(actual: readonly PremiseRef[], expected: readonly PremiseRef[]): boolean {
  return (
    actual.length === expected.length &&
    expected.every((item) => actual.some((p) => p.ref === item.ref && p.edgeType === item.edgeType))
  );
}

function dependencyProblem(chain: DerivationChain): string | undefined {
  const expected = photoelectricChain;
  if (
    chain.id !== expected.id ||
    chain.proofRouteId !== expected.proofRouteId ||
    chain.routeKind !== "pedagogical-reconstruction" ||
    chain.steps.length !== expected.steps.length ||
    expected.steps.some(
      (step, index) =>
        chain.steps[index]?.id !== step.id || chain.steps[index]?.rule.kind !== step.rule.kind,
    )
  )
    return "The photoelectric argument requires its three named transformations in order.";
  if (!samePremises(chain.entryAssumptions, photoelectricPremises))
    return "Retain whole-quantum transfer, the attainable lossless edge, the physical domain and retarding work as premises.";
  const [subtract, substitute, divide] = chain.steps;
  if (!subtract || !substitute || !divide) return "The complete energy argument is required.";
  if (
    !structurallyEqual(subtract.from, photoelectricEquations.budget) ||
    !structurallyEqual(subtract.to, photoelectricEquations.maximum)
  )
    return "Begin with the admitted optimal energy budget and derive the canonical maximum energy.";
  for (let index = 0; index < chain.steps.length; index++) {
    const current = chain.steps[index];
    const required = expected.steps[index];
    if (!current || !required || !samePremises(current.premiseRefs, required.premiseRefs))
      return "Every step must retain the physical and domain premises that justify it.";
    const previous = chain.steps[index - 1];
    if (previous && !structurallyEqual(previous.to, current.from))
      return "Every energy transformation must consume the preceding result exactly.";
  }
  if (
    subtract.rule.params.operation !== "subtract" ||
    subtract.rule.params.simplify !== true ||
    !structurallyEqual(
      subtract.rule.params.quantity as typeof photoelectricEquations.work,
      photoelectricEquations.work,
    )
  )
    return "Subtract the same escape work on both sides, using exact arithmetic.";
  if (
    substitute.rule.params.targetId !== photoelectricEquations.kineticEnergy.termId ||
    substitute.rule.params.citedEquality !== expected.steps[1]?.rule.params.citedEquality ||
    !structurallyEqual(
      substitute.rule.params.replacement as typeof photoelectricEquations.work,
      photoelectricEquations.electricalWork.left,
    ) ||
    !structurallyEqual(substitute.to, photoelectricEquations.stoppingEnergy)
  )
    return "The substitution must use the independently admitted e V_s = K_max, with positive charge magnitude.";
  if (
    divide.rule.params.operation !== "divide" ||
    divide.rule.params.simplify !== true ||
    divide.rule.params.nonzeroCondition !== expected.steps[2]?.rule.params.nonzeroCondition ||
    !structurallyEqual(
      divide.rule.params.quantity as typeof photoelectricEquations.charge,
      photoelectricEquations.charge,
    )
  )
    return "Isolating the stopping potential requires division by the strictly positive charge magnitude.";
  if (
    chain.target !== expected.target ||
    chain.targetStepId !== divide.id ||
    !structurallyEqual(divide.to, photoelectricEquations.stoppingVoltage)
  )
    return "The connected argument must reach the canonical stopping-energy relation solved for its voltage magnitude.";
  return undefined;
}

/** The canonical nested stopping equality is validated by the setup; its isolated form is proved here. */
export function verifyPhotoelectric(
  chain: DerivationChain = photoelectricChain,
): ChainVerificationReport {
  const report = verifyChain(chain, { isPublicationGate: true });
  const problem =
    dependencyProblem(chain) ??
    (report.stepReports.some((step) => step.verificationStatus !== "verified")
      ? "Every photoelectric transformation requires an executable exact check."
      : undefined);
  return problem
    ? Object.freeze({
        ...report,
        passed: false,
        isPublicationReady: false,
        errors: Object.freeze([...report.errors, problem]),
      })
    : report;
}
