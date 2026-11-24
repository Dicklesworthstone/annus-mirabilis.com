/** Conditional teaching steps for the classical total (§1) and independent-point entropy (§5). */
import densityRecord from "../../../content/equations/light-quanta/eq-model-lq-classical-density.json";
import entropyRecord from "../../../content/equations/light-quanta/eq-model-lq-configuration-entropy.json";
import probabilityRecord from "../../../content/equations/light-quanta/eq-model-lq-configuration-probability.json";
import integralRecord from "../../../content/equations/light-quanta/eq-model-lq-cutoff-integral.json";
import totalRecord from "../../../content/equations/light-quanta/eq-model-lq-cutoff-total.json";
import type { Expression } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { substituteNode } from "./treeUtils.ts";
import type { FoundationToolId, StepReadings } from "./types.ts";

type Relation = Extract<Expression, { kind: "relation" }>;
type Symbol = Extract<Expression, { kind: "symbol" }>;
const symbol = (quantityId: string, index?: string): Symbol => ({
  kind: "symbol",
  termId: quantityId + (index ? `[${index}]` : ""),
  quantityId,
  ...(index ? { index } : {}),
});
export const foundationNumber = (value: string): Expression => ({ kind: "number", value });
export const foundationProduct = (...args: Expression[]): Expression => ({ kind: "product", args });
export const foundationRelation = (left: Expression, right: Expression): Relation => ({
  kind: "relation",
  operator: "=",
  left,
  right,
});
export const foundationLog = (argument: Expression): Expression => ({
  kind: "function",
  name: "ln",
  argument,
});

/** Occurrence ids are projected; a cutoff index and any function argument remain distinct. */
export const projectLqFoundationExpression = (expression: Expression): Expression =>
  projectDerivationSymbols(
    expression,
    (node) => node.quantityId + (node.index ? `[${node.index}]` : ""),
  );

const nu = symbol("frequency");
const cutoff = symbol("frequency", "c");
const k = symbol("boltzmannConstant");
const T = symbol("temperature");
const c = symbol("speedOfLight");
const f = symbol("volumeRatio");
const n = symbol("independentPointCount");
const W = symbol("configurationProbability");
const zero = foundationNumber("0");
const one = foundationNumber("1");
const density = projectLqFoundationExpression(densityRecord.tree as Expression) as Relation;
const integral = projectLqFoundationExpression(integralRecord.tree as Expression) as Relation;
const total = projectLqFoundationExpression(totalRecord.tree as Expression) as Relation;
const probability = projectLqFoundationExpression(probabilityRecord.tree as Expression) as Relation;
const entropy = projectLqFoundationExpression(entropyRecord.tree as Expression) as Relation;
const principle = entropy.left as Relation;
const primitive: Expression = {
  kind: "quotient",
  numerator: foundationProduct(density.right, nu),
  denominator: foundationNumber("3"),
};
const doubled = foundationProduct(foundationNumber("2"), cutoff);
const substitutedIntegral = foundationRelation(integral.left, {
  ...(integral.right as Extract<Expression, { kind: "integral" }>),
  expression: density.right,
});
const substitutedEntropy = foundationRelation(
  principle.left,
  substituteNode(principle.right, W.termId, probability.right),
);
const growth = foundationRelation(
  { ...(total.left as Symbol), at: doubled },
  foundationProduct(foundationNumber("8"), total.left),
);

export const lqFoundationSymbols = { nu, cutoff, k, T, c, f, n, W, zero, one } as const;
export const lqFoundationExpressions = {
  density,
  integral,
  substitutedIntegral,
  primitive,
  total,
  growth,
  derivative: foundationRelation(
    {
      kind: "derivative",
      expression: primitive,
      variable: nu,
      order: 1,
      partial: false,
    },
    density.right,
  ),
  probability,
  principle,
  substitutedEntropy,
  entropy,
  logarithm: foundationRelation(
    foundationLog(probability.right),
    foundationProduct(n, foundationLog(f)),
  ),
  entropyConclusion: foundationRelation(principle.left, entropy.right),
} as const;

export const classicalCutoffRecords = [densityRecord, integralRecord, totalRecord] as const;
export const independentEntropyRecords = [probabilityRecord, entropyRecord] as const;

export const classicalCutoffAssumptions = [
  {
    id: "lq-classical-equilibrium-density",
    label: "The classical spectrum is an admitted physical premise",
    explanation:
      "Use ρν = (8πν²/c³)kBT. The source obtains it by combining kinetic equilibrium with Planck's resonator-radiation equilibrium condition. This calculation does not derive those physical assumptions or establish their applicability to real radiation.",
  },
  {
    id: "lq-classical-positive-fixed-parameters",
    label: "Positive constants and temperature held fixed",
    explanation:
      "kB, c and T are strictly positive and independent of frequency. The cutoff νc is positive. In this teaching notation kB denotes the paper's R/N and c denotes L; no modern numerical constant is substituted.",
  },
  {
    id: "lq-classical-frequency-integral",
    label: "Integrate energy density over frequency",
    explanation:
      "u(νc) is the energy per unit volume in the frequency interval from zero to νc. The density is continuous and nonnegative there. The cutoff is a finite comparison boundary, not a physical repair to the model.",
  },
] as const;
export const independentEntropyAssumptions = [
  {
    id: "lq-independent-uniform-points",
    label: "Independent points with no preferred position",
    explanation:
      "There are n independently placed points, with n a nonnegative integer. Each is uniformly distributed in V₀. Independence supplies the admitted product law W = fⁿ for f = V/V₀; correlated points do not satisfy that premise.",
  },
  {
    id: "lq-independent-positive-fraction",
    label: "A positive part of the reference volume",
    explanation:
      "The chosen fraction satisfies 0 < f ≤ 1 and kB = R/N is positive. At f = 1 the entropy difference is zero. f = 0 is outside the logarithm's domain; no finite entropy is assigned to an impossible configuration.",
  },
  {
    id: "lq-independent-boltzmann-principle",
    label: "Boltzmann's relative-probability relation",
    explanation:
      "Admit ΔS = kB ln W, with the reference state fixing the additive entropy constant. The paper obtains the logarithmic form from independence and entropy additivity and takes its coefficient from kinetic theory. That thermodynamic argument remains a premise of the calculation below.",
  },
] as const;

export interface ClassicalCutoffInput {
  readonly density: Expression;
  readonly integral: Expression;
  readonly substitutedIntegral: Expression;
  readonly primitive: Expression;
  readonly total: Expression;
  readonly growth: Expression;
  readonly premises: readonly string[];
}
export interface IndependentEntropyInput {
  readonly probability: Expression;
  readonly principle: Expression;
  readonly substitutedEntropy: Expression;
  readonly logarithm: Expression;
  readonly entropy: Expression;
  readonly premises: readonly string[];
}
export const classicalCutoffInput: ClassicalCutoffInput = {
  density,
  integral,
  substitutedIntegral,
  primitive,
  total,
  growth,
  premises: classicalCutoffAssumptions.map((premise) => premise.id),
};
export const independentEntropyInput: IndependentEntropyInput = {
  probability,
  principle,
  substitutedEntropy,
  logarithm: lqFoundationExpressions.logarithm,
  entropy,
  premises: independentEntropyAssumptions.map((premise) => premise.id),
};

export const classicalCutoffCheckRows = [
  "classical-premises",
  "classical-substitution",
  "classical-antiderivative",
  "classical-zero-boundary",
  "classical-cutoff-evaluation",
  "classical-unbounded-growth",
] as const;
export const independentEntropyCheckRows = [
  "independent-premises",
  "independent-substitution",
  "independent-positive-logarithm",
  "independent-entropy-conclusion",
  "independent-reference-boundaries",
] as const;

export type LqFoundationsSection = "s1" | "s5";
export const lqFoundationsMetadata = {
  s1: {
    ownerBeadId: "am-lq-equations-s1-s4-9gl5",
    historicalReading:
      "On p. 136, Einstein combines the mean resonator energy from kinetic equilibrium with Planck's resonator-radiation relation and prints the integral over all frequencies as infinite. The finite cutoff, cubic antiderivative and repeated-doubling argument here unpack that printed limit. They do not add a physical cutoff to the paper or derive the equilibrium conditions. This reconstruction writes kB for R/N and c for L.",
    citation:
      "Einstein, A. (1905). Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt. Annalen der Physik 17, 132–148 (§1, p. 136).",
    sourceAnchor: "s1-p5",
  },
  s5: {
    ownerBeadId: "am-lq-equations-s5-s9-3cjh",
    historicalReading:
      "Section 5 first discusses the logarithmic relation between entropy and relative probability, fixing its coefficient through kinetic theory on p. 141. On p. 142, independently placed molecular points give W = (v/v₀)ⁿ and then S − S₀ = R(n/N) lg(v/v₀). The steps here begin after the logarithmic principle is admitted. They expose the substitution and power rule, using f for v/v₀ and kB for R/N, without claiming that algebra establishes the physical independence of real particles.",
    citation:
      "Einstein, A. (1905). Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt. Annalen der Physik 17, 132–148 (§5, pp. 140–142).",
    sourceAnchor: "s5-p8",
  },
} as const;
type FoundationStep = Readonly<{
  id: string;
  title: string;
  expressions: readonly Expression[];
  reasons: StepReadings;
  tool: FoundationToolId;
  toolLabel: string;
  source: Readonly<{ anchor: string; label: string }>;
  move?: string;
}>;
export const lqFoundationSteps: Readonly<Record<LqFoundationsSection, readonly FoundationStep[]>> =
  {
    s1: [
      {
        id: "lq-classical-admit-spectrum",
        title: "State the classical premise",
        expressions: [density],
        tool: "foundation:integration",
        toolLabel: "Review densities and integration",
        source: { anchor: "eq-s1-d7", label: "§1: the printed classical spectrum" },
        reasons: {
          r0: "The classical picture assigns more energy to equal-width bands at higher frequencies.",
          r1: "At a fixed positive temperature the density grows as frequency squared. The source combines two equilibrium conditions to obtain this law; that physical law is the starting premise here.",
          r2: "Hold kB, T and c fixed. Einstein equates the mean energy of one linear resonator oscillation, (R/N)T, to Planck's equilibrium value L³ρν/(8πν²). We use the resulting density in modern notation and check its integral, without claiming to prove either equilibrium assumption.",
        },
      },
      {
        id: "lq-classical-insert-spectrum",
        title: "Keep the upper frequency finite",
        expressions: [integral, substitutedIntegral],
        tool: "foundation:integration",
        toolLabel: "Review integration over a range",
        source: { anchor: "eq-s1-d8", label: "§1: the sum over frequencies" },
        move: "First integrate a finite interval, then ask whether its total has a finite limit.",
        reasons: {
          r0: "Add up the radiation below a chosen frequency. The upper boundary is still finite.",
          r1: "The integral adds spectral energy density over frequency. Its result is energy per unit volume, not another density per unit frequency.",
          r2: "Substitute the admitted density into u(νc) = ∫₀^{νc} ρν dν. The variable ν is distinct from the fixed upper boundary νc. No infinite value is inserted into finite arithmetic.",
        },
      },
      {
        id: "lq-classical-integrate-polynomial",
        title: "Check the antiderivative and its lower boundary",
        expressions: [lqFoundationExpressions.derivative, total],
        tool: "foundation:integration",
        toolLabel: "Review antiderivatives and endpoints",
        source: { anchor: "eq-s1-d8", label: "§1: the integral whose total diverges" },
        reasons: {
          r0: "Adding up a square gives a cube divided by three.",
          r1: "Differentiate the proposed cubic to recover the spectrum. Its limit at zero frequency is zero, so the upper endpoint alone supplies the finite integral.",
          r2: "For F(ν) = [8πkBT/(3c³)]ν³, exact differentiation gives F′(ν) = ρν and F(0) = 0. The fundamental theorem of calculus therefore gives u(νc) = F(νc) − F(0), including the factor 1/3.",
        },
      },
      {
        id: "lq-classical-widen-cutoff",
        title: "Let the frequency range keep widening",
        expressions: [growth],
        tool: "foundation:exponentials",
        toolLabel: "Review repeated multiplication",
        source: { anchor: "s1-p5", label: "§1: the paper's equilibrium difficulty" },
        reasons: {
          r0: "Every doubling of the upper frequency makes the total eight times larger. This cannot settle at a finite total.",
          r1: "The factor eight holds for every positive cutoff at the same temperature, not just a chosen numerical example. Starting from a positive total, repeated doublings grow without bound.",
          r2: "The checked identity u(2νc) = 8u(νc) gives u(2ᵐνc) = 8ᵐu(νc). Since u(νc) > 0 and the integrand is nonnegative, an integral over all frequencies cannot have a finite upper bound. A finite screen or cutoff does not cure that failure of the admitted model.",
        },
      },
    ],
    s5: [
      {
        id: "lq-independent-admit-product",
        title: "Name the independence assumption",
        expressions: [probability],
        tool: "foundation:probability-independence",
        toolLabel: "Review independent probabilities",
        source: { anchor: "eq-s5-d7", label: "§5: the independent-point probability" },
        move: "Independence permits one factor of the volume fraction for each point.",
        reasons: {
          r0: "One point has chance f of being in the chosen part. Independent points contribute one factor each.",
          r1: "Uniform position gives each point probability f = V/V₀. Independence supplies the product fⁿ. Giving several labels to one shared position would not supply several independent chances.",
          r2: "Admit a nonnegative integer count n and a uniform independent joint distribution. For 0 < f ≤ 1, the event that every point lies in the part has W = fⁿ. This is a statistical model assumption; the exact entropy calculation does not establish it from observations.",
        },
      },
      {
        id: "lq-independent-insert-probability",
        title: "Insert that probability into the entropy relation",
        expressions: [principle, substitutedEntropy],
        tool: "foundation:logarithms",
        toolLabel: "Review logarithms of probabilities",
        source: { anchor: "eq-s5-d6", label: "§5: Boltzmann's relative-probability relation" },
        reasons: {
          r0: "Use the chance of the whole configuration in the entropy formula.",
          r1: "Boltzmann's principle relates the entropy difference to the logarithm of the relative probability. Substituting fⁿ for W retains that reference state.",
          r2: "Begin with ΔS = kB ln W, where kB denotes R/N. Replace only W by the independent-point probability fⁿ. The logarithmic entropy principle and its kinetic-theory coefficient remain explicit physical premises.",
        },
      },
      {
        id: "lq-independent-take-logarithm",
        title: "Bring the count down from the exponent",
        expressions: [lqFoundationExpressions.logarithm, entropy],
        tool: "foundation:logarithms",
        toolLabel: "Review the logarithm power rule",
        source: { anchor: "eq-s5-d8", label: "§5: the resulting entropy-volume law" },
        reasons: {
          r0: "The logarithm turns the repeated product into a sum: one equal contribution per point.",
          r1: "For a positive fraction, ln(fⁿ) = n ln f. Multiplying by kB gives the independent-point entropy change with n as its coefficient.",
          r2: "The positive real power has fⁿ = exp(n ln f), so ln(exp(n ln f)) = n ln f. The checker applies that identity to the supplied expression and then compares the remaining products exactly. The coefficient n is never inferred from a numerical sample.",
        },
      },
    ],
  };

/** Each displayed step retains the same source-cited historical margin in its owner record. */
export const lqFoundationReadingSet = (step: FoundationStep, section: LqFoundationsSection) => ({
  ...step.reasons,
  r3: lqFoundationsMetadata[section].historicalReading,
  r3Citations: [lqFoundationsMetadata[section].citation],
});

const glyphs: Readonly<Record<string, string>> = {
  frequencyEnergyDensity: "ρ_ν",
  frequency: "ν",
  speedOfLight: "c",
  boltzmannConstant: "k_B",
  temperature: "T",
  energyDensityBelowCutoff: "u",
  configurationProbability: "W",
  volumeRatio: "f",
  independentPointCount: "n",
  gasEntropyChange: "ΔS",
};
export const presentLqFoundationExpression = (expression: Expression): Expression =>
  projectDerivationSymbols(expression, (node) => glyphs[node.quantityId] ?? node.quantityId);
