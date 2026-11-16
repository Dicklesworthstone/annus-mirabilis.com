/**
 * Check the joined §7 argument, including the coefficient-matching bridge between chains.
 * A locally correct substitution is insufficient: its replacements must come from the
 * admitted coordinate map or the already established frequency of this same wave.
 */
import type { Expression } from "../ast.ts";
import { checkRationalSimplification } from "./rationalSimplification.ts";
import {
  srDopplerAberrationChain,
  srDopplerChains,
  srDopplerCoordinatePremises,
  srDopplerCoordinates,
  srDopplerFrequencyChain,
  srDopplerPhaseChain,
  srDopplerRatio,
  srDopplerSidewaysChain,
} from "./srDoppler.ts";
import { structurallyEqual, substituteNode } from "./treeUtils.ts";
import type { DerivationChain, RuleApplication } from "./types.ts";
import { type ChainVerificationReport, verifyChain } from "./verifyChain.ts";

const zero: Expression = { kind: "number", value: "0" };
const one: Expression = { kind: "number", value: "1" };
const lightSpeed: Expression = { kind: "symbol", termId: "c", quantityId: "speedOfLight" };
const negative = (argument: Expression): Expression => ({ kind: "negate", argument });
const overC = (numerator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator: lightSpeed,
});

/** The canonical name must define this ratio, not its inverse or an approximate relation. */
export function checkSRDopplerCanonicalPremises(
  ratio: Expression = srDopplerRatio,
  maps: typeof srDopplerCoordinatePremises = srDopplerCoordinatePremises,
): boolean {
  const symbol = (termId: string, quantityId: string): Expression => ({
    kind: "symbol",
    termId,
    quantityId,
  });
  return (
    ratio.kind === "relation" &&
    ratio.operator === "define" &&
    structurallyEqual(ratio.left, symbol("q", "dopplerFactor")) &&
    structurallyEqual(ratio.right, {
      kind: "quotient",
      numerator: symbol("ν'", "waveFrequencyMoving"),
      denominator: symbol("ν", "waveFrequencyStationary"),
    }) &&
    maps.time.operator === "=" &&
    structurallyEqual(maps.time.left, symbol("t", "coordinateTimeStationary")) &&
    maps.position.operator === "=" &&
    structurallyEqual(maps.position.left, symbol("x", "coordinatePositionStationary"))
  );
}

/**
 * For a linear phase, evaluation on a coordinate basis extracts coefficients exactly.
 * The zero and reconstruction checks also refuse a constant offset or nonlinear term;
 * this is an algebraic identity with every physical symbol free, not a numerical sample.
 */
export function checkSRPhaseCoefficients(
  phase: Expression,
  coefficients: readonly Expression[],
): boolean {
  if (coefficients.length !== srDopplerCoordinates.length) return false;
  const at = (selected: number): Expression =>
    srDopplerCoordinates.reduce<Expression>(
      (value, coordinate, index) =>
        substituteNode(value, coordinate.termId, index === selected ? one : zero),
      phase,
    );
  if (checkRationalSimplification(at(-1), zero).outcome !== "equal") return false;
  if (
    coefficients.some(
      (coefficient, index) =>
        checkRationalSimplification(at(index), coefficient).outcome !== "equal",
    )
  )
    return false;
  const reconstruction: Expression = {
    kind: "sum",
    args: coefficients.map((coefficient, index) => ({
      kind: "product",
      args: [coefficient, srDopplerCoordinates[index]!],
    })),
  };
  return checkRationalSimplification(phase, reconstruction).outcome === "equal";
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

function dependencyProblem(chain: DerivationChain, expected: DerivationChain): string | undefined {
  if (
    chain.proofRouteId !== expected.proofRouteId ||
    chain.routeKind !== expected.routeKind ||
    chain.target !== expected.target ||
    chain.targetStepId !== expected.targetStepId
  )
    return "The wave-phase route must retain its declared identity, conclusion and final step.";
  if (
    chain.steps.length !== expected.steps.length ||
    chain.steps.some((step, index) => step.id !== expected.steps[index]?.id)
  )
    return "The wave-phase argument needs every named transformation in order.";
  if (
    !structurallyEqual(chain.steps[0]!.from, expected.steps[0]!.from) ||
    !structurallyEqual(chain.steps.at(-1)!.to, expected.steps.at(-1)!.to)
  )
    return "The route must start from the admitted phase or its coefficients and reach its canonical conclusion.";
  const includes = (
    actual: DerivationChain["entryAssumptions"],
    needed: DerivationChain["entryAssumptions"],
  ) =>
    needed.every((premise) =>
      actual.some((entry) => entry.ref === premise.ref && entry.edgeType === premise.edgeType),
    );
  if (!includes(chain.entryAssumptions, expected.entryAssumptions))
    return "The phase, frame, independent-coordinate and positive-domain premises must remain explicit.";
  for (let index = 0; index < chain.steps.length; index++) {
    const step = chain.steps[index]!;
    const reference = expected.steps[index]!;
    if (!sameRule(step.rule, reference.rule) || !includes(step.premiseRefs, reference.premiseRefs))
      return "Every operation must use its admitted producer, exact arithmetic and nonzero condition.";
    if (index > 0 && !structurallyEqual(chain.steps[index - 1]!.to, step.from))
      return "Every transformation must consume the preceding result without changing it.";
  }
  return undefined;
}

/**
 * Verify the selected chain and all producers required by the full phase argument.
 * Supplying a source family checks edited producers before publication; it must contain
 * exactly the four declared routes, without replacements or duplicates.
 */
export function verifySRDoppler(
  selected: DerivationChain,
  source: readonly DerivationChain[] = srDopplerChains,
): ChainVerificationReport {
  const report = verifyChain(selected, { isPublicationGate: true });
  const fail = (problem: string): ChainVerificationReport => ({
    ...report,
    passed: false,
    isPublicationReady: false,
    errors: [...report.errors, problem],
  });
  if (!checkSRDopplerCanonicalPremises())
    return fail("The admitted maps must name t and x exactly, and q must define ν′/ν.");
  if (
    source.length !== srDopplerChains.length ||
    new Set(source.map((chain) => chain.id)).size !== srDopplerChains.length ||
    !srDopplerChains.some((chain) => chain.id === selected.id)
  )
    return fail("The Doppler proof needs exactly its phase, frequency and two direction routes.");
  const family = source.map((chain) => (chain.id === selected.id ? selected : chain));
  for (const expected of srDopplerChains) {
    const actual = family.find((chain) => chain.id === expected.id);
    if (!actual) return fail(`The Doppler argument is missing its producer ${expected.id}.`);
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
      return fail(
        `The producer ${actual.id} does not have an exact check for every transformation.`,
      );
  }
  const phase = family.find((chain) => chain.id === srDopplerPhaseChain.id)!.steps.at(-1)!.to;
  const coefficient = (id: string): Expression | undefined => {
    const equation = family.find((chain) => chain.id === id)?.steps[0]?.from;
    return equation?.kind === "relation" ? equation.right : undefined;
  };
  const frequency = coefficient(srDopplerFrequencyChain.id);
  const longitudinal = coefficient(srDopplerAberrationChain.id);
  const sideways = coefficient(srDopplerSidewaysChain.id);
  if (
    !frequency ||
    !longitudinal ||
    !sideways ||
    !checkSRPhaseCoefficients(phase, [
      frequency,
      negative(overC(longitudinal)),
      negative(overC(sideways)),
    ])
  )
    return fail(
      "The frequency and direction equations do not match every independent phase coefficient.",
    );
  return report;
}
