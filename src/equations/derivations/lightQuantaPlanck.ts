/** Section 2: an analytic low-frequency limit followed by a conditional coefficient inference. */
import avogadroRecord from "../../../content/equations/light-quanta/eq-model-lq-avogadro-from-spectrum.json";
import classicalRecord from "../../../content/equations/light-quanta/eq-model-lq-classical-density.json";
import coefficientRecord from "../../../content/equations/light-quanta/eq-model-lq-coefficient-match.json";
import spectrumRecord from "../../../content/equations/light-quanta/eq-model-lq-planck-low-frequency.json";
import type { Expression } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { substituteNode } from "./treeUtils.ts";
import type { FoundationToolId, StepReadings } from "./types.ts";

type Relation = Extract<Expression, { kind: "relation" }>;
type Symbol = Extract<Expression, { kind: "symbol" }>;
const symbol = (quantityId: string): Symbol => ({ kind: "symbol", quantityId, termId: quantityId });
export const planckNumber = (value: string): Expression => ({ kind: "number", value });
export const planckProduct = (...args: Expression[]): Expression => ({ kind: "product", args });
export const planckSum = (...args: Expression[]): Expression => ({ kind: "sum", args });
export const planckQuotient = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
export const planckRelation = (
  left: Expression,
  right: Expression,
  operator: Relation["operator"] = "=",
): Relation => ({ kind: "relation", operator, left, right });
export const planckExp = (argument: Expression): Expression => ({
  kind: "function",
  name: "exp",
  argument,
});
export const projectPlanckExpression = (expression: Expression): Expression =>
  projectDerivationSymbols(
    expression,
    (node) => node.quantityId + (node.index ? `[${node.index}]` : ""),
  );

const A = symbol("wienConstantAlpha"),
  B = symbol("wienConstantBeta"),
  nu = symbol("frequency"),
  T = symbol("temperature");
const R = symbol("molarGasConstant"),
  N = symbol("avogadroConstant"),
  c = symbol("speedOfLight"),
  k = symbol("boltzmannConstant");
// These two local mathematical names are defined here, not added to the physical quantity registry.
const x = symbol("spectralExpansionRatio"),
  thermal = symbol("thermalFrequencyScale");
const zero = planckNumber("0"),
  one = planckNumber("1");
const lowFrequency = projectPlanckExpression(spectrumRecord.tree as Expression) as Relation;
const classical = projectPlanckExpression(classicalRecord.tree as Expression) as Relation;
const coefficient = projectPlanckExpression(coefficientRecord.tree as Expression) as Relation;
const conclusion = projectPlanckExpression(avogadroRecord.tree as Expression) as Relation;
const exponent = planckQuotient(planckProduct(B, nu), T);
const frequencyScale = planckRelation(thermal, planckQuotient(T, B));
const difference = planckSum(planckExp(x), planckNumber("-1"));
const ratio = planckRelation(
  planckQuotient(lowFrequency.left, lowFrequency.right),
  planckQuotient(x, difference),
);
const limit = (expression: Expression): Expression => ({
  kind: "limit",
  variable: x,
  approaches: zero,
  expression,
});
const differenceLimit = planckRelation(limit(planckQuotient(difference, x)), one);
const spectrumLimit = planckRelation(limit(planckQuotient(x, difference)), one);
const molarClassical = planckRelation(
  classical.left,
  substituteNode(classical.right, k.termId, planckQuotient(R, N)),
);

export const lqPlanckSymbols = { A, B, nu, T, R, N, c, k, x, thermal, zero, one } as const;
export const lqPlanckExpressions = {
  lowFrequency,
  classical,
  coefficient,
  conclusion,
  exponent,
  frequencyScale,
  difference,
  ratio,
  differenceLimit,
  spectrumLimit,
  molarClassical,
} as const;
export const lqPlanckRecords = [
  spectrumRecord,
  classicalRecord,
  coefficientRecord,
  avogadroRecord,
] as const;

export const lqPlanckAssumptions = [
  {
    id: "lq-planck-admitted-spectrum",
    label: "Planck's fitted spectral law",
    explanation:
      "The spectrum Aν³/[exp(Bν/T) − 1] is admitted from the spectral model. Its fitted positive A and B are inputs; this calculation neither derives Planck's law nor establishes that radiation consists of independent light quanta.",
  },
  {
    id: "lq-planck-positive-domain",
    label: "A positive, dimensionless small ratio",
    explanation:
      "A, B, T, ν, R, N and c are positive. Let x = Bν/T approach zero through positive values, with the constants fixed. The quotient at x = 0 is undefined; a limit supplies its continuation, not a substituted zero divided by zero.",
  },
  {
    id: "lq-planck-common-classical-limit",
    label: "The same leading spectral density and units",
    explanation:
      "Admit the classical equilibrium coefficient from §1 and that both laws describe the same leading low-frequency spectral density. In consistent units kB denotes R/N. Their common ν²T factor may be cancelled for positive ν and T; agreement is asserted in the limit, not at every finite frequency.",
  },
  {
    id: "lq-planck-independent-input-provenance",
    label: "Measured inputs remain separate from the inferred number",
    explanation:
      "A and B come from the spectral fit, R from gas measurements, and c from a separate speed measurement. A modern constant set constructed using defined NA and kB would reproduce an input identity, not provide independent molecular evidence. The historical numerical reconstruction keeps its editorial inputs visible.",
  },
] as const;

export type LqPlanckInput = Readonly<{
  lowFrequency: Expression;
  classical: Expression;
  coefficient: Expression;
  conclusion: Expression;
  frequencyScale: Expression;
  difference: Expression;
  ratio: Expression;
  differenceLimit: Expression;
  spectrumLimit: Expression;
  premises: readonly string[];
}>;
export const lqPlanckInput: LqPlanckInput = {
  lowFrequency,
  classical,
  coefficient,
  conclusion,
  frequencyScale,
  difference,
  ratio,
  differenceLimit,
  spectrumLimit,
  premises: lqPlanckAssumptions.map((premise) => premise.id),
};
export const lqPlanckCheckRows = [
  "planck-premises",
  "planck-ratio-normalization",
  "planck-exponential-limit",
  "planck-reciprocal-limit",
  "planck-coefficient-match",
  "planck-number-inference",
] as const;

export const lqPlanckMetadata = {
  ownerBeadId: "am-lq-equations-s1-s4-9gl5",
  historicalReading:
    "On pp. 136–137, §2 compares Planck's fitted spectrum with the classical law only for large T/ν. It matches their coefficients and prints N = 6,17 · 10²³. The finite series and removable-limit steps here unpack that limiting comparison; they do not derive the empirical spectrum. The edition retains the printed α exponent −56 while its numerical reconstruction uses −57, with separately supplied historical R and L. Agreement of this calculation with the printed number does not establish the correctness of the spectral fit or the free-light hypothesis.",
  citation:
    "Einstein, A. (1905). Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt. Annalen der Physik 17, 132–148 (§2, pp. 136–137).",
} as const;
type PlanckStep = Readonly<{
  id: string;
  title: string;
  expressions: readonly Expression[];
  reasons: StepReadings;
  tool: FoundationToolId;
  source: string;
  move?: string;
}>;
export const lqPlanckSteps: readonly PlanckStep[] = [
  {
    id: "lq-planck-name-ratio",
    title: "Name the ratio that must become small",
    expressions: [lowFrequency, planckRelation(x, exponent), frequencyScale],
    tool: "foundation:taylor-expansion",
    source: "eq-s2-d1",
    reasons: {
      r0: "The comparison concerns low frequency relative to temperature, not every part of the spectrum.",
      r1: "Write x = Bν/T. Since B carries seconds times kelvin, x has no units. Holding B and T fixed while decreasing positive ν makes x approach zero.",
      r2: "Admit the fitted Planck law with positive A and B. Define the positive frequency scale νT = T/B, so x = ν/νT. This exact change of variables separates the limiting argument from physical units. The approximate sign on the leading spectrum remains: a local limit cannot make the two spectra identical at a finite frequency.",
    },
  },
  {
    id: "lq-planck-normalize-spectrum",
    title: "Compare the full spectrum with its proposed leading form",
    expressions: [ratio],
    tool: "foundation:bridge-fractions-ratios",
    source: "eq-s2-d4",
    move: "Compare a ratio of the spectra, so a vanishing density cannot disguise a wrong coefficient.",
    reasons: {
      r0: "Divide the full spectrum by the proposed leading spectrum and watch whether the ratio approaches one.",
      r1: "Both densities vanish as frequency approaches zero at fixed temperature. Their shared zero would not identify a coefficient. Dividing the positive expressions gives x/[exp(x) − 1].",
      r2: "The numerator Aν³ divided by (A/B)ν²T is Bν/T, exactly x. The exponential denominator is exp(x) − 1. Thus their ratio is x/[exp(x) − 1] for positive ν and T. Every A, B, frequency power and temperature factor participates in this cancellation; matching two zero limits alone would miss those factors.",
    },
  },
  {
    id: "lq-planck-take-limit",
    title: "Check the exponential's first coefficient and the removable limit",
    expressions: [differenceLimit, spectrumLimit],
    tool: "foundation:taylor-expansion",
    source: "eq-s2-d4",
    reasons: {
      r0: "After its constant one is removed, the exponential begins with x. The spectral ratio therefore approaches one.",
      r1: "The exponential is analytic and its first coefficients are exactly 1, 1, 1/2. Subtracting one and dividing by x has limit one; taking its reciprocal also has limit one because that limit is nonzero.",
      r2: "For y = exp(a), y′ = a′y determines the Taylor coefficients by n yₙ = ∑ₖ₌₁ⁿ k aₖ yₙ₋ₖ. With a = x and exp(0) = 1, the exact first two coefficients are 1 and 1. The analytic numerator exp(x) − 1 therefore has zero constant coefficient and linear coefficient one. The removable-limit owner divides out x, then continuity of the reciprocal gives the second limit. No value is assigned to 0/0, and no finite-frequency error bound is inferred from a truncated series.",
    },
  },
  {
    id: "lq-planck-match-coefficients",
    title: "Match the two leading coefficients",
    expressions: [molarClassical, coefficient],
    tool: "foundation:bridge-fractions-ratios",
    source: "eq-s2-d5",
    reasons: {
      r0: "If both laws describe the same leading spectrum, their coefficients must agree.",
      r1: "The limiting spectral form has coefficient A/B. The classical law of §1 has coefficient 8πR/(Nc³), with kB written as R/N. Their common positive ν²T factor cancels.",
      r2: "The exact limit establishes the leading Planck coefficient, but it cannot establish the physical classical model. Admit that both describe the same low-frequency spectral density in the same units. Divide their leading expressions by ν²T at positive ν and T to obtain A/B = 8πR/(Nc³). This is a comparison of leading coefficients, not an assertion that the full Planck spectrum equals the classical spectrum at nonzero x.",
    },
  },
  {
    id: "lq-planck-solve-number",
    title: "Solve for the number supplied by the coefficient comparison",
    expressions: [conclusion],
    tool: "foundation:bridge-fractions-ratios",
    source: "eq-s2-d6",
    reasons: {
      r0: "The fitted spectral constants and separate gas and light-speed inputs determine the molecular number within this comparison.",
      r1: "Multiply the coefficient equality by N and by B/A. All divisors are positive, leaving N = (B/A)(8πR/c³). The result is an inference from those inputs.",
      r2: "Starting from A/B = 8πR/(Nc³), multiplication by NB/A leaves N on the left and (B/A)(8πR/c³) on the right. Substitute that expression back into the coefficient equality to check every factor exactly. The shared positive-domain premises exclude division by zero. Changing A by a factor of ten changes this inferred N by the reciprocal factor, which is why the printed exponent and the edition's numerical choice must be shown separately.",
    },
  },
];
export const lqPlanckReadingSet = (step: PlanckStep) => ({
  ...step.reasons,
  r3: lqPlanckMetadata.historicalReading,
  r3Citations: [lqPlanckMetadata.citation],
});

export type LqPlanckDerivationPayload = Readonly<{
  limit: Readonly<{
    value: string;
    quotientAtZero: "not-applicable";
    coefficients: readonly string[];
  }>;
  worked: Readonly<{
    inputs: readonly Readonly<{
      quantityId: string;
      label: string;
      value: string;
      unit: string;
      role: string;
      provenance: string;
    }>[];
    alphaAsPrinted: string;
    calculatedN: string;
    printedN: string;
    printedExponentN: string;
    modernN: string;
  }>;
}>;
const glyphs: Readonly<Record<string, string>> = {
  wienConstantAlpha: "A",
  wienConstantBeta: "B",
  frequency: "ν",
  temperature: "T",
  molarGasConstant: "R",
  avogadroConstant: "N",
  speedOfLight: "c",
  boltzmannConstant: "k_B",
  spectralExpansionRatio: "x",
  thermalFrequencyScale: "ν_T",
  frequencyEnergyDensity: "ρ_ν",
};
export const presentPlanckExpression = (expression: Expression): Expression =>
  projectDerivationSymbols(expression, (node) => glyphs[node.quantityId] ?? node.quantityId);
