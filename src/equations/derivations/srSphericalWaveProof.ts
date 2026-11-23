/**
 * Exact, conditional check of the source's spherical light-wave calculation.
 * This owner admits the already constructed scaled map. It does not establish the
 * preceding synchronization argument, select phi = 1, or certify physical premises.
 */
import type { Expression } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { checkRationalSimplification } from "./rationalSimplification.ts";
import { getRule } from "./rules/index.ts";
import type { RuleCheckResult } from "./rules/types.ts";
import {
  srCoordinateIntroductions,
  srCoordinateResults,
  srCoordinateSourceStages,
} from "./srCoordinates.ts";
import { structurallyEqual } from "./treeUtils.ts";
import type { DerivationChain, DerivationStep, PremiseRef } from "./types.ts";
import {
  type ChainVerificationReport,
  type StepVerificationReport,
  verifyChain,
} from "./verifyChain.ts";

const DOMAIN = "sr-positive-light-speed-subluminal-frame";
const MAP = "sr-spherical-wave-admitted-scaled-map";
const SCALE = "sr-spherical-wave-finite-nonzero-common-scale";
const WAVE = "eq-s3-d17";
const historical = (ref: string): PremiseRef => ({ ref, edgeType: "historical-derivation" });

export const srSphericalWavePremises = [
  {
    id: MAP,
    label: "The admitted coordinate map with a common scale",
    explanation:
      "Use xi = phi gamma (x - vt), tau = phi gamma (t - vx/c squared), eta = phi y and zeta = phi z. " +
      "The earlier synchronization and symmetry arguments that construct this map remain separate premises.",
  },
  {
    id: DOMAIN,
    label: "Positive light speed and a subluminal frame",
    explanation:
      "All coordinates and speeds are real, c is positive and |v| < c. Thus 1 - v squared/c squared is positive, " +
      "the positive Lorentz square root is real, and every cancelled denominator is nonzero.",
  },
  {
    id: SCALE,
    label: "A finite, nonzero common scale",
    explanation:
      "The same finite, nonzero real phi(v) multiplies all four moving coordinates. It remains arbitrary in this calculation; " +
      "the wave condition does not select phi = 1.",
  },
  {
    id: WAVE,
    label: "An emitted spherical light wave in the stationary frame",
    explanation:
      "For the light pulse emitted from the common zero event, x squared + y squared + z squared = c squared t squared. " +
      "The calculation is conditional on this physical light-wave premise.",
  },
] as const;

const authored = srCoordinateSourceStages.find(
  (stage) => stage.chain.id === "chain-sr-coordinate-source-spherical-wave",
)!.chain;
const commonPremises = [historical(MAP), historical(DOMAIN), historical(SCALE)];

/** Same four displayed AST transformations, with the bounded proof's imports made explicit. */
export const srSphericalWaveChain: DerivationChain = {
  ...authored,
  entryAssumptions: [...commonPremises, historical(WAVE)],
  steps: authored.steps.map((step) => ({
    ...step,
    premiseRefs:
      step.id === "sr-coordinate-source-spherical-use-wave"
        ? [...commonPremises, historical(WAVE)]
        : commonPremises,
  })),
};

/** The zero residual is exactly this moving-frame sphere equation. */
export const srSphericalWaveConclusion = srCoordinateIntroductions.sphericalMoving;

const square = (base: Expression): Expression => ({
  kind: "power",
  base,
  exponent: { num: 2, den: 1 },
});
const symbol = (quantityId: string): Expression => ({
  kind: "symbol",
  termId: quantityId,
  quantityId,
});
const positiveRadicand: Expression = {
  kind: "sum",
  args: [
    { kind: "number", value: "1" },
    {
      kind: "negate",
      argument: {
        kind: "quotient",
        numerator: square(symbol("frameSpeed")),
        denominator: square(symbol("speedOfLight")),
      },
    },
  ],
};
const admittedFactor: Expression = {
  kind: "quotient",
  numerator: { kind: "number", value: "1" },
  denominator: { kind: "root", degree: 2, radicand: positiveRadicand },
};

/**
 * Only this proof's squared products and quotients are distributed. An unpaired root
 * or a root of any other expression is refused. The caller must establish DOMAIN
 * before invoking this reduction; no generic square-root rule is changed.
 */
function rationalSquares(tree: Expression): Expression | undefined {
  const many = (nodes: readonly Expression[], squared = false): Expression[] | undefined => {
    const values = nodes.map(squared ? squaredExpression : rationalSquares);
    return values.every((value): value is Expression => value !== undefined) ? values : undefined;
  };
  const squaredExpression = (node: Expression): Expression | undefined => {
    if (node.kind === "root")
      return node.degree === 2 && structurallyEqual(node.radicand, positiveRadicand)
        ? rationalSquares(node.radicand)
        : undefined;
    if (node.kind === "product") {
      const args = many(node.args, true);
      return args ? { kind: "product", args } : undefined;
    }
    if (node.kind === "quotient") {
      const numerator = squaredExpression(node.numerator);
      const denominator = squaredExpression(node.denominator);
      return numerator && denominator ? { kind: "quotient", numerator, denominator } : undefined;
    }
    if (node.kind === "negate" || node.kind === "group") return squaredExpression(node.argument);
    const base = rationalSquares(node);
    return base ? square(base) : undefined;
  };
  if (tree.kind === "symbol" || tree.kind === "number") return tree;
  if (tree.kind === "sum" || tree.kind === "product") {
    const args = many(tree.args);
    return args ? { ...tree, args } : undefined;
  }
  if (tree.kind === "negate" || tree.kind === "group") {
    const argument = rationalSquares(tree.argument);
    return argument ? { ...tree, argument } : undefined;
  }
  if (tree.kind === "quotient") {
    const numerator = rationalSquares(tree.numerator);
    const denominator = rationalSquares(tree.denominator);
    return numerator && denominator ? { ...tree, numerator, denominator } : undefined;
  }
  if (tree.kind === "power") {
    if (tree.exponent.num === 2 && tree.exponent.den === 1) return squaredExpression(tree.base);
    const base = rationalSquares(tree.base);
    return base ? { ...tree, base } : undefined;
  }
  return undefined;
}

function hasPremise(premises: readonly PremiseRef[], required: PremiseRef): boolean {
  return premises.some(
    (actual) => actual.ref === required.ref && actual.edgeType === required.edgeType,
  );
}

function dependencyProblem(chain: DerivationChain): string | undefined {
  const expected = srSphericalWaveChain;
  if (!structurallyEqual(srCoordinateResults.factor.right, admittedFactor))
    return "The admitted Lorentz factor must be the positive reciprocal root on the stated domain.";
  if (
    chain.id !== expected.id ||
    chain.proofRouteId !== expected.proofRouteId ||
    chain.routeKind !== expected.routeKind
  )
    return "Only the source spherical-wave consistency route belongs to this proof owner.";
  if (
    chain.steps.length !== expected.steps.length ||
    chain.steps.some((step, index) => step.id !== expected.steps[index]?.id)
  )
    return "The compatibility proof needs all four named transformations in their published order.";
  const first = chain.steps[0]!;
  const last = chain.steps.at(-1)!;
  if (!structurallyEqual(first.from, expected.steps[0]!.from))
    return "The compatibility proof must start from the admitted map's moving-wave residual.";
  if (
    chain.target !== expected.target ||
    chain.targetStepId !== last.id ||
    !structurallyEqual(last.to, expected.steps.at(-1)!.to)
  )
    return "The compatibility proof must reach the zero residual of the moving-frame sphere.";
  if (expected.entryAssumptions.some((premise) => !hasPremise(chain.entryAssumptions, premise)))
    return "The admitted map, real subluminal domain, common scale and stationary light wave must remain explicit.";
  for (let index = 0; index < chain.steps.length; index++) {
    const step = chain.steps[index]!;
    const canonical = expected.steps[index]!;
    if (canonical.premiseRefs.some((premise) => !hasPremise(step.premiseRefs, premise)))
      return "A compatibility transformation cannot drop its physical or domain premises.";
    if (index > 0 && !structurallyEqual(chain.steps[index - 1]!.to, step.from))
      return "Every compatibility transformation must consume the preceding result.";
  }
  return undefined;
}

function exactStep(step: DerivationStep, index: number, chain: DerivationChain): RuleCheckResult {
  const expected = srSphericalWaveChain.steps[index];
  if (!expected || step.rule.kind !== expected.rule.kind)
    return { outcome: "fail", reason: "The published compatibility operation has changed." };
  if (step.rule.kind === "substitute") {
    const actual = step.rule.params;
    const canonical = expected.rule.params;
    if (
      actual.targetId !== canonical.targetId ||
      actual.citedEquality !== canonical.citedEquality ||
      !actual.replacement ||
      !structurallyEqual(actual.replacement as Expression, canonical.replacement as Expression)
    )
      return {
        outcome: "fail",
        reason: "The substitution must retain its admitted equality and actual target.",
      };
    return getRule("substitute")!.check({
      from: step.from,
      to: step.to,
      params: step.rule.params,
      changed: step.changedSubexpressionIds,
    });
  }
  if (step.rule.kind !== "collect")
    return {
      outcome: "fail",
      reason: "This owner checks only the two displayed substitutions and exact collections.",
    };
  if (
    !hasPremise(chain.entryAssumptions, historical(DOMAIN)) ||
    !hasPremise(step.premiseRefs, historical(DOMAIN))
  )
    return {
      outcome: "fail",
      reason: "Squaring the Lorentz root requires the explicit real positive subluminal domain.",
    };
  const from = rationalSquares(step.from);
  const to = rationalSquares(step.to);
  if (!from || !to)
    return {
      outcome: "fail",
      reason: "Only the declared Lorentz radicand may lose its square root inside a square.",
    };
  const result = checkRationalSimplification(from, to);
  return result.outcome === "equal"
    ? {
        outcome: "pass",
        reason: "Exact rational polynomial equality on the declared positive-root domain.",
      }
    : {
        outcome: "fail",
        reason:
          result.reason ??
          "The displayed wave residuals have different exact polynomial coefficients.",
      };
}

/** Exact algebra only; the physical premises and the construction of the map remain admitted. */
export function verifySRSphericalWave(
  chain: DerivationChain = srSphericalWaveChain,
  movingWave: Expression = srSphericalWaveConclusion,
): ChainVerificationReport {
  // Keep the shared schema, dependency-graph and anti-circularity diagnostics.
  // None of its sampled per-step results is used as evidence for this report.
  const structural = verifyChain(chain, { isPublicationGate: true });
  const errors = [...structural.errors];
  const dependency = dependencyProblem(chain);
  if (dependency) errors.push(dependency);
  const conclusion = projectDerivationSymbols(
    movingWave,
    (node) => node.quantityId + (node.index ? `.${node.index}` : ""),
  );
  if (!structurallyEqual(conclusion, srSphericalWaveConclusion))
    errors.push("The supplied conclusion must be the moving-frame spherical light-wave equation.");
  const stepReports: StepVerificationReport[] = chain.steps.map((step, index) => {
    const result = exactStep(step, index, chain);
    const passed = result.outcome === "pass";
    return {
      stepId: step.id,
      ruleKind: step.rule.kind,
      ruleOutcome: result.outcome,
      ruleReason: result.reason,
      verificationStatus: passed ? "verified" : "failed",
      passed,
      ...(passed ? {} : { error: result.reason ?? "Exact spherical-wave verification failed." }),
    };
  });
  const passed =
    errors.length === 0 &&
    structural.graphIssues.length === 0 &&
    stepReports.length === 4 &&
    stepReports.every((step) => step.passed);
  return Object.freeze({
    ...structural,
    passed,
    isPublicationReady: passed,
    stepReports: Object.freeze(stepReports),
    errors: Object.freeze(errors),
  });
}
