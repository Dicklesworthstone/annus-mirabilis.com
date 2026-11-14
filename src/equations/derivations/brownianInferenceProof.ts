/**
 * Owner of the connected conditional inversion, using the existing exact rule library.
 * A checker for isolated equalities cannot certify that this particular fit reached its estimate.
 */
import {
  brownianInferenceChain,
  brownianInferenceEquations,
  brownianInferencePremises,
} from "./brownianInference.ts";
import { structurallyEqual } from "./treeUtils.ts";
import type { DerivationChain, PremiseRef } from "./types.ts";
import { type ChainVerificationReport, verifyChain } from "./verifyChain.ts";

function samePremises(actual: readonly PremiseRef[], expected: readonly PremiseRef[]): boolean {
  return (
    actual.length === expected.length &&
    expected.every((premise) =>
      actual.some((item) => item.ref === premise.ref && item.edgeType === premise.edgeType),
    )
  );
}

function dependencyProblem(chain: DerivationChain): string | undefined {
  const expected = brownianInferenceChain;
  const first = chain.steps[0];
  const last = chain.steps.at(-1);
  if (
    chain.proofRouteId !== expected.proofRouteId ||
    chain.routeKind !== "pedagogical-reconstruction" ||
    chain.steps.length !== expected.steps.length ||
    !first ||
    !last ||
    expected.steps.some(
      (step, index) =>
        chain.steps[index]?.id !== step.id ||
        chain.steps[index]?.rule.kind !== step.rule.kind,
    )
  )
    return "The molecular-number inference requires its three named transformations in order.";
  if (!samePremises(chain.entryAssumptions, brownianInferencePremises))
    return "The inference must retain the model laws, observed-moment fit, independent inputs and positive domain as admitted premises.";
  if (!structurallyEqual(first.from, brownianInferenceEquations.matching))
    return "The inference must start from the declared observed-moment matching equation.";
  for (let index = 0; index < chain.steps.length; index++) {
    const current = chain.steps[index];
    const required = expected.steps[index];
    if (!current || !required || !samePremises(current.premiseRefs, required.premiseRefs))
      return "Every inference step must retain its declared fitting and domain premises.";
    const previous = chain.steps[index - 1];
    if (previous && !structurallyEqual(previous.to, current.from))
      return "Each inference transformation must consume the preceding result exactly.";
  }
  if (
    chain.target !== expected.target ||
    chain.targetStepId !== last.id ||
    !structurallyEqual(last.to, brownianInferenceEquations.result)
  )
    return "The inference must reach the canonical estimate, distinct from the model constant.";
  const multiply = chain.steps[1];
  if (
    first.rule.params.exact !== true ||
    multiply?.rule.params.operation !== "multiply" ||
    multiply.rule.params.simplify !== true ||
    last.rule.params.operation !== "divide" ||
    last.rule.params.simplify !== true ||
    last.rule.params.nonzeroCondition !== expected.steps[2]?.rule.params.nonzeroCondition
  )
    return "The inversion requires exact arithmetic with its explicit positive mean-square divisor.";
  return undefined;
}

/** Checks algebra conditional on fitting; no statistical or physical premise is promoted to proof. */
export function verifyBrownianInference(
  chain: DerivationChain = brownianInferenceChain,
): ChainVerificationReport {
  const report = verifyChain(chain, { isPublicationGate: true });
  const problem =
    dependencyProblem(chain) ??
    (report.stepReports.some((step) => step.verificationStatus !== "verified")
      ? "Every inference transformation requires an executable exact check."
      : undefined);
  if (!problem) return report;
  return Object.freeze({
    ...report,
    passed: false,
    isPublicationReady: false,
    errors: Object.freeze([...report.errors, problem]),
  });
}
