/**
 * Brownian §5: solve the method-of-moments matching equation for a molecular-number estimate.
 * The population moment law and Stokes–Einstein law are admitted physical premises. Matching
 * their prediction to an observed mean square defines the estimate; it does not equate a finite
 * sample with the population or prove the Gaussian integral, unbiasedness, or model validity.
 */
import inferenceRecord from "../../../content/equations/brownian-motion/eq-model-bm-avogadro-inference.json";
import molarRecord from "../../../content/equations/brownian-motion/eq-model-bm-diffusivity-molar.json";
import momentRecord from "../../../content/equations/brownian-motion/eq-model-bm-mean-square-growth.json";
import { type Expression, walk } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { structurallyEqual, substituteNode } from "./treeUtils.ts";
import {
  type DerivationChain,
  DerivationSchemaError,
  type DerivationStep,
  type PremiseRef,
} from "./types.ts";

type Relation = Extract<Expression, { kind: "relation" }>;
type SymbolExpression = Extract<Expression, { kind: "symbol" }>;
type CanonicalRecord = Readonly<{ id: string; tree: unknown }>;

export class BrownianInferenceError extends DerivationSchemaError {
  readonly code: string;

  constructor(code: string, message: string, path: string) {
    super(message, path);
    this.code = code;
  }
}

/** Preserve quantity, index and evaluation point; occurrence ids alone are not a binding. */
function bindingKey(symbol: SymbolExpression): string {
  return JSON.stringify(
    [symbol.quantityId, symbol.index ?? "", symbol.at ?? null, symbol.args ?? null],
    (key, value) => (key === "termId" || key === "opId" ? undefined : value),
  );
}
const named = (quantityId: string): SymbolExpression => ({
  kind: "symbol",
  termId: bindingKey({ kind: "symbol", termId: "", quantityId }),
  quantityId,
});
const number = (value: string): Expression => ({ kind: "number", value });
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const quotient = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
const equation = (left: Expression, right: Expression, id: string): Relation => ({
  kind: "relation",
  operator: "=",
  left,
  right,
  opId: "bm-inference.op." + id,
});
const pi: Expression = { kind: "constant", name: "pi" };
const R = named("molarGasConstant");
const T = named("temperature");
const eta = named("viscosity");
const radius = named("particleRadius");
const N = named("avogadroConstant");
const estimate = named("avogadroNumberEstimate");
const D = named("diffusionCoefficient");
const interval = named("observationInterval");
const meanSquare: Expression = {
  kind: "average",
  argument: { kind: "power", base: named("displacement1d"), exponent: { num: 2, den: 1 } },
};

/**
 * Validate the canonical quantities and coefficients before constructing the fit. A same-unit
 * substitute (diameter for radius, radial for one-axis displacement, constant for estimate) is
 * not interchangeable. The checked route must not silently follow a changed canonical law.
 */
export function createBrownianInferenceSetup(
  diffusivityRecord: CanonicalRecord = molarRecord,
  populationRecord: CanonicalRecord = momentRecord,
  estimateRecord: CanonicalRecord = inferenceRecord,
) {
  const modelDiffusivity = projectDerivationSymbols(
    diffusivityRecord.tree as Expression,
    bindingKey,
  );
  const populationMoment = projectDerivationSymbols(
    populationRecord.tree as Expression,
    bindingKey,
  );
  const result = projectDerivationSymbols(estimateRecord.tree as Expression, bindingKey);
  const expectedDiffusivity = equation(
    D,
    quotient(product(R, T), product(number("6"), pi, eta, radius, N)),
    "expected-diffusivity",
  );
  const expectedMoment = equation(
    meanSquare,
    product(number("2"), D, interval),
    "expected-moment",
  );
  const expectedResult = equation(
    estimate,
    quotient(product(R, T, interval), product(number("3"), pi, eta, radius, meanSquare)),
    "expected-estimate",
  );
  if (
    diffusivityRecord.id !== molarRecord.id ||
    populationRecord.id !== momentRecord.id ||
    estimateRecord.id !== inferenceRecord.id ||
    modelDiffusivity.kind !== "relation" ||
    populationMoment.kind !== "relation" ||
    result.kind !== "relation" ||
    !structurallyEqual(modelDiffusivity, expectedDiffusivity) ||
    !structurallyEqual(populationMoment, expectedMoment) ||
    !structurallyEqual(result, expectedResult) ||
    result.right.kind !== "quotient" ||
    result.right.denominator.kind !== "product"
  )
    throw new BrownianInferenceError(
      "bm-inference-canonical-mismatch",
      "The inference requires the canonical one-axis moment, molar diffusivity and distinct molecular-number estimate.",
      "brownian-inference.canonical-equations",
    );

  // This substitution defines the value fitted to the observations. It is an admitted fitting
  // convention, deliberately outside the checked algebra; it does not assert N = N-hat.
  const candidateDiffusivity = substituteNode(modelDiffusivity.right, N.termId, result.left);
  const matching = equation(
    populationMoment.left,
    substituteNode(populationMoment.right, D.termId, candidateDiffusivity),
    "observed-moment-matching",
  );
  const numerator = result.right.numerator;
  const drag = product(...result.right.denominator.args.slice(0, -1));
  const collected = equation(
    populationMoment.left,
    quotient(numerator, product(...result.right.denominator.args.slice(0, -1), result.left)),
    "collect-two-over-six",
  );
  const cleared = equation(
    product(populationMoment.left, result.left),
    quotient(numerator, drag),
    "clear-estimate-denominator",
  );
  return Object.freeze({
    modelDiffusivity,
    populationMoment,
    matching,
    collected,
    cleared,
    result,
  });
}

export const brownianInferenceEquations = createBrownianInferenceSetup();

const admitted = (ref: string): PremiseRef => ({ ref, edgeType: "pedagogical-reconstruction" });
export const brownianInferencePremises = [
  admitted(molarRecord.id),
  admitted(momentRecord.id),
  admitted("bm-inference-observed-moment-fit"),
  admitted("bm-inference-independent-inputs"),
  admitted("bm-inference-positive-domain"),
] as const;
const draft = {
  historicalStatus: "pedagogical-reconstruction",
  modelStatus: "exact-within-model",
  verification: { status: "authored-unverified" },
} as const;
const { matching, collected, cleared, result } = brownianInferenceEquations;

export const brownianInferenceChain: DerivationChain = {
  id: "chain-bm-molecular-number-inference",
  proofRouteId: "route-bm-observed-moment-inversion",
  routeKind: "pedagogical-reconstruction",
  entryAssumptions: [...brownianInferencePremises],
  target: inferenceRecord.id,
  targetStepId: "bm-inference-isolate-estimate",
  essentialForPrint: true,
  steps: [
    {
      ...draft,
      id: "bm-inference-collect-two-over-six",
      from: matching,
      to: collected,
      changedSubexpressionIds: [
        "bm-inference.op.observed-moment-matching",
        "bm-inference.op.collect-two-over-six",
      ],
      rule: { kind: "collect", params: { exact: true } },
      reasonKind: "algebra",
      reasons: {
        r0: "Choose the molecular number whose predicted spread matches the observed mean square, then collect two divided by six.",
        r1: "The starting equality defines a fit: its brackets now contain the observed mean of squared one-axis displacements. Insert the molar diffusivity evaluated at the candidate estimate. The factor 2 from the one-axis moment law combines with 6 in Stokes drag to leave 3 in the denominator.",
        r2: "The admitted population law is E[x²] = 2Dt, and the admitted molar law is D = RT/(6πηaN). For this fit only, choose N-hat so that the model mean square equals the observed mean square m₂. This gives the entry equation m₂ = 2t RT/(6πηa N-hat). The checked operation is exact collection: 2/6 = 1/3, with the same R, T, observation interval, viscosity and radius throughout. It checks neither the population moment calculation nor the statistical decision to fit that moment. A finite-sample mean need not equal E[x²].",
      },
      tool: "foundation:bridge-fractions-ratios",
      premiseRefs: [...brownianInferencePremises],
      sourceAnchor: "bm-inference-source-inversion",
      isMove: true,
      moveLabel: "Fit the model's predicted spread to an independently observed mean square.",
    },
    {
      ...draft,
      id: "bm-inference-clear-estimate-denominator",
      from: collected,
      to: cleared,
      changedSubexpressionIds: [
        "bm-inference.op.collect-two-over-six",
        "bm-inference.op.clear-estimate-denominator",
      ],
      rule: {
        kind: "add-subtract-multiply-divide",
        params: { operation: "multiply", quantity: result.left, simplify: true },
      },
      reasonKind: "algebra",
      reasons: {
        r0: "Multiply both sides by the positive fitted molecular number to remove it from the denominator.",
        r1: "The fitted molecular number occurs below the fraction bar. Multiplying both sides by it gives the observed mean square times the estimate on the left, and RTt divided by 3πηa on the right.",
        r2: "The entry domain requires positive finite R, T, t, η, a, mean square and candidate N-hat. The matching equation already excludes N-hat = 0, so cancellation retains that domain. Multiplication produces m₂ N-hat = RTt/(3πηa). No observed molecular number, defined modern Avogadro constant, or Boltzmann constant has been inserted; N-hat remains the fitted unknown.",
      },
      tool: "foundation:bridge-fractions-ratios",
      premiseRefs: [admitted("bm-inference-positive-domain")],
      sourceAnchor: "bm-inference-source-inversion",
      isMove: false,
    },
    {
      ...draft,
      id: "bm-inference-isolate-estimate",
      from: cleared,
      to: result,
      changedSubexpressionIds: [
        "bm-inference.op.clear-estimate-denominator",
        "eq-model-bm-avogadro-inference.op.relation",
      ],
      rule: {
        kind: "add-subtract-multiply-divide",
        params: {
          operation: "divide",
          quantity: brownianInferenceEquations.populationMoment.left,
          nonzeroCondition: "The observed one-axis mean square is strictly positive.",
          simplify: true,
        },
      },
      reasonKind: "algebra",
      reasons: {
        r0: "Divide by the observed mean square. The molecular-number estimate is now alone.",
        r1: "The observed mean square must be positive: divide both sides by it to obtain N-hat = RTt/(3πηa m₂). This is the canonical estimate equation, with an independently supplied particle radius.",
        r2: "Division by m₂ > 0 yields the canonical avogadroNumberEstimate quantity, not avogadroConstant. If every recorded displacement is zero, this inversion has no finite estimate in the stated positive model; it does not measure an infinite molecular number. With radius unknown, the same equality determines only aN-hat: multiplying a by a positive factor and dividing N-hat by that factor leaves the predicted spread unchanged. Finite sampling, drift, localization error, exposure and uncertainty in the independent inputs need their own analysis. Inverting an unbiased diffusivity estimate does not in general give an unbiased molecular-number estimate.",
      },
      tool: "foundation:two-measurements-two-unknowns",
      premiseRefs: [
        admitted("bm-inference-positive-domain"),
        admitted("bm-inference-independent-inputs"),
      ],
      sourceAnchor: "bm-inference-source-measurement",
      isMove: false,
    },
  ],
};

const glyphs: Readonly<Record<string, string>> = {
  molarGasConstant: "R",
  temperature: "T",
  viscosity: "η",
  particleRadius: "a",
  avogadroConstant: "N",
  avogadroNumberEstimate: "\\widehat{N}",
  diffusionCoefficient: "D",
  observationInterval: "t",
  displacement1d: "x",
};

export function presentBrownianInferenceExpression(expression: Expression): Expression {
  return projectDerivationSymbols(
    expression,
    (symbol) => glyphs[symbol.quantityId] ?? symbol.quantityId,
  );
}
export function presentBrownianInferenceChain(chain: DerivationChain): DerivationChain {
  const symbols = new Map<string, string>();
  for (const step of chain.steps)
    for (const node of [...walk(step.from), ...walk(step.to)])
      if (node.kind === "symbol")
        symbols.set(node.termId, glyphs[node.quantityId] ?? node.quantityId);
  return {
    ...chain,
    steps: chain.steps.map((step) => ({
      ...step,
      from: presentBrownianInferenceExpression(step.from),
      to: presentBrownianInferenceExpression(step.to),
      changedSubexpressionIds: step.changedSubexpressionIds.map((id) => symbols.get(id) ?? id),
    })),
  };
}

export const brownianInferenceMetadata = {
  argument: "arg-bm-inference",
  anchor: "bm-molecular-number-derivation",
  ownerBeadId: "am-bm-equations-s4-s5-6r81",
} as const;
export const brownianInferenceHistory =
  "In §5 Einstein reverses the displacement relation and proposes determining N from a measured displacement, ending by hoping an investigator will test it. The paper's λₓ² denotes the one-axis mean square; k denotes viscosity and P the particle radius. This teaching reconstruction uses η and a, and writes N-hat to distinguish a finite-sample estimate from the unknown model parameter. The explicit moment-fitting convention and its statistical qualifications are modern explanations, not a claim about Einstein's private reasoning or a measurement reported in 1905.";
export function brownianInferenceReadingSet(step: DerivationStep) {
  return {
    ...step.reasons,
    r3: brownianInferenceHistory,
    r3Citations: [
      "Einstein, A. (1905). Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen. Annalen der Physik 17, 549–560 (§5, p. 560).",
    ],
  };
}
