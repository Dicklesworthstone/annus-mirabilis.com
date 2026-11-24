/** Exact algebra and dependency checks for the stated pair-of-events teaching route. */
import type { Expression } from "../ast.ts";
import { srSimultaneityChain } from "./srSimultaneity.ts";
import { structurallyEqual } from "./treeUtils.ts";
import type { DerivationChain, RuleApplication } from "./types.ts";
import { type ChainVerificationReport, verifyChain } from "./verifyChain.ts";

function sameRule(actual: RuleApplication, expected: RuleApplication): boolean {
  if (actual.kind !== expected.kind) return false;
  const a = actual.params,
    e = expected.params;
  if (actual.kind === "substitute")
    return (
      a.targetId === e.targetId &&
      a.citedEquality === e.citedEquality &&
      a.replacement != null &&
      structurallyEqual(a.replacement as Expression, e.replacement as Expression)
    );
  if (actual.kind === "add-subtract-multiply-divide")
    return (
      a.operation === e.operation &&
      a.simplify === true &&
      (a.swapSides ?? false) === false &&
      a.quantity != null &&
      structurallyEqual(a.quantity as Expression, e.quantity as Expression)
    );
  return actual.kind === "collect" && a.exact === true;
}

function dependencyProblem(chain: DerivationChain): string | undefined {
  const expected = srSimultaneityChain;
  if (
    chain.id !== expected.id ||
    chain.routeKind !== expected.routeKind ||
    chain.proofRouteId !== expected.proofRouteId
  )
    return "This owner checks the teaching consequence of the admitted time map, not the earlier source-order argument.";
  const first = chain.steps[0],
    last = chain.steps.at(-1);
  if (
    !first ||
    !last ||
    chain.steps.length !== expected.steps.length ||
    chain.steps.some((step, index) => step.id !== expected.steps[index]?.id)
  )
    return "The simultaneity proof requires all eight named transformations in their stated order.";
  if (!structurallyEqual(first.from, expected.steps[0]!.from))
    return "The proof must begin with the admitted time map at the second event.";
  if (
    chain.target !== expected.target ||
    chain.targetStepId !== last.id ||
    !structurallyEqual(last.to, expected.steps.at(-1)!.to)
  )
    return "The proof must reach the canonical signed moving-time offset.";
  if (
    expected.entryAssumptions.some(
      (required) =>
        !chain.entryAssumptions.some(
          (actual) => actual.ref === required.ref && actual.edgeType === required.edgeType,
        ),
    )
  )
    return "The admitted map, inertial domain, ordered differences and equal stationary times must remain explicit.";
  for (let index = 0; index < chain.steps.length; index++) {
    const current = chain.steps[index]!,
      canonical = expected.steps[index]!;
    if (!sameRule(current.rule, canonical.rule))
      return "A step cannot change the map, subtraction, signed difference or frame whose times are set equal.";
    if (
      canonical.premiseRefs.some(
        (required) =>
          !current.premiseRefs.some(
            (actual) => actual.ref === required.ref && actual.edgeType === required.edgeType,
          ),
      )
    )
      return "Each replacement must retain the premise that justifies it.";
    if (index > 0 && !structurallyEqual(chain.steps[index - 1]!.to, current.from))
      return "Every transformation must consume the preceding result.";
  }
  return undefined;
}

export function verifySRSimultaneity(
  chain: DerivationChain = srSimultaneityChain,
): ChainVerificationReport {
  // Validate the bounded route before invoking generic rules. A missing replacement
  // is a refused proof input, not a reason to run a substitution with a null tree.
  const dependency = dependencyProblem(chain);
  if (dependency)
    return Object.freeze({
      chainId: chain.id,
      proofRouteId: chain.proofRouteId,
      routeKind: chain.routeKind,
      target: chain.target,
      essentialForPrint: chain.essentialForPrint,
      passed: false,
      isPublicationReady: false,
      stepReports: [],
      graphIssues: [],
      errors: [dependency],
    });
  const report = verifyChain(chain, { isPublicationGate: true });
  const problem = report.stepReports.some((step) => step.verificationStatus !== "verified")
    ? "Every simultaneity transformation needs an exact executable check."
    : undefined;
  return problem
    ? Object.freeze({
        ...report,
        passed: false,
        isPublicationReady: false,
        errors: Object.freeze([...report.errors, problem]),
      })
    : report;
}
