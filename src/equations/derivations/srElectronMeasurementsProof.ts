/**
 * Exact conditional proof of §10's measured consequences.
 * Every arithmetic step opts into the existing exact rational checker. This owner
 * also binds physical substitutions, domains, imported records, and final conclusions
 * to the authored route; a plausible replacement string is not an admitted law.
 */
import type { Expression } from "../ast.ts";
import { srElectronMeasurementChains } from "./srElectronMeasurements.ts";
import { structurallyEqual } from "./treeUtils.ts";
import type { DerivationChain, PremiseRef, RuleApplication } from "./types.ts";
import { type ChainVerificationReport, verifyChain } from "./verifyChain.ts";

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
  return (
    "{" +
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`)
      .join(",") +
    "}"
  );
}
function samePremises(actual: readonly PremiseRef[], expected: readonly PremiseRef[]): boolean {
  return (
    actual.length === expected.length &&
    expected.every(
      (premise) => actual.filter((item) => stable(item) === stable(premise)).length === 1,
    )
  );
}
function sameRule(actual: RuleApplication, expected: RuleApplication): boolean {
  if (actual.kind !== expected.kind) return false;
  const a = actual.params;
  const b = expected.params;
  if (Object.keys(a).sort().join(",") !== Object.keys(b).sort().join(",")) return false;
  if (actual.kind === "substitute")
    return (
      a.targetId === b.targetId &&
      a.citedEquality === b.citedEquality &&
      structurallyEqual(a.replacement as Expression, b.replacement as Expression)
    );
  if (actual.kind === "add-subtract-multiply-divide")
    return (
      a.operation === b.operation &&
      a.simplify === true &&
      a.nonzeroCondition === b.nonzeroCondition &&
      structurallyEqual(a.quantity as Expression, b.quantity as Expression)
    );
  return actual.kind === "collect" && a.exact === true;
}
function dependencyProblem(chain: DerivationChain): string | undefined {
  const expected = srElectronMeasurementChains.find((candidate) => candidate.id === chain.id);
  if (!expected)
    return "Only the three published electron measurement routes belong to this owner.";
  if (chain.routeKind !== expected.routeKind || chain.proofRouteId !== expected.proofRouteId)
    return "The Gaussian and SI teaching reconstructions must keep their route identities.";
  if (chain.target !== expected.target || chain.targetStepId !== expected.targetStepId)
    return "The route must reach its named measured consequence.";
  if (!samePremises(chain.entryAssumptions, expected.entryAssumptions))
    return "The route must retain exactly its admitted force, work, geometry, and domain premises.";
  if (
    chain.steps.length !== expected.steps.length ||
    chain.steps.some((step, index) => step.id !== expected.steps[index]?.id)
  )
    return "The measured consequence requires every named transformation in its published order.";
  for (const [index, step] of chain.steps.entries()) {
    const authored = expected.steps[index];
    if (!step || !authored)
      return "The route must retain every authored measurement transformation.";
    if (!sameRule(step.rule, authored.rule))
      return "A physical substitution or exact operation has changed its admitted meaning.";
    if (!samePremises(step.premiseRefs, authored.premiseRefs))
      return "Each transformation must retain its specific physical premises and nonzero conditions.";
    // The canonical endpoints and physical substitution inputs cannot drift separately from
    // the admitted equations. The exact rule checker below still has to establish the algebra.
    if (!structurallyEqual(step.from, authored.from) || !structurallyEqual(step.to, authored.to))
      return "The route must retain its imported equation identities and authored intermediate expressions.";
    const previous = chain.steps[index - 1];
    if (index > 0 && (!previous || !structurallyEqual(previous.to, step.from)))
      return "Each measurement transformation must consume the preceding result exactly.";
  }
  return undefined;
}

/** Checks conditional algebra; the validity of the physical premises is not an output. */
export function verifySRElectronMeasurements(chain: DerivationChain): ChainVerificationReport {
  const report = verifyChain(chain, { isPublicationGate: true });
  const problem =
    dependencyProblem(chain) ??
    (report.stepReports.length === 0 ||
    report.stepReports.some((step) => step.verificationStatus !== "verified")
      ? "Every measurement transformation needs an executable exact check."
      : undefined);
  if (!problem) return report;
  return Object.freeze({
    ...report,
    passed: false,
    isPublicationReady: false,
    errors: Object.freeze([...report.errors, problem]),
  });
}

/** The result card names all three laws; a successful radius alone cannot stand in for them. */
export function verifySRElectronMeasurementRoute(
  chains: readonly DerivationChain[] = srElectronMeasurementChains,
): Readonly<{
  passed: boolean;
  reports: readonly ChainVerificationReport[];
  errors: readonly string[];
}> {
  const errors: string[] = [];
  if (
    chains.length !== srElectronMeasurementChains.length ||
    chains.some((chain, index) => chain.id !== srElectronMeasurementChains[index]?.id)
  )
    errors.push(
      "The complete measured-consequences route requires deflectability, voltage, and radius exactly once in source order.",
    );
  const reports = chains.map(verifySRElectronMeasurements);
  if (reports.some((report) => !report.passed || !report.isPublicationReady))
    errors.push("At least one measured consequence failed its exact conditional proof.");
  return Object.freeze({
    passed: errors.length === 0 && reports.length > 0,
    reports: Object.freeze(reports),
    errors: Object.freeze(errors),
  });
}
