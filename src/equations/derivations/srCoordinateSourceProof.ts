/**
 * Exact conditional checks of the existing source-order §3 construction.
 * The two derivative statements and the integrated time map are checked only
 * within the explicitly admitted linear ansatz. Linearity, synchronization,
 * light propagation, reciprocity and isotropy remain physical premises.
 */
import { type Expression, nodeId, walk } from "../ast.ts";
import { exportProofRouteGraph } from "./exportProofGraph.ts";
import { getRule } from "./rules/index.ts";
import type { RuleCheckResult } from "./rules/types.ts";
import {
  type CoordinateAlgebraDomain,
  CoordinateCalculationError,
  coordinateAlgebraExpressions as e,
  exactCoordinateIdentity,
} from "./srCoordinateAlgebra.ts";
import {
  srCoordinateIntroductions,
  srCoordinateResults,
  srCoordinateSourceStages,
} from "./srCoordinates.ts";
import { structurallyEqual, substituteNode } from "./treeUtils.ts";
import {
  type DerivationChain,
  type DerivationStep,
  type PremiseRef,
  validateChainStructure,
} from "./types.ts";
import type { ChainVerificationReport, StepVerificationReport } from "./verifyChain.ts";

type Relation = Extract<Expression, { kind: "relation" }>;
type Symbol = Extract<Expression, { kind: "symbol" }>;
const symbol = (quantityId: string, suffix = ""): Symbol => ({
  kind: "symbol",
  quantityId,
  termId: quantityId + suffix,
});
const n = (value: string): Expression => ({ kind: "number", value });
const zero = n("0"),
  one = n("1");
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const negative = (argument: Expression): Expression => ({ kind: "negate", argument });
const difference = (left: Expression, right: Expression): Expression => sum(left, negative(right));
const quotient = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
const square = (base: Expression): Expression => ({
  kind: "power",
  base,
  exponent: { num: 2, den: 1 },
});
const q = symbol("auxiliaryGalileanCoordinate");
const movingTime = symbol("coordinateTimeMoving");
const variables = [q, e.y, e.z, e.t] as const;
/** Experiment and coefficient-comparison domains must never restrict general event maps. */
function domainForStep(id: string): CoordinateAlgebraDomain {
  switch (id) {
    case "sr-coordinate-source-transverse-flight":
      return { positiveFlight: true };
    case "sr-coordinate-source-inverse-scale":
      return { nonzeroCoordinate: true };
    case "sr-coordinate-source-rod-isotropy":
      return { positiveScale: true, positiveRodLength: true };
    case "sr-coordinate-source-positive-scale":
      return { positiveScale: true };
    default:
      return {};
  }
}
const same = (left: Expression, right: Expression): boolean => structurallyEqual(left, right);
const equal = (left: Expression, right: Expression): boolean =>
  exactCoordinateIdentity(left, right).passed;
const refuse = (message: string): never => {
  throw new CoordinateCalculationError("sr-coordinate-calculation-refused", message);
};
const relation = (tree: Expression): Relation => {
  if (tree.kind !== "relation" || tree.operator !== "=")
    return refuse("An exact coordinate equality is required.");
  return tree;
};
const residual = (tree: Expression): Expression => {
  const value = relation(tree);
  return difference(value.left, value.right);
};
const pass = (reason: string): RuleCheckResult => ({ outcome: "pass", reason });
const fail = (reason: string): RuleCheckResult => ({ outcome: "fail", reason });
const checked = (condition: boolean, reason: string): RuleCheckResult =>
  condition ? pass(reason) : fail(reason);

export const srCoordinateConstructionPremises = [
  {
    id: "sr-common-origin-identical-rods-clocks",
    label: "Aligned, equally calibrated inertial coordinates with a common zero event",
    explanation:
      "The moving origin has x = vt. Rods, clocks and axes have matching calibration and orientation; both coordinate systems assign zero at the common origin event. The auxiliary x′ = x − vt is not the final moving position ξ.",
  },
  {
    id: "sr-linearity-from-homogeneity",
    label: "Linearity is admitted from homogeneity",
    explanation:
      "At each fixed frame speed the unknown time function is linear in x′, y, z and t, plus an origin constant. The derivative and integration statements are checked as exact identities of these linear coefficients, not as a general solution for arbitrary nonlinear functions or a proof of homogeneity.",
  },
  {
    id: "arg-sr-synchronization",
    label: "Adopt the same light-signal clock-setting convention",
    explanation:
      "In the moving system the reflection reading is the midpoint of departure and return. This is an adopted definition of synchronized distant clocks, not an independently measured one-way travel time.",
  },
  {
    id: "sr-positive-light-speed-subluminal-frame",
    label: "Real coordinates, positive light speed and a subluminal relative speed",
    explanation:
      "c > 0 and |v| < c, so c − v, c + v, c² − v² and their positive square roots are nonzero. The exact arithmetic uses w = positive √(c² − v²), with w² = c² − v². It never assumes an invariant spacetime interval.",
  },
  {
    id: "sr-transverse-light-propagation",
    label: "The stated light paths and equally normalized transverse axes",
    explanation:
      "Apply the light-speed postulate in each inertial frame. In K a ray following a moving transverse axis obeys the right-triangle equation c²t² = v²t² + y²; the y and z experiments are related by spatial symmetry. The spatial map is linear and determined by these axis experiments, not extended from a light ray without that premise.",
  },
  {
    id: "sr-reciprocity-identical-calibration",
    label: "The reverse frame change returns the same coordinates",
    explanation:
      "A frame moving back with −v has the same functional form and identical calibration. Composing it with the forward map returns K, giving the product condition on the two still-unknown scales. Reciprocity alone does not set either scale to one.",
  },
  {
    id: "sr-identical-transverse-rods",
    label: "Spatial isotropy and a positive transverse rod length",
    explanation:
      "Reversing the direction of motion cannot change the equal-time transverse length of an identically calibrated rod. With length l > 0 this supplies l/φ(v) = l/φ(−v), independently of the inverse product condition.",
  },
  {
    id: "sr-continuous-positive-identity-branch",
    label: "Choose the positive branch connected to the identity",
    explanation:
      "Identically oriented axes, future-increasing clocks and continuity from the identity choose positive nonzero scale factors. The algebraic square constraint alone allows both signs. The check retains this explicit branch premise when simplifying square roots.",
  },
  {
    id: "sr-coordinate-positive-flight-and-coefficient-comparison",
    label: "Forward axis experiments and nonzero coefficient comparisons",
    explanation:
      "The displayed transverse flight uses t ≥ 0 and a reflector on the positive y or z axis. A nonzero coordinate x may be chosen to compare coefficients of a map valid for every event; the resulting speed-only relation also holds at x = 0. No division by the frame speed is made, so v = 0 remains included.",
  },
  {
    id: "eq-s3-d17",
    label: "The emitted spherical wave used for the consistency check",
    explanation:
      "The wave from the common zero event obeys x² + y² + z² = c²t² in K. Its transformed equation is checked after the scaled map has been constructed; it does not determine the remaining scale or supply a hidden Minkowski-space premise.",
  },
] as const;

const explicitPremises: readonly PremiseRef[] = srCoordinateConstructionPremises.map(({ id }) => ({
  ref: id,
  edgeType:
    id === "sr-continuous-positive-identity-branch" ||
    id === "sr-coordinate-positive-flight-and-coefficient-comparison"
      ? "pedagogical-reconstruction"
      : "historical-derivation",
}));
const mergePremises = (values: readonly PremiseRef[]): readonly PremiseRef[] =>
  values.filter(
    (value, index) =>
      values.findIndex(
        (candidate) => candidate.ref === value.ref && candidate.edgeType === value.edgeType,
      ) === index,
  );

/** The displayed stages are unchanged; the exact owner's full entry conditions are explicit. */
export const srCoordinateConstructionChains: readonly DerivationChain[] =
  srCoordinateSourceStages.map(({ chain }) => ({
    ...chain,
    entryAssumptions: mergePremises([...chain.entryAssumptions, ...explicitPremises]),
  }));
const allSteps = srCoordinateConstructionChains.flatMap((chain) => chain.steps);
const byStep = new Map(allSteps.map((step) => [step.id, step]));
const step = (id: string): DerivationStep => {
  const value = byStep.get(id);
  if (!value) return refuse("Missing the coordinate proof step " + id + ".");
  return value;
};
const output = (id: string): Relation => relation(step(id).to);
const linearTime = output("sr-coordinate-source-linear-time");
const transverseFlight = output("sr-coordinate-source-transverse-flight");

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
  return `{${Object.entries(value)
    .filter(([name]) => name !== "opId")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, child]) => `${JSON.stringify(name)}:${stable(child)}`)
    .join(",")}}`;
}
function samePremises(actual: readonly PremiseRef[], expected: readonly PremiseRef[]): boolean {
  return (
    actual.length === expected.length &&
    expected.every(
      (required) => actual.filter((value) => stable(value) === stable(required)).length === 1,
    )
  );
}

/** A linear time application has four constant partial derivatives and one origin constant. */
function linearizeTime(tree: Expression): Expression {
  if (tree.kind === "symbol" && tree.quantityId === movingTime.quantityId && tree.args) {
    if (tree.args.length !== 4)
      return refuse("The linear time function has exactly four coordinate arguments.");
    return sum(
      symbol("coordinateTimeOriginConstant"),
      ...tree.args.map((argument, index) =>
        product(
          {
            kind: "derivative",
            expression: movingTime,
            variable: variables[index]!,
            order: 1,
            partial: true,
          },
          argument,
        ),
      ),
    );
  }
  if (tree.kind === "sum" || tree.kind === "product")
    return { ...tree, args: tree.args.map(linearizeTime) };
  if (tree.kind === "negate" || tree.kind === "group")
    return { ...tree, argument: linearizeTime(tree.argument) };
  if (tree.kind === "quotient")
    return {
      ...tree,
      numerator: linearizeTime(tree.numerator),
      denominator: linearizeTime(tree.denominator),
    };
  if (tree.kind === "power") return { ...tree, base: linearizeTime(tree.base) };
  return tree;
}

/** Finite differences are exact coefficients only after the affine identity is checked. */
function coefficient(tree: Expression, variable: Symbol): Expression {
  // The derivative nodes denote fixed coefficients of the admitted linear function.
  // Replacing their variable metadata would turn τ_x′ into a different atom.
  const at = (value: Expression, replacement: Expression): Expression => {
    if (value.kind === "derivative") return value;
    if (value.kind === "symbol") return value.termId === variable.termId ? replacement : value;
    if (value.kind === "sum" || value.kind === "product")
      return { ...value, args: value.args.map((child) => at(child, replacement)) };
    if (value.kind === "negate" || value.kind === "group")
      return { ...value, argument: at(value.argument, replacement) };
    if (value.kind === "quotient")
      return {
        ...value,
        numerator: at(value.numerator, replacement),
        denominator: at(value.denominator, replacement),
      };
    if (value.kind === "power") return { ...value, base: at(value.base, replacement) };
    return value;
  };
  const atZero = at(tree, zero);
  const atOne = at(tree, one);
  const slope = difference(atOne, atZero);
  const affine = exactCoordinateIdentity(tree, sum(atZero, product(variable, slope)));
  if (!affine.passed)
    return refuse(
      "The displayed expression is not affine in the specified coordinate: " + affine.reason,
    );
  return slope;
}

function derivativeStep(current: DerivationStep): RuleCheckResult {
  const from = relation(current.from),
    to = relation(current.to);
  const variable = current.id === "sr-coordinate-source-differentiate" ? q : e.y;
  const left = coefficient(linearizeTime(from.left), variable);
  const right = coefficient(linearizeTime(from.right), variable);
  return checked(
    current.id === "sr-coordinate-source-differentiate"
      ? equal(left, to.left) && equal(right, to.right)
      : equal(difference(right, left), residual(to)),
    "The stated differential relation is the exact coefficient identity of the admitted linear time function.",
  );
}

function linearSolution(current: DerivationStep): RuleCheckResult {
  const result = relation(current.to);
  if (!same(result.left, movingTime))
    return fail("The linear solution must describe the moving coordinate time.");
  const slopes = variables.map((variable) => coefficient(result.right, variable));
  let origin = result.right;
  for (const variable of variables) origin = substituteNode(origin, variable.termId, zero);
  const constraint = relation(current.from);
  const replacePartials = (tree: Expression): Expression => {
    if (tree.kind === "derivative") {
      const index = variables.findIndex((variable) => same(tree.variable, variable));
      if (index < 0 || tree.order !== 1 || !tree.partial || !same(tree.expression, movingTime))
        return refuse(
          "Only the linear time function's stated coordinate derivatives may be replaced.",
        );
      return slopes[index]!;
    }
    if (tree.kind === "sum" || tree.kind === "product")
      return { ...tree, args: tree.args.map(replacePartials) };
    if (tree.kind === "negate" || tree.kind === "group")
      return { ...tree, argument: replacePartials(tree.argument) };
    if (tree.kind === "quotient")
      return {
        ...tree,
        numerator: replacePartials(tree.numerator),
        denominator: replacePartials(tree.denominator),
      };
    return tree;
  };
  return checked(
    equal(origin, zero) &&
      equal(slopes[3]!, e.a) &&
      equal(slopes[1]!, zero) &&
      equal(slopes[2]!, zero) &&
      equal(replacePartials(constraint.left), replacePartials(constraint.right)),
    "The admitted linear ansatz has zero origin constant and zero transverse slopes; its free time slope and constrained longitudinal slope give the displayed time function.",
  );
}

/** Check a replacement's meaning as well as its literal occurrence in the displayed tree. */
function replacementJustified(current: DerivationStep): boolean {
  const equal = (left: Expression, right: Expression): boolean =>
    exactCoordinateIdentity(left, right, domainForStep(current.id)).passed;
  const replacement = current.rule.params.replacement as Expression;
  const target = walk(current.from).find((node) => nodeId(node) === current.rule.params.targetId);
  if (!replacement || !target) return false;
  switch (current.id) {
    case "sr-coordinate-source-departure":
      return (
        replacement.kind === "symbol" &&
        replacement.args?.length === 4 &&
        [zero, zero, zero, e.t].every((expected, index) =>
          same(replacement.args![index]!, expected),
        )
      );
    case "sr-coordinate-source-return": {
      if (
        replacement.kind !== "symbol" ||
        replacement.args?.length !== 4 ||
        !replacement.args.slice(0, 3).every((coordinate) => same(coordinate, zero))
      )
        return false;
      const totalFlight = difference(replacement.args[3]!, e.t);
      return equal(totalFlight, sum(quotient(q, difference(e.c, e.v)), quotient(q, sum(e.c, e.v))));
    }
    case "sr-coordinate-source-functional-equation":
      return (
        replacement.kind === "symbol" &&
        replacement.args?.length === 4 &&
        [q, zero, zero].every((expected, index) => same(replacement.args![index]!, expected)) &&
        equal(product(difference(replacement.args[3]!, e.t), difference(e.c, e.v)), q)
      );
    case "sr-coordinate-source-longitudinal-time":
      return same(replacement, linearTime.right);
    case "sr-coordinate-source-longitudinal-flight":
      return equal(product(replacement, difference(e.c, e.v)), q);
    case "sr-coordinate-source-transverse-time":
      return equal(replacement, substituteNode(linearTime.right, q.termId, zero));
    case "sr-coordinate-source-transverse-position":
      return same(replacement, transverseFlight.right);
    case "sr-coordinate-source-transverse-z": {
      const zFlight = substituteNode(transverseFlight.right, e.y.termId, e.z);
      return equal(
        replacement,
        substituteNode(substituteNode(linearTime.right, q.termId, zero), e.t.termId, zFlight),
      );
    }
    case "sr-coordinate-source-replace-auxiliary":
      return same(replacement, srCoordinateIntroductions.auxiliary.right);
    case "sr-coordinate-source-name-common-scale":
    case "sr-coordinate-source-scaled-position":
    case "sr-coordinate-source-transverse-scaled-y":
    case "sr-coordinate-source-transverse-scaled-z":
      return equal(
        target,
        substituteNode(replacement, e.phi.termId, srCoordinateIntroductions.scaleDefinition.right),
      );
    case "sr-coordinate-source-spherical-expand-factor":
      return equal(target, replacement);
    case "sr-coordinate-source-spherical-use-wave":
      return (
        equal(target, residual(srCoordinateIntroductions.sphericalStationary)) &&
        same(replacement, zero)
      );
    case "sr-coordinate-source-inverse-cancel-speed":
      return equal(target, replacement);
    case "sr-coordinate-source-use-isotropy": {
      const evenScale = output("sr-coordinate-source-rod-isotropy");
      return same(target, evenScale.left) && same(replacement, evenScale.right);
    }
    case "sr-coordinate-source-positive-scale":
      return equal(target, replacement);
    case "sr-coordinate-source-final-position":
    case "sr-coordinate-source-final-time":
    case "sr-coordinate-source-final-transverse-y":
    case "sr-coordinate-source-final-transverse-z":
      return equal(substituteNode(target, e.phi.termId, one), replacement);
    default:
      return false;
  }
}

function exactStep(current: DerivationStep): RuleCheckResult {
  const domain = domainForStep(current.id);
  const equal = (left: Expression, right: Expression): boolean =>
    exactCoordinateIdentity(left, right, domain).passed;
  try {
    if (current.rule.kind === "substitute") {
      if (!replacementJustified(current))
        return fail(
          "The substitution's equality is not established by the declared coordinate premises or preceding results.",
        );
      return getRule("substitute")!.check({
        from: current.from,
        to: current.to,
        params: current.rule.params,
        changed: current.changedSubexpressionIds,
      });
    }
    if (current.rule.kind === "collect") {
      if (current.from.kind === "relation") {
        relation(current.from);
        relation(current.to);
      }
      const pairs =
        current.from.kind === "relation" && current.to.kind === "relation"
          ? ([
              [current.from.left, current.to.left],
              [current.from.right, current.to.right],
            ] as const)
          : ([[current.from, current.to]] as const);
      const results = pairs.map(([left, right]) => exactCoordinateIdentity(left, right, domain));
      const problem = results.find((result) => !result.passed);
      return problem
        ? fail(problem.reason)
        : pass("Each side is exactly equal in the declared coordinate field.");
    }
    if (current.rule.kind === "differentiate") return derivativeStep(current);
    if (current.rule.kind === "integrate") return linearSolution(current);
    if (current.rule.kind === "monotonic-function")
      return getRule("monotonic-function")!.check({
        from: current.from,
        to: current.to,
        params: current.rule.params,
        changed: current.changedSubexpressionIds,
      });
    if (current.rule.kind !== "add-subtract-multiply-divide")
      return fail("This operation has no exact source-coordinate owner.");
    const from = relation(current.from),
      to = relation(current.to);
    if (current.id === "sr-coordinate-source-transverse-triangle")
      return checked(
        equal(residual(from), product(e.radicand, residual(to))),
        "Subtract the horizontal flight term, then divide by the strictly positive c² − v².",
      );
    if (current.id === "sr-coordinate-source-transverse-flight")
      return checked(
        equal(from.left, to.left) && equal(from.right, to.right),
        "The future-directed positive-axis experiment permits these positive-root simplifications.",
      );
    const operand = current.rule.params.quantity as Expression;
    const operation = (side: Expression): Expression => {
      switch (current.rule.params.operation) {
        case "add":
          return sum(side, operand);
        case "subtract":
          return difference(side, operand);
        case "multiply":
          return product(side, operand);
        case "divide":
          return quotient(side, operand);
        default:
          return refuse("Unknown coordinate arithmetic operation.");
      }
    };
    const swap = current.id === "sr-coordinate-source-time-constraint";
    return checked(
      equal(operation(from.left), swap ? to.right : to.left) &&
        equal(operation(from.right), swap ? to.left : to.right),
      "The stated operation acts on both sides, with only its explicitly admitted nonzero divisors cancelled.",
    );
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : "The coordinate step is outside the bounded exact owner.",
    );
  }
}

function canonicalProblem(): string | undefined {
  const X = symbol("coordinatePositionMoving");
  if (
    !same(srCoordinateResults.position.left, X) ||
    !equal(
      srCoordinateResults.position.right,
      product(e.gamma, difference(e.x, product(e.v, e.t))),
    ) ||
    !same(srCoordinateResults.time.left, movingTime) ||
    !equal(
      srCoordinateResults.time.right,
      product(e.gamma, difference(e.t, quotient(product(e.v, e.x), square(e.c)))),
    ) ||
    !same(srCoordinateResults.factor.left, e.gamma) ||
    !equal(srCoordinateResults.factor.right, e.gamma)
  )
    return "The canonical coordinate results must retain the forward map, positive Lorentz factor and stated frame direction.";
  return undefined;
}

/** Each report has exact evidence for every displayed operation, not the generic sampled collect report. */
export function verifySRCoordinateSource(chain: DerivationChain): ChainVerificationReport {
  const errors: string[] = [];
  const expected = srCoordinateConstructionChains.find((candidate) => candidate.id === chain.id);
  try {
    validateChainStructure(chain);
    const canonical = canonicalProblem();
    if (canonical) errors.push(canonical);
    if (
      !expected ||
      chain.routeKind !== expected.routeKind ||
      chain.proofRouteId !== expected.proofRouteId ||
      chain.target !== expected.target ||
      chain.targetStepId !== expected.targetStepId ||
      chain.steps.length !== expected.steps.length ||
      !samePremises(chain.entryAssumptions, expected.entryAssumptions)
    ) {
      errors.push(
        "The source construction must retain its published stage, complete steps, target and explicit physical/domain premises.",
      );
    } else {
      for (const [index, current] of chain.steps.entries()) {
        const original = expected.steps[index];
        if (
          !original ||
          current.id !== original.id ||
          !same(current.from, original.from) ||
          stable(current.rule) !== stable(original.rule) ||
          !samePremises(current.premiseRefs, original.premiseRefs)
        ) {
          errors.push(
            "A source step cannot change its starting statement, cited equality, branch or dependency while keeping the same proof credit.",
          );
          break;
        }
      }
    }
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : "The source coordinate chain is malformed.",
    );
  }
  let graphIssues: readonly string[] = [];
  if (!errors.length) {
    const graph = exportProofRouteGraph(chain);
    graphIssues = [
      ...graph.edgeTypeViolations,
      ...(graph.isAcyclic ? [] : ["Coordinate proof cycle: " + graph.cyclePath?.join(" → ")]),
    ];
  }
  const stepReports: StepVerificationReport[] = errors.length
    ? []
    : chain.steps.map((current) => {
        const result = exactStep(current);
        return {
          stepId: current.id,
          ruleKind: current.rule.kind,
          ruleOutcome: result.outcome,
          ruleReason: result.reason,
          verificationStatus: result.outcome === "pass" ? "verified" : "failed",
          passed: result.outcome === "pass",
          ...(result.outcome === "pass"
            ? {}
            : { error: result.reason ?? "The exact coordinate check failed." }),
        };
      });
  const passed =
    errors.length === 0 &&
    graphIssues.length === 0 &&
    stepReports.length > 0 &&
    stepReports.every((result) => result.passed);
  return {
    chainId: chain.id,
    proofRouteId: chain.proofRouteId,
    routeKind: chain.routeKind,
    target: chain.target,
    essentialForPrint: chain.essentialForPrint,
    passed,
    isPublicationReady: passed,
    errors,
    graphIssues,
    stepReports,
  };
}

export type SRCoordinateConstructionReport = Readonly<{
  passed: boolean;
  reports: readonly ChainVerificationReport[];
  errors: readonly string[];
}>;

/** Check every source stage and the combined dependency graph before claiming the complete map. */
export function verifySRCoordinateConstruction(
  chains: readonly DerivationChain[] = srCoordinateConstructionChains,
): SRCoordinateConstructionReport {
  const errors: string[] = [];
  if (
    chains.length !== srCoordinateConstructionChains.length ||
    chains.some((chain, index) => chain.id !== srCoordinateConstructionChains[index]?.id)
  )
    errors.push(
      "All eight source stages are required in order, including transverse geometry, reciprocity and isotropy.",
    );
  const reports = chains.map(verifySRCoordinateSource);
  if (!errors.length && reports.every((report) => report.passed)) {
    const combined: DerivationChain = {
      ...chains[0]!,
      id: "chain-sr-coordinate-source-complete-check",
      target: "eq-model-sr-map-time",
      targetStepId: chains.at(-1)?.steps.at(-1)?.id,
      steps: chains.flatMap((chain) => chain.steps),
    };
    const graph = exportProofRouteGraph(combined);
    if (!graph.isAcyclic || graph.edgeTypeViolations.length)
      errors.push(
        "The complete coordinate construction has a cyclic or historically incompatible dependency.",
      );
  }
  return {
    passed: errors.length === 0 && reports.every((report) => report.passed),
    reports,
    errors,
  };
}
