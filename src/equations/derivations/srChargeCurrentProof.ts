/** Validate the joined conditional §9 argument, including species-law producers. */
import type { Expression } from "../ast.ts";
import {
  srChargeCurrentChains,
  srChargeCurrentSumPremise,
  srChargeDensityChain,
  srCurrentXChain,
  srTotalChargeChain,
  srTotalCurrentChain,
} from "./srChargeCurrent.ts";
import { structurallyEqual } from "./treeUtils.ts";
import type { DerivationChain, RuleApplication } from "./types.ts";
import { type ChainVerificationReport, verifyChain } from "./verifyChain.ts";

function sameRule(actual: RuleApplication, expected: RuleApplication): boolean {
  if (actual.kind !== expected.kind) return false;
  if (actual.kind === "collect") return actual.params.exact === true;
  return actual.kind === "substitute" &&
    actual.params.targetId === expected.params.targetId &&
    actual.params.citedEquality === expected.params.citedEquality &&
    actual.params.replacement !== undefined &&
    structurallyEqual(actual.params.replacement as Expression, expected.params.replacement as Expression);
}

function dependencyProblem(actual: DerivationChain, expected: DerivationChain): string | undefined {
  if (actual.proofRouteId !== expected.proofRouteId || actual.routeKind !== expected.routeKind ||
    actual.target !== expected.target || actual.targetStepId !== expected.targetStepId)
    return "The charge/current route must retain its declared conclusion and final step.";
  if (actual.steps.length !== expected.steps.length ||
    actual.steps.some((step, index) => step.id !== expected.steps[index]?.id))
    return "The charge/current route needs every named transformation in order.";
  if (!structurallyEqual(actual.steps[0]!.from, expected.steps[0]!.from) ||
    !structurallyEqual(actual.steps.at(-1)!.to, expected.steps.at(-1)!.to))
    return "The route must start from its admitted density/current premise and reach the stated conclusion.";
  const includes = (provided: DerivationChain["entryAssumptions"], required: DerivationChain["entryAssumptions"]) =>
    required.every((premise) => provided.some((entry) => entry.ref === premise.ref && entry.edgeType === premise.edgeType));
  if (!includes(actual.entryAssumptions, expected.entryAssumptions))
    return "The source laws, species definitions, positive denominator and superposition premises must stay explicit.";
  for (let index = 0; index < actual.steps.length; index++) {
    const step = actual.steps[index]!;
    const reference = expected.steps[index]!;
    if (!sameRule(step.rule, reference.rule) || !includes(step.premiseRefs, reference.premiseRefs))
      return "Every substitution must use its admitted producer; a self-consistent invented replacement is insufficient.";
    if (index > 0 && !structurallyEqual(actual.steps[index - 1]!.to, step.from))
      return "Each charge/current step must consume the preceding result without changing it.";
  }
  return undefined;
}

/**
 * Check every producer even when publishing only a later conclusion. The total-density
 * and total-current routes begin by adding two instances of their verified species law.
 * No independent velocity of the combined mixture enters that bridge.
 */
export function verifySRChargeCurrent(
  selected: DerivationChain,
  source: readonly DerivationChain[] = srChargeCurrentChains,
): ChainVerificationReport {
  const report = verifyChain(selected, { isPublicationGate: true });
  const fail = (reason: string): ChainVerificationReport => ({ ...report, passed: false,
    isPublicationReady: false, errors: [...report.errors, reason] });
  if (source.length !== srChargeCurrentChains.length ||
    new Set(source.map((chain) => chain.id)).size !== srChargeCurrentChains.length ||
    !srChargeCurrentChains.some((chain) => chain.id === selected.id))
    return fail("The charge/current proof needs its density, three current components and two species-addition routes.");
  const family = source.map((chain) => chain.id === selected.id ? selected : chain);
  for (const expected of srChargeCurrentChains) {
    const actual = family.find((chain) => chain.id === expected.id);
    if (!actual) return fail("The charge/current argument is missing its producer " + expected.id + ".");
    const problem = dependencyProblem(actual, expected);
    if (problem) return fail(problem);
    const checked = actual.id === selected.id ? report : verifyChain(actual, { isPublicationGate: true });
    if (!checked.passed || !checked.isPublicationReady || checked.stepReports.length !== actual.steps.length ||
      checked.stepReports.some((step) => step.verificationStatus !== "verified"))
      return fail("The producer " + actual.id + " does not have an exact check for every transformation.");
  }
  for (const [total, producer] of [[srTotalChargeChain, srChargeDensityChain], [srTotalCurrentChain, srCurrentXChain]]) {
    const conclusion = family.find((chain) => chain.id === producer!.id)!.steps.at(-1)!.to;
    const startingSum = family.find((chain) => chain.id === total!.id)!.steps[0]!.from;
    if (conclusion.kind !== "relation" || !structurallyEqual(startingSum, srChargeCurrentSumPremise(conclusion)))
      return fail("The mixture must add the verified species laws at the same event and boost.");
  }
  return report;
}
