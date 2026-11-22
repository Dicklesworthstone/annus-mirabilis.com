/** The volume argument of Brownian §2. These are source-linked teaching trees,
 * not additional printed equations or a proof of the statistical premises. */
import type { Expression } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import type { FoundationToolId, StepReadings } from "./types.ts";

type Symbol = Extract<Expression, { kind: "symbol" }>;
type Relation = Extract<Expression, { kind: "relation" }>;
const symbol = (quantityId: string): Symbol => ({ kind: "symbol", termId: quantityId, quantityId });
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const quotient = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
const negate = (argument: Expression): Expression => ({ kind: "negate", argument });
const log = (argument: Expression): Expression => ({ kind: "function", name: "ln", argument });
const equal = (left: Expression, right: Expression): Relation => ({
  kind: "relation",
  operator: "=",
  left,
  right,
});
const one: Expression = { kind: "number", value: "1" };
const zero: Expression = { kind: "number", value: "0" };

export const brownianOsmoticSymbols = Object.freeze({
  R: symbol("molarGasConstant"),
  N: symbol("avogadroConstant"),
  T: symbol("temperature"),
  count: symbol("particleCount"),
  V: symbol("volume"),
  V0: symbol("referenceVolume"),
  J: symbol("configurationIntegralFactor"),
  Jprime: symbol("alternativeConfigurationFactor"),
  B: symbol("configurationIntegral"),
  entropy: symbol("entropy"),
  meanEnergy: symbol("meanEnergy"),
  freeEnergy: symbol("freeEnergy"),
  deltaF: symbol("freeEnergyDifference"),
  density: symbol("numberDensity"),
  pressure: symbol("osmoticPressure"),
  dB: symbol("configurationSlice"),
  dBprime: symbol("alternativeConfigurationSlice"),
  cell: symbol("configurationCellVolume"),
  kB: symbol("boltzmannConstant"),
  clusterPressure: symbol("clusterPressure"),
  clusterDeltaF: symbol("clusterFreeEnergyDifference"),
});
const s = brownianOsmoticSymbols;
const thermal = quotient(product(s.R, s.T), s.N);
const volumeRatio = quotient(s.V, s.V0);
const derivative = (expression: Expression): Expression => ({
  kind: "derivative",
  expression,
  variable: s.V,
  order: 1,
  partial: true,
  heldFixed: [s.T, s.count],
});
const sourceEntropy = sum(quotient(s.meanEnergy, s.T), product(quotient(s.R, s.N), log(s.B)));
const sourceFreeEnergy = negate(product(thermal, log(s.B)));
const expandedFreeEnergy = negate(product(thermal, sum(log(s.J), product(s.count, log(s.V)))));
const referenceFreeEnergy = negate(product(thermal, sum(log(s.J), product(s.count, log(s.V0)))));
const freeEnergyDifference = negate(product(thermal, s.count, log(volumeRatio)));
const pressure = quotient(product(thermal, s.count), s.V);
const clusterDeltaF = negate(product(thermal, log(volumeRatio)));
const clusterPressure = quotient(thermal, s.V);

export const brownianOsmoticExpressions = Object.freeze({
  thermalNotation: equal(s.kB, quotient(s.R, s.N)),
  entropyPremise: equal(s.entropy, sourceEntropy),
  freeEnergyDefinition: equal(s.freeEnergy, sum(s.meanEnergy, negate(product(s.T, s.entropy)))),
  freeEnergySubstitution: equal(
    s.freeEnergy,
    sum(s.meanEnergy, negate(product(s.T, sourceEntropy))),
  ),
  sourceFreeEnergy: equal(s.freeEnergy, sourceFreeEnergy),
  slice: equal(s.dB, product(s.J, s.cell)),
  cellRatio: equal(quotient(s.dB, s.dBprime), quotient(s.J, s.Jprime)),
  equalCellProbability: equal(quotient(s.dB, s.B), quotient(s.dBprime, s.B)),
  uniformWeight: equal(s.J, s.Jprime),
  oneParticleRatio: equal(symbol("oneParticleArrangementRatio"), volumeRatio),
  twoParticleRatio: equal(symbol("twoParticleArrangementRatio"), {
    kind: "power",
    base: volumeRatio,
    exponent: { num: 2, den: 1 },
  }),
  factorization: equal(s.B, product(s.J, { kind: "symbolPower", base: s.V, exponent: s.count })),
  factorRatio: equal(symbol("arrangementRatio"), {
    kind: "symbolPower",
    base: volumeRatio,
    exponent: s.count,
  }),
  sourceLogFreeEnergy: equal(s.freeEnergy, expandedFreeEnergy),
  freeEnergySubtraction: equal(s.deltaF, sum(expandedFreeEnergy, negate(referenceFreeEnergy))),
  freeEnergyDifference: equal(s.deltaF, freeEnergyDifference),
  fixedFactorDerivative: equal(derivative(log(s.J)), zero),
  logarithmDerivative: equal(derivative(log(volumeRatio)), quotient(one, s.V)),
  freeEnergyDerivative: equal(derivative(freeEnergyDifference), negate(pressure)),
  pressureDefinition: equal(s.pressure, negate(derivative(s.freeEnergy))),
  independentPressure: equal(s.pressure, pressure),
  numberDensity: equal(s.density, quotient(s.count, s.V)),
  densityPressure: equal(s.pressure, product(thermal, s.density)),
  lockedFactorRatio: equal(symbol("clusterArrangementRatio"), volumeRatio),
  lockedFreeEnergyDifference: equal(s.clusterDeltaF, clusterDeltaF),
  lockedPressure: equal(s.clusterPressure, clusterPressure),
});

export type BrownianOsmoticExpressions = typeof brownianOsmoticExpressions;
export type BrownianOsmoticStep = Readonly<{
  id: string;
  title: string;
  reasons: StepReadings;
  expressions: readonly Expression[];
  source: Readonly<{ anchor: string; label: string }>;
  tool: FoundationToolId;
  isMove?: boolean;
}>;

const e = brownianOsmoticExpressions;
export const brownianOsmoticSteps: readonly BrownianOsmoticStep[] = Object.freeze([
  {
    id: "bm-osmotic-statistical-start",
    title: "Admit the statistical starting point",
    tool: "foundation:free-energy-osmotic-pressure",
    source: { anchor: "eq-s2-d3", label: "Read the entropy and free-energy starting point" },
    expressions: [
      e.entropyPremise,
      e.freeEnergyDefinition,
      e.freeEnergySubstitution,
      e.sourceFreeEnergy,
    ],
    reasons: {
      r0: "The earlier theory relates free energy to how many microscopic states are available. The average energy cancels when the free energy is formed.",
      r1: "Einstein takes his statistical theory of 1902–1903 as a premise. It gives S = Ē/T + (R/N) ln B. Substitute this in F = Ē − TS: the two average-energy terms cancel, leaving F = −(RT/N) ln B. This algebra does not establish the earlier statistical theory.",
      r2: "B is an integral of exp(−EN/RT) over the admitted state variables of the whole system; E inside that integral is state-dependent, while Ē is its mean. The source first assumes equations of motion with a zero summed divergence in those state coordinates. Those dynamical/statistical premises are not derived here. The cancellation uses the same positive T in both terms and 2κ = R/N; Einstein's κ alone is not modern kB. The state coordinates p₁,…,pₗ are not all momenta and are not the pressure p.",
    },
  },
  {
    id: "bm-osmotic-equal-cells",
    title: "Compare equal little boxes",
    tool: "foundation:probability-independence",
    isMove: true,
    source: { anchor: "s2-p5-s2", label: "Read the independence and homogeneity premises" },
    expressions: [e.slice, e.cellRatio, e.equalCellProbability, e.uniformWeight],
    reasons: {
      r0: "Move each particle's little box without changing its size. If all equal placements are equally probable, the unexplained factor cannot depend on where those boxes are.",
      r1: "A small configuration cell contributes dB = J dΓ. Compare a second set of boxes with the same product of volumes dΓ. Their integral ratio is J/J′. The statistical premise identifies dB/B as a probability. Independent particles in a homogeneous liquid, with no external forces, give equal probabilities for the two placements, so J = J′.",
      r2: "dΓ abbreviates dx₁ dy₁ dz₁ … dxₙ dyₙ dzₙ; it is not an extra printed symbol. Equal box sizes cancel in dB/dB′. Equal probabilities then give equality of the remaining weights, provided the common B and the cell weights are positive. Uniform one-particle marginals alone would not give independent joint placements. The dilution assumption also removes excluded-volume correlations. Independence, homogeneity and the absence of forces are physical assumptions, not consequences of the equality we write down.",
    },
  },
  {
    id: "bm-osmotic-volume-factors",
    title: "Give each independently placed particle its own volume factor",
    tool: "foundation:probability-independence",
    source: { anchor: "eq-s2-d10", label: "Read B = J V*ⁿ in the source" },
    expressions: [e.oneParticleRatio, e.twoParticleRatio, e.factorization, e.factorRatio],
    reasons: {
      r0: "Twice the room gives one independently placed particle twice the arrangements. Two particles give four times the arrangements. Each additional independent placement adds another factor.",
      r1: "The source separately treats J as independent of the confining wall's volume V*. Each of the n centres ranges freely over that same volume, so integrating their coordinates gives B = J V*ⁿ. Comparing with a reference volume V₀ at the same temperature and particle count gives B/B₀ = (V*/V₀)ⁿ.",
      r2: "The factorization uses a product of n accessible spatial domains and a common position-independent J. J's independence of position at one fixed volume does not, by itself, prove its independence of V*: the source admits that second property when moving the selective wall. Momentum, solvent and internal contributions may remain unknown inside J. At fixed T and n, any V-independent normalization, including an n-dependent counting convention, cancels in this ratio and the pressure derivative. Crowding or interactions can destroy the product domain or introduce a V-dependent J.",
    },
  },
  {
    id: "bm-osmotic-free-energy-change",
    title: "Let the logarithm separate what changes",
    tool: "foundation:logarithms",
    source: { anchor: "eq-s2-d11", label: "Read the separated free-energy terms" },
    expressions: [e.sourceLogFreeEnergy, e.freeEnergySubtraction, e.freeEnergyDifference],
    reasons: {
      r0: "The logarithm turns the repeated volume factors into a multiple of one logarithm. Comparing two volumes removes the unknown constant part.",
      r1: "The paper writes F = −(RT/N){ln J + n ln V*}. Subtract the same expression at V₀. The ln J terms cancel, leaving ΔF = −(RT/N)n ln(V*/V₀). Expansion lowers this configurational free energy; unchanged volume gives zero change.",
      r2: "The source's absolute logarithms use its fixed phase-space measure and volume units. The reference-volume version displayed here is the modern teaching form: V*/V₀ is dimensionless and positive, so ln(V*/V₀) = ln V* − ln V₀ in the same fixed units. It states only a difference, not a computed absolute F or B. The same J must apply at both volumes; a volume-dependent J would leave an extra −(RT/N) ln[J(V*)/J(V₀)] term.",
    },
  },
  {
    id: "bm-osmotic-pressure-derivative",
    title: "Differentiate at fixed temperature and particle count",
    tool: "foundation:partial-derivatives",
    source: { anchor: "eq-s2-d12", label: "Read the volume derivative and pressure" },
    expressions: [
      e.fixedFactorDerivative,
      e.logarithmDerivative,
      e.freeEnergyDerivative,
      e.pressureDefinition,
      e.independentPressure,
    ],
    reasons: {
      r0: "Pressure measures how fast the free energy falls when the wall moves outward. The unknown constant part does not change, and the two minus signs leave a positive pressure.",
      r1: "Hold T, n and the reference volume fixed. Since J does not change with V*, its derivative is zero. The derivative of ln(V*/V₀) is 1/V*. The thermodynamic relation p = −∂F/∂V* therefore gives p = nRT/(NV*).",
      r2: "The derivative is an isothermal virtual displacement of a wall that confines the particles while admitting the solvent. R and N are constants; T, n and V₀ are held fixed. ∂ΔF/∂V* equals ∂F/∂V* because the reference free energy does not vary. The thermodynamic identification of minus that derivative with osmotic pressure is an admitted equilibrium work relation. If J depends on V*, the additional term (RT/N)∂ln J/∂V* survives. No pressure law for an arbitrary interacting suspension follows by silently setting it to zero.",
    },
  },
  {
    id: "bm-osmotic-number-density",
    title: "Count particles per unit volume",
    tool: "foundation:ratios-scaling",
    source: { anchor: "s2-p8-s1", label: "Read the conclusion for molecules and suspended bodies" },
    expressions: [e.numberDensity, e.densityPressure],
    reasons: {
      r0: "Only the number of independently placed particles per unit volume remains. Their sizes and detailed motions were never needed for this dilute pressure law.",
      r1: "Write ν = n/V* for number density, as the paper does. Then p = (RT/N)ν, the osmotic law proposed in §1. Under the same dilution assumptions, equal numbers of dissolved molecules and suspended bodies produce the same osmotic pressure.",
      r2: "The paper's n here is a particle count, ν is a number density, and N is the number of molecules in a gram-molecule. Modern notation often writes Np, n and NA for these three different quantities, with kB = R/N. Section 3 uses the pressure gradient of this law together with Stokes mobility and equilibrium diffusion. The counting argument determines neither a collision trajectory nor whether a particular experimental suspension actually satisfies its hypotheses.",
    },
  },
]);

const historicalGlyphs: Readonly<Record<string, string>> = Object.freeze({
  molarGasConstant: "R",
  avogadroConstant: "N",
  temperature: "T",
  particleCount: "n",
  volume: "V^{*}",
  referenceVolume: "V_0",
  configurationIntegralFactor: "J",
  alternativeConfigurationFactor: "J'",
  configurationIntegral: "B",
  entropy: "S",
  meanEnergy: "\\bar E",
  freeEnergy: "F",
  freeEnergyDifference: "\\Delta F",
  numberDensity: "ν",
  osmoticPressure: "p",
  configurationSlice: "dB",
  alternativeConfigurationSlice: "dB'",
  configurationCellVolume: "d\\Gamma",
  boltzmannConstant: "k_B",
  oneParticleArrangementRatio: "A_1",
  twoParticleArrangementRatio: "A_2",
  arrangementRatio: "\\frac{B}{B_0}",
  clusterArrangementRatio: "\\frac{B_c}{B_{c,0}}",
  clusterPressure: "p_c",
  clusterFreeEnergyDifference: "\\Delta F_c",
});

export function presentBrownianOsmoticExpression(
  expression: Expression,
  perspective: "historical" | "modern" = "historical",
): Expression {
  const modern: Readonly<Record<string, string>> = {
    particleCount: "N_p",
    numberDensity: "n",
    avogadroConstant: "N_A",
    volume: "V",
    osmoticPressure: "\\Pi",
  };
  return projectDerivationSymbols(
    expression,
    (node) =>
      (perspective === "modern" ? modern[node.quantityId] : undefined) ??
      historicalGlyphs[node.quantityId] ??
      node.quantityId,
  );
}
