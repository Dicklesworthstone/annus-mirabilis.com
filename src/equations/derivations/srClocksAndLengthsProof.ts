/** Check the whole measurement argument as well as each executable algebraic transformation. */
import type { Expression } from "../ast.ts";
import { srClockLengthChains } from "./srClocksAndLengths.ts";
import { structurallyEqual } from "./treeUtils.ts";
import type { DerivationChain, RuleApplication } from "./types.ts";
import { type ChainVerificationReport, verifyChain } from "./verifyChain.ts";

function sameRule(actual: RuleApplication, expected: RuleApplication): boolean {
  if (actual.kind !== expected.kind) return false;
  const a = actual.params, e = expected.params;
  if (actual.kind === "substitute")
    return a.targetId === e.targetId && a.citedEquality === e.citedEquality &&
      structurallyEqual(a.replacement as Expression, e.replacement as Expression);
  if (actual.kind === "add-subtract-multiply-divide")
    return a.operation === e.operation && a.simplify === true &&
      a.nonzeroCondition === e.nonzeroCondition && (a.swapSides ?? false) === (e.swapSides ?? false) &&
      structurallyEqual(a.quantity as Expression, e.quantity as Expression);
  return actual.kind === "collect" && a.exact === true;
}

function dependencyProblem(chain: DerivationChain): string | undefined {
  const expected = srClockLengthChains.find((candidate) => candidate.id === chain.id);
  if (!expected) return "Only the published clock and simultaneous-length measurement routes belong to this owner.";
  if (chain.routeKind !== expected.routeKind || chain.proofRouteId !== expected.proofRouteId)
    return "The measurement proof must retain its teaching-reconstruction identity.";
  const first = chain.steps[0], last = chain.steps.at(-1);
  if (!first || !last || chain.steps.length !== expected.steps.length ||
    chain.steps.some((step, index) => step.id !== expected.steps[index]?.id))
    return "Each measurement requires every named transformation in its published order.";
  if (!structurallyEqual(first.from, expected.steps[0]!.from))
    return "The argument must start from the admitted coordinate map at the second event.";
  if (chain.target !== expected.target || chain.targetStepId !== last.id ||
    !structurallyEqual(last.to, expected.steps.at(-1)!.to))
    return "The argument must reach its canonical measured quantity with the stated frame direction.";
  for (let index = 0; index < chain.steps.length; index++) {
    const step = chain.steps[index]!, canonical = expected.steps[index]!;
    if (!sameRule(step.rule, canonical.rule))
      return "Each transformation must retain its actual map, measurement condition, definition or nonzero divisor.";
    if (canonical.premiseRefs.some((required) => !step.premiseRefs.some((actual) =>
      actual.ref === required.ref && actual.edgeType === required.edgeType)))
      return "A measurement transformation cannot drop the premises that justify its replacement.";
    if (index > 0 && !structurallyEqual(chain.steps[index - 1]!.to, step.from))
      return "Each transformation must consume the preceding result without a disconnected replacement.";
  }
  if (expected.entryAssumptions.some((required) => !chain.entryAssumptions.some((actual) =>
    actual.ref === required.ref && actual.edgeType === required.edgeType)))
    return "The coordinate, inertial-domain and measurement assumptions must remain explicit.";
  return undefined;
}

export function verifySRClocksAndLengths(chain: DerivationChain): ChainVerificationReport {
  const report = verifyChain(chain, { isPublicationGate: true });
  const problem = dependencyProblem(chain) ??
    (report.stepReports.some((step) => step.verificationStatus !== "verified")
      ? "Every clock or length transformation needs an executable check." : undefined);
  return problem ? Object.freeze({ ...report, passed: false, isPublicationReady: false,
    errors: Object.freeze([...report.errors, problem]),
  }) : report;
}
