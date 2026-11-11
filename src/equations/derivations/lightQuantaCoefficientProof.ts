/**
 * The four-step coefficient argument, including the dependencies between its local rewrites.
 * A valid substitution proves an equality only when it consumes the count just derived and
 * supplies both sides of the equality subsequently collected.
 */
import molarEnergyRecord from "../../../content/equations/light-quanta/eq-model-lq-energy-per-point-molar.json";
import type { Expression } from "../ast.ts";
import {
  lqCoefficientComparisonInput,
  lqCoefficientCorrespondence,
  lqEnergyPerElementEquation,
} from "./lightQuantaEntropy.ts";
import { structurallyEqual } from "./treeUtils.ts";
import type { DerivationChain } from "./types.ts";
import { type ChainVerificationReport, verifyChain } from "./verifyChain.ts";

const STAGES = [
  "lq-correspondence-match-coefficients",
  "lq-correspondence-solve-effective-count",
  "lq-correspondence-substitute-effective-count",
  "lq-correspondence-energy-per-element",
] as const;

function dependencyProblem(chain: DerivationChain): string | undefined {
  const [comparison, solve, substitute, collect] = chain.steps;
  if (
    chain.steps.length !== STAGES.length ||
    !comparison ||
    !solve ||
    !substitute ||
    !collect ||
    STAGES.some((id, index) => chain.steps[index]?.id !== id)
  )
    return "The proof requires comparison, solved count, substitution and collection in order.";
  if (
    chain.target !== molarEnergyRecord.id ||
    chain.targetStepId !== collect.id ||
    comparison.rule.kind !== "add-subtract-multiply-divide" ||
    solve.rule.kind !== "add-subtract-multiply-divide" ||
    substitute.rule.kind !== "substitute" ||
    collect.rule.kind !== "collect"
  )
    return "The coefficient proof must retain its declared rules and canonical molar conclusion.";
  if (
    comparison.rule.params.simplify !== true ||
    solve.rule.params.simplify !== true ||
    collect.rule.params.exact !== true
  )
    return "The coefficient algebra requires exact arithmetic and collection checks.";
  if (!structurallyEqual(comparison.from, lqCoefficientComparisonInput))
    return "The coefficient comparison must start from the admitted canonical entropy laws.";
  if (!structurallyEqual(solve.from, comparison.to))
    return "Solving for the count must consume the preceding coefficient comparison.";

  const energyPerElement = lqEnergyPerElementEquation.left;
  if (
    energyPerElement.kind !== "quotient" ||
    energyPerElement.denominator.kind !== "symbol" ||
    solve.to.kind !== "relation" ||
    solve.to.operator !== "=" ||
    !structurallyEqual(solve.to.left, energyPerElement.denominator)
  )
    return "The solved equality must establish the effective count used by the energy quotient.";
  const replacement = substitute.rule.params.replacement as Expression | undefined;
  if (
    !replacement ||
    !structurallyEqual(substitute.from, energyPerElement) ||
    substitute.rule.params.targetId !== energyPerElement.denominator.termId ||
    !structurallyEqual(replacement, solve.to.right) ||
    !substitute.premiseRefs.some(
      (premise) => premise.ref === solve.id && premise.edgeType !== "cross-reference",
    )
  )
    return "The energy substitution must use the count proved by the preceding equality.";
  if (
    collect.from.kind !== "relation" ||
    collect.from.operator !== "=" ||
    !structurallyEqual(collect.from.left, substitute.from) ||
    !structurallyEqual(collect.from.right, substitute.to) ||
    !collect.premiseRefs.some(
      (premise) => premise.ref === substitute.id && premise.edgeType !== "cross-reference",
    )
  )
    return "The final equality must contain both sides of the proved energy substitution.";
  if (!structurallyEqual(collect.to, lqEnergyPerElementEquation))
    return "The collected equation must be the canonical molar energy-per-element conclusion.";
  return undefined;
}

/** Build-time owner: local rule checks and their producer/consumer links are both required. */
export function verifyLqCoefficientCorrespondence(
  chain: DerivationChain = lqCoefficientCorrespondence,
): ChainVerificationReport {
  const report = verifyChain(chain, { isPublicationGate: true });
  const problem =
    dependencyProblem(chain) ??
    (report.stepReports.some((step) => step.verificationStatus !== "verified")
      ? "Every coefficient-proof transformation requires an executable check."
      : undefined);
  if (!problem) return report;
  return Object.freeze({
    ...report,
    passed: false,
    isPublicationReady: false,
    errors: Object.freeze([...report.errors, problem]),
  });
}
