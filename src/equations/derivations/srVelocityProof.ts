/**
 * Join the checked local transformations into the two published velocity arguments.
 * The canonical maps, admitted definitions and nonzero conditions stay part of the proof.
 */
import {
  srVelocityChains,
} from "./srVelocityComposition.ts";
import { structurallyEqual } from "./treeUtils.ts";
import type { DerivationChain, RuleApplication } from "./types.ts";
import type { Expression } from "../ast.ts";
import { type ChainVerificationReport, verifyChain } from "./verifyChain.ts";

function sameRule(actual: RuleApplication, expected: RuleApplication): boolean {
  if (actual.kind !== expected.kind) return false;
  const a = actual.params;
  const e = expected.params;
  if (actual.kind === "substitute")
    return a.targetId === e.targetId &&
      a.citedEquality === e.citedEquality &&
      structurallyEqual(a.replacement as Expression, e.replacement as Expression);
  if (actual.kind === "add-subtract-multiply-divide")
    return a.operation === e.operation &&
      a.simplify === true &&
      a.nonzeroCondition === e.nonzeroCondition &&
      (a.swapSides ?? false) === (e.swapSides ?? false) &&
      structurallyEqual(a.quantity as Expression, e.quantity as Expression);
  return actual.kind === "collect" && a.exact === true;
}

function dependencyProblem(chain: DerivationChain): string | undefined {
  const expected = srVelocityChains.find((candidate) => candidate.id === chain.id);
  if (!expected)
    return "Only the published longitudinal and transverse velocity routes belong to this owner.";
  if (chain.routeKind !== expected.routeKind || chain.proofRouteId !== expected.proofRouteId)
    return "The velocity proof must retain its pedagogical reconstruction route identity.";
  const first = chain.steps[0];
  const last = chain.steps.at(-1);
  if (!first || !last || chain.steps.length !== expected.steps.length ||
    chain.steps.some((step, index) => step.id !== expected.steps[index]?.id))
    return "The velocity proof needs every named transformation in its published order.";
  if (!structurallyEqual(first.from, expected.steps[0]!.from))
    return "The velocity proof must start from its admitted worldline or canonical inverse time map.";
  if (chain.target !== expected.target || chain.targetStepId !== last.id ||
    !structurallyEqual(last.to, expected.steps.at(-1)!.to))
    return "The velocity proof must reach the canonical component in the stated frame direction.";
  for (let index = 0; index < chain.steps.length; index++) {
    const step = chain.steps[index]!;
    const canonical = expected.steps[index]!;
    if (!sameRule(step.rule, canonical.rule))
      return "Each operation must retain its canonical substitution, exact arithmetic and nonzero condition.";
    if (canonical.premiseRefs.some((required) =>
      !step.premiseRefs.some((actual) => actual.ref === required.ref && actual.edgeType === required.edgeType)))
      return "Each transformation must retain its admitted coordinate, domain and preceding-step premises.";
    if (index > 0 && !structurallyEqual(chain.steps[index - 1]!.to, step.from))
      return "Each velocity transformation must consume the preceding result exactly.";
  }
  if (expected.entryAssumptions.some((required) =>
    !chain.entryAssumptions.some((actual) => actual.ref === required.ref && actual.edgeType === required.edgeType)))
    return "The velocity proof must retain its frame, worldline and nonzero-time assumptions.";
  return undefined;
}

/** Exact algebra conditional on the declared §3 map and physical domain; no empirical claim. */
export function verifySRVelocityComposition(chain: DerivationChain): ChainVerificationReport {
  const report = verifyChain(chain, { isPublicationGate: true });
  const problem = dependencyProblem(chain) ??
    (report.stepReports.some((step) => step.verificationStatus !== "verified")
      ? "Every velocity transformation needs an executable check."
      : undefined);
  if (!problem) return report;
  return Object.freeze({
    ...report,
    passed: false,
    isPublicationReady: false,
    errors: Object.freeze([...report.errors, problem]),
  });
}
