/**
 * Conditional proof of §4 from the admitted Wien law and entropy-temperature identity.
 * Every algebraic/calculus transformation consumes its predecessor. The integration
 * constant is retained, its zero-density limit is proved, and only then is the
 * fixed-energy, fixed-band volume difference formed. No photon law is assumed.
 */
import volumeRecord from "../../../content/equations/light-quanta/eq-model-lq-volume-entropy.json";
import type { Expression } from "../ast.ts";
import {
  lqVolumeEntropyResult,
  lqWienEntropyDerivation,
  lqWienProofInputs,
} from "./lightQuantaEntropy.ts";
import { logarithmicCalculus } from "./logarithmicCalculus.ts";
import { checkRationalSimplification } from "./rationalSimplification.ts";
import { structurallyEqual, substituteNode } from "./treeUtils.ts";
import type { DerivationChain, DerivationStep } from "./types.ts";
import {
  type ChainVerificationReport,
  type StepVerificationReport,
  verifyChain,
} from "./verifyChain.ts";

type Relation = Extract<Expression, { kind: "relation" }>;
const STAGES = [
  ["lq-wien-normalize-spectrum", "add-subtract-multiply-divide"],
  ["lq-wien-take-logarithms", "monotonic-function"],
  ["lq-wien-invert-exponential", "registered-identity"],
  ["lq-wien-isolate-inverse-temperature", "add-subtract-multiply-divide"],
  ["lq-wien-use-entropy-slope", "substitute"],
  ["lq-wien-integrate-with-constant", "integrate"],
  ["lq-wien-fix-zero-density-boundary", "substitute"],
  ["lq-wien-remove-fixed-constant", "collect"],
  ["lq-wien-hold-energy-and-band", "add-subtract-multiply-divide"],
  ["lq-wien-subtract-reference-volume", "add-subtract-multiply-divide"],
  ["lq-wien-collect-volume-ratio", "collect"],
] as const;
const PREMISES = [
  "arg-lq-wien-integration",
  "arg-lq-entropy-temperature",
  "lq-positive-wien-domain",
  "lq-zero-density-entropy-boundary",
  "lq-fixed-energy-frequency-band",
] as const;
const zero: Expression = { kind: "number", value: "0" };
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const negative = (argument: Expression): Expression => ({ kind: "negate", argument });
const difference = (left: Expression, right: Expression): Expression =>
  ({ kind: "sum", args: [left, negative(right)] });
const quotient = (numerator: Expression, denominator: Expression): Expression =>
  ({ kind: "quotient", numerator, denominator });
const exact = (left: Expression, right: Expression): boolean =>
  checkRationalSimplification(left, right).outcome === "equal";
const cites = (step: DerivationStep, ref: string): boolean =>
  step.premiseRefs.some((premise) => premise.ref === ref && premise.edgeType !== "cross-reference");

function dependencyProblem(chain: DerivationChain): string | undefined {
  if (chain.steps.length !== STAGES.length || STAGES.some(([id, kind], i) =>
    chain.steps[i]?.id !== id || chain.steps[i]?.rule.kind !== kind))
    return "The Wien entropy proof requires its eleven named transformations in order.";
  if (PREMISES.some((ref) => !chain.entryAssumptions.some((premise) =>
    premise.ref === ref && premise.edgeType !== "cross-reference")))
    return "The proof requires Wien's law, thermodynamics, the positive domain, the zero-density boundary and the fixed band as explicit premises.";
  if (!structurallyEqual(chain.steps[0]!.from, lqWienProofInputs.spectrum))
    return "The proof must begin at the canonical admitted Wien spectrum.";
  for (let i = 0; i < chain.steps.length; i++) {
    const step = chain.steps[i]!;
    if (step.from.kind !== "relation" || step.from.operator !== "=" ||
        step.to.kind !== "relation" || step.to.operator !== "=")
      return "Each Wien transformation must preserve an exact equality within the admitted model.";
    if (i > 0 && !structurallyEqual(chain.steps[i - 1]!.to, step.from))
      return "Each Wien transformation must consume its predecessor's complete result.";
  }
  if (chain.target !== volumeRecord.id || chain.targetStepId !== STAGES.at(-1)![0] ||
      !structurallyEqual(chain.steps.at(-1)!.to, lqVolumeEntropyResult))
    return "The proof must conclude at the canonical fixed-energy entropy-volume equation.";
  return undefined;
}

/**
 * General chain checks retain schema, graph, rule and anti-circularity failures. This owner
 * additionally proves its bounded calculus rather than assigning a fictitious review record
 * to a generic 'integrate' step. A generic rule failure is never replaced by a specialist pass.
 */
export function verifyLqWienEntropy(
  chain: DerivationChain = lqWienEntropyDerivation,
): ChainVerificationReport {
  const report = verifyChain(chain);
  const problem = dependencyProblem(chain);
  if (problem) return Object.freeze({
    ...report,
    passed: false,
    isPublicationReady: false,
    errors: Object.freeze([...report.errors, problem]),
  });
  const p = lqWienProofInputs;
  const calculus = logarithmicCalculus({
    positive: [p.rho, p.nu, p.A, p.B, p.E, p.dNu, p.V, p.V0],
    constants: [p.C],
  });
  function check(index: number): string | undefined {
    const step = chain.steps[index]!;
    const from = step.from as Relation;
    const to = step.to as Relation;
    const params = step.rule.params;
    const unchangedLeft = () => structurallyEqual(from.left, to.left);
    switch (index) {
      case 0:
        if (params.operation !== "divide" ||
            !structurallyEqual(params.quantity as Expression, p.prefactor) ||
            !exact(quotient(from.left, p.prefactor), to.left) ||
            !exact(quotient(from.right, p.prefactor), to.right))
          return "Normalizing Wien's law must divide both sides by the same positive Aν³.";
        return undefined;
      case 1:
      case 2:
        return report.stepReports[index]?.verificationStatus === "verified"
          ? undefined : "The positive logarithm and its inverse require their structural identity checks.";
      case 3:
        if (params.operation !== "divide" ||
            !structurallyEqual(params.quantity as Expression, negative(p.betaNu)) ||
            !structurallyEqual(to.left, p.entropyTemperature.right) ||
            !exact(quotient(from.right, negative(p.betaNu)), to.left) ||
            !exact(quotient(from.left, negative(p.betaNu)), to.right))
          return "Inverse temperature must follow by division by −Bν and exchange of sides.";
        return undefined;
      case 4:
        if (!cites(step, "arg-lq-entropy-temperature") ||
            !structurallyEqual(from.left, p.entropyTemperature.right) ||
            !structurallyEqual(to.left, p.entropyTemperature.left) ||
            !structurallyEqual(from.right, to.right))
          return "Use the canonical entropy derivative at fixed frequency as the thermodynamic premise.";
        return undefined;
      case 5: {
        if (from.left.kind !== "derivative" ||
            !structurallyEqual(from.left, p.entropyTemperature.left) ||
            !structurallyEqual(to.left, from.left.expression) ||
            params.variable !== p.rho.termId || params.integrationConstant !== p.C.termId ||
            !calculus.differentiatesTo(to.right, p.rho, from.right) ||
            !calculus.tendsToAtZero(to.right, p.rho, p.C))
          return "The antiderivative must recover the fixed-frequency slope and retain exactly C(ν) as its zero-density constant.";
        return undefined;
      }
      case 6:
        if (!cites(step, "lq-zero-density-entropy-boundary") ||
            step.reasonKind !== "boundary-condition" || params.targetId !== p.C.termId ||
            !structurallyEqual(params.replacement as Expression, zero) || !unchangedLeft() ||
            !calculus.tendsToAtZero(from.right, p.rho, p.C) ||
            !calculus.equal(to.right, substituteNode(from.right, p.C.termId, zero)))
          return "The admitted zero-density boundary must set C(ν) to zero after its one-sided limit is established.";
        return undefined;
      case 7:
        if (!unchangedLeft() || !calculus.equal(from.right, to.right))
          return "Removing the fixed constant must preserve the entropy density exactly.";
        return undefined;
      case 8: {
        const bandVolume = product(p.V, p.dNu);
        const density = quotient(p.E, bandVolume);
        const total = product(bandVolume, substituteNode(from.right, p.rho.termId, density));
        if (!cites(step, "lq-fixed-energy-frequency-band") ||
            params.operation !== "multiply" ||
            !structurallyEqual(params.quantity as Expression, bandVolume) ||
            !structurallyEqual(to.left, p.S) || !calculus.equal(total, to.right))
          return "Total entropy must use ρν = E/(VΔν) and S(V) = VΔνsν with the same fixed energy and band.";
        return undefined;
      }
      case 9: {
        const reference = substituteNode(from.right, p.V.termId, p.V0);
        if (!cites(step, "lq-fixed-energy-frequency-band") ||
            params.operation !== "subtract" ||
            !structurallyEqual(params.quantity as Expression, p.S0) ||
            !structurallyEqual(to.left, difference(from.left, p.S0)) ||
            !calculus.equal(to.right, difference(from.right, reference)))
          return "The reference entropy must change only V to V₀ and be subtracted with the same E, ν and Δν.";
        return undefined;
      }
      case 10:
        if (!unchangedLeft() || !calculus.equal(from.right, to.right))
          return "The exact positive-log identity must yield +(E/Bν) ln(V/V₀), including equal volumes.";
        return undefined;
      default:
        return "No proof is registered for this transformation.";
    }
  }
  const stepReports: StepVerificationReport[] = report.stepReports.map((base, index) => {
    if (base.verificationStatus === "failed") return base;
    let error: string | undefined;
    try {
      error = check(index);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "The exact logarithmic proof refused this expression.";
    }
    return error
      ? { stepId: base.stepId, ruleKind: base.ruleKind, ruleOutcome: "fail",
          verificationStatus: "failed", passed: false, error }
      : { stepId: base.stepId, ruleKind: base.ruleKind, ruleOutcome: "pass",
          verificationStatus: "verified", passed: true };
  });
  const passed = report.errors.length === 0 && report.graphIssues.length === 0 &&
    stepReports.length === STAGES.length && stepReports.every((step) => step.passed);
  return Object.freeze({ ...report, passed, isPublicationReady: passed,
    stepReports: Object.freeze(stepReports) });
}
