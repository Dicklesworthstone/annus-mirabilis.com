/**
 * Check the joined §8 reflection and moving-boundary energy argument.
 * A local substitution may correctly apply an invented value. Bind each replacement
 * to its admitted wave transformation or previously established producer, retain the
 * interception premises, and keep the nonzero-speed work division separate from the
 * stationary continuity premise. Exact algebra does not establish physical premises.
 */
import type { Expression } from "../ast.ts";
import { checkRationalSimplification } from "./rationalSimplification.ts";
import {
  srMirrorCanonicalFrequency,
  srMirrorChains,
  srMirrorFrequency,
} from "./srMirror.ts";
import { structurallyEqual } from "./treeUtils.ts";
import type { DerivationChain, RuleApplication } from "./types.ts";
import { type ChainVerificationReport, verifyChain } from "./verifyChain.ts";

/** Refuse the reversed ratio, an approximate equality, or the printed denominator error. */
export function checkSRMirrorCanonicalFrequency(
  canonical: Expression = srMirrorCanonicalFrequency,
): boolean {
  return (
    canonical.kind === "relation" &&
    canonical.operator === "=" &&
    canonical.left.kind === "quotient" &&
    canonical.left.numerator.kind === "symbol" &&
    canonical.left.numerator.quantityId === "waveFrequencyReflectedStationary" &&
    canonical.left.denominator.kind === "symbol" &&
    canonical.left.denominator.quantityId === "waveFrequencyStationary" &&
    checkRationalSimplification(canonical.right, srMirrorFrequency.right).outcome === "equal"
  );
}

function sameRule(actual: RuleApplication, expected: RuleApplication): boolean {
  if (actual.kind !== expected.kind) return false;
  const a = actual.params;
  const e = expected.params;
  if (actual.kind === "substitute")
    return (
      a.targetId === e.targetId &&
      a.citedEquality === e.citedEquality &&
      a.replacement !== undefined &&
      structurallyEqual(a.replacement as Expression, e.replacement as Expression)
    );
  if (actual.kind === "add-subtract-multiply-divide")
    return (
      a.operation === e.operation &&
      a.simplify === true &&
      a.nonzeroCondition === e.nonzeroCondition &&
      a.swapSides === e.swapSides &&
      a.quantity !== undefined &&
      structurallyEqual(a.quantity as Expression, e.quantity as Expression)
    );
  return actual.kind === "collect" && a.exact === true;
}

const includesPremises = (
  actual: DerivationChain["entryAssumptions"],
  needed: DerivationChain["entryAssumptions"],
): boolean =>
  needed.every((premise) =>
    actual.some((entry) => entry.ref === premise.ref && entry.edgeType === premise.edgeType),
  );

function dependencyProblem(actual: DerivationChain, expected: DerivationChain): string | undefined {
  if (
    actual.proofRouteId !== expected.proofRouteId ||
    actual.routeKind !== expected.routeKind ||
    actual.target !== expected.target ||
    actual.targetStepId !== expected.targetStepId
  )
    return "The mirror route must retain its declared identity, conclusion and final step.";
  if (
    actual.steps.length !== expected.steps.length ||
    actual.steps.some((step, index) => step.id !== expected.steps[index]?.id)
  )
    return "The mirror argument needs every named transformation in order.";
  if (
    !structurallyEqual(actual.steps[0]!.from, expected.steps[0]!.from) ||
    !structurallyEqual(actual.steps.at(-1)!.to, expected.steps.at(-1)!.to)
  )
    return "Each mirror route must start from its admitted producer and reach its stated conclusion.";
  if (!includesPremises(actual.entryAssumptions, expected.entryAssumptions))
    return "The wave, interception, moving-surface, work and continuity premises must remain explicit.";
  for (let index = 0; index < actual.steps.length; index++) {
    const step = actual.steps[index]!;
    const reference = expected.steps[index]!;
    if (
      !sameRule(step.rule, reference.rule) ||
      !includesPremises(step.premiseRefs, reference.premiseRefs)
    )
      return "Every operation must use its admitted producer, exact arithmetic and nonzero condition.";
    if (step.isMove !== reference.isMove || step.moveLabel !== reference.moveLabel)
      return "The rest-frame reflection must remain the explicitly marked physical move.";
    if (index > 0 && !structurallyEqual(actual.steps[index - 1]!.to, step.from))
      return "Every mirror transformation must consume the preceding result without changing it.";
  }
  return undefined;
}

/**
 * A selected route is supported only when the full family is sound. A faulty direction
 * producer therefore invalidates the downstream energy account even if an isolated
 * frequency chain still passes. Family parameters let mutation tests exercise that link.
 */
export function verifySRMirror(
  selected: DerivationChain,
  source: readonly DerivationChain[] = srMirrorChains,
  canonicalFrequency: Expression = srMirrorCanonicalFrequency,
): ChainVerificationReport {
  const report = verifyChain(selected, { isPublicationGate: true });
  const fail = (problem: string): ChainVerificationReport => ({
    ...report,
    passed: false,
    isPublicationReady: false,
    errors: [...report.errors, problem],
  });
  if (!checkSRMirrorCanonicalFrequency(canonicalFrequency))
    return fail("The canonical reflected-to-incident ratio must equal the exact §8 conclusion.");
  if (
    source.length !== srMirrorChains.length ||
    new Set(source.map((chain) => chain.id)).size !== srMirrorChains.length ||
    !srMirrorChains.some((chain) => chain.id === selected.id)
  )
    return fail("The mirror proof needs exactly its six declared reflection and energy routes.");
  const family = source.map((chain) => (chain.id === selected.id ? selected : chain));
  for (const expected of srMirrorChains) {
    const actual = family.find((chain) => chain.id === expected.id);
    if (!actual) return fail("The mirror argument is missing its producer " + expected.id + ".");
    const problem = dependencyProblem(actual, expected);
    if (problem) return fail(problem);
    const checked =
      actual.id === selected.id ? report : verifyChain(actual, { isPublicationGate: true });
    if (
      !checked.passed ||
      !checked.isPublicationReady ||
      checked.stepReports.length !== actual.steps.length ||
      checked.stepReports.some((step) => step.verificationStatus !== "verified")
    )
      return fail("The producer " + actual.id + " lacks an exact check for every transformation.");
  }
  return report;
}
