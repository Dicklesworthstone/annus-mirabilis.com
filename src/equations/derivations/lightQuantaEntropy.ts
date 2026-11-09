/**
 * Paper 1 §§4 and 6, reconstructed from the reader's canonical equation records.
 * Bindings distinguish V from V₀ and S(V) from S(V₀); only the render projection uses glyphs.
 * Calculus and the physical correspondence remain authored drafts pending scientific review.
 */
import constantsRecord from "../../../content/equations/light-quanta/eq-model-lq-avogadro-from-spectrum.json";
import countRecord from "../../../content/equations/light-quanta/eq-model-lq-effective-count.json";
import temperatureRecord from "../../../content/equations/light-quanta/eq-model-lq-entropy-temperature.json";
import gasRecord from "../../../content/equations/light-quanta/eq-model-lq-gas-entropy-change.json";
import unfixedRecord from "../../../content/equations/light-quanta/eq-model-lq-unfixed-constant.json";
import volumeRecord from "../../../content/equations/light-quanta/eq-model-lq-volume-entropy.json";
import entropyRecord from "../../../content/equations/light-quanta/eq-model-lq-wien-entropy-density.json";
import inverseRecord from "../../../content/equations/light-quanta/eq-model-lq-wien-inverse-temperature.json";
import spectrumRecord from "../../../content/equations/light-quanta/eq-model-lq-wien-spectrum.json";
import { type Expression, walk } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { substituteNode } from "./treeUtils.ts";
import type { DerivationChain, DerivationStep, PremiseRef, StepReadings } from "./types.ts";

type SymbolExpression = Extract<Expression, { kind: "symbol" }>;
type Relation = Extract<Expression, { kind: "relation" }>;

/** An instance's binding includes its index/argument, independently of its printed glyph. */
function bindingId(symbol: SymbolExpression): string {
  const argument = symbol.at?.kind === "symbol" ? `(${bindingId(symbol.at)})` : "";
  return `${symbol.quantityId}${symbol.index ? `[${symbol.index}]` : ""}${argument}`;
}

function canonical(record: { readonly tree: unknown }): Relation {
  return projectDerivationSymbols(record.tree as Expression, bindingId) as Relation;
}

const spectrum = canonical(spectrumRecord);
const inverseRecordTree = canonical(inverseRecord);
const entropyTemperature = canonical(temperatureRecord);
const entropyWithConstant = canonical(entropyRecord);
export const lqVolumeEntropyResult = canonical(volumeRecord);
export const lqUnfixedConstantResult = canonical(unfixedRecord);

const importedTrees = [
  spectrum,
  entropyTemperature,
  entropyWithConstant,
  lqVolumeEntropyResult,
  lqUnfixedConstantResult,
  canonical(constantsRecord),
  canonical(countRecord),
  canonical(gasRecord),
];
type Binding =
  | "frequencyEnergyDensity"
  | "frequency"
  | "wienConstantAlpha"
  | "wienConstantBeta"
  | "radiationEnergy"
  | "bandwidth"
  | "volume"
  | "volume[0]"
  | "radiationEntropy(volume)"
  | "radiationEntropy(volume[0])"
  | "entropyDensityConstant(frequency)"
  | "molarGasConstant"
  | "avogadroConstant"
  | "effectiveIndependentCount"
  | "gasEntropyChange"
  | "independentPointCount";
const symbols = Object.fromEntries(
  importedTrees.flatMap((tree) =>
    walk(tree)
      .filter((node): node is SymbolExpression => node.kind === "symbol")
      .map((symbol) => [bindingId(symbol), symbol]),
  ),
) as Readonly<Record<Binding, SymbolExpression>>;
const rho = symbols.frequencyEnergyDensity;
const nu = symbols.frequency;
const A = symbols.wienConstantAlpha;
const B = symbols.wienConstantBeta;
const E = symbols.radiationEnergy;
const dNu = symbols.bandwidth;
const V = symbols.volume;
const V0 = symbols["volume[0]"];
const S = symbols["radiationEntropy(volume)"];
const S0 = symbols["radiationEntropy(volume[0])"];
const C = symbols["entropyDensityConstant(frequency)"];
const R = symbols.molarGasConstant;
const N = symbols.avogadroConstant;
const n = symbols.effectiveIndependentCount;
const zero: Expression = { kind: "number", value: "0" };
const number = (value: string): Expression => ({ kind: "number", value });
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const negate = (argument: Expression): Expression => ({ kind: "negate", argument });
const quotient = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient",
  numerator,
  denominator,
});
const log = (argument: Expression, id: string): Expression => ({
  kind: "function",
  opId: `lq-entropy.op.${id}`,
  name: "ln",
  argument,
});
const relation = (left: Expression, right: Expression, id: string): Relation => ({
  kind: "relation",
  opId: `lq-entropy.op.${id}`,
  operator: "=",
  left,
  right,
});
const premise = (ref: string): PremiseRef => ({ ref, edgeType: "historical-derivation" });
const teaching = (ref: string): PremiseRef => ({ ref, edgeType: "pedagogical-reconstruction" });
const draft = {
  historicalStatus: "pedagogical-reconstruction",
  modelStatus: "wien-approximation",
  verification: { status: "authored-unverified" },
  isMove: false,
} as const;

const betaNu = product(B, nu);
const prefactor = product(A, { kind: "power", base: nu, exponent: { num: 3, den: 1 } });
const exponential = (spectrum.right as Extract<Expression, { kind: "sum" | "product" }>)
  .args[2] as Expression;
const normalizedSpectrum = relation(quotient(rho, prefactor), exponential, "normalized");
const loggedSpectrum = relation(
  log(normalizedSpectrum.left, "log-density"),
  log(normalizedSpectrum.right, "log-exponential"),
  "logged",
);
const invertedExponential = relation(
  loggedSpectrum.left,
  (exponential as Extract<Expression, { kind: "function" }>).argument,
  "inverted-exponential",
);
const inverseTemperature = relation(
  { ...inverseRecordTree.left, opId: "lq-entropy.op.inverse-temperature" } as Expression,
  inverseRecordTree.right,
  "inverse-temperature-equation",
);
const entropySlope = relation(entropyTemperature.left, inverseTemperature.right, "entropy-slope");
const zeroedConstant = substituteNode(entropyWithConstant, C.termId, zero) as Relation;
const entropyWithoutConstant = relation(
  entropyWithConstant.left,
  (entropyWithConstant.right as Extract<Expression, { kind: "sum" | "product" }>)
    .args[0] as Expression,
  "entropy-density-boundary",
);
const volumeEntropy = (volume: Expression): Expression =>
  negate(
    product(
      quotient(E, betaNu),
      sum(log(quotient(E, product(volume, dNu, prefactor)), "fixed-band-density"), number("-1")),
    ),
  );
const totalEntropy = relation(S, volumeEntropy(V), "total-entropy");
const comparedEntropy = relation(
  lqVolumeEntropyResult.left,
  sum(volumeEntropy(V), negate(volumeEntropy(V0))),
  "compared-entropy",
);

export const lqWienEntropyDerivation: DerivationChain = {
  id: "chain-lq-wien-entropy",
  proofRouteId: "route-lq-wien-fixed-band",
  routeKind: "pedagogical-reconstruction",
  entryAssumptions: [
    premise("arg-lq-wien-integration"),
    premise("arg-lq-entropy-temperature"),
    premise("lq-positive-wien-domain"),
    premise("lq-zero-density-entropy-boundary"),
    premise("lq-fixed-energy-frequency-band"),
  ],
  target: volumeRecord.id,
  targetStepId: "lq-wien-collect-volume-ratio",
  essentialForPrint: true,
  steps: [
    {
      ...draft,
      id: "lq-wien-normalize-spectrum",
      from: spectrum,
      to: normalizedSpectrum,
      changedSubexpressionIds: [rho.termId, A.termId, nu.termId],
      rule: {
        kind: "add-subtract-multiply-divide",
        params: { operation: "divide", quantity: prefactor, nonzeroCondition: "A > 0 and ν > 0." },
      },
      reasonKind: "algebra",
      reasons: {
        r0: "Within Wien's dilute regime, divide out the positive spectral prefactor to isolate the exponential.",
        r1: "Wien's law is the starting empirical approximation. Divide both sides by Aν³, which is positive, so the left is the dimensionless ratio ρν/(Aν³) and the right is the exponential alone.",
        r2: "Take positive A, B, ν and T and a positive spectral density ρν. Divide ρν = Aν³ exp(−Bν/T) by the same nonzero Aν³ on each side; the matching prefactor on the right cancels. The ratio ρν/(Aν³) has no units and lies between zero and one. In the dilute Wien range it is much smaller than one. This rearrangement preserves the approximation's domain; it does not extend Wien's law to dense radiation.",
      },
      tool: "foundation:bridge-fractions-ratios",
      premiseRefs: [premise("lq-positive-wien-domain"), teaching(spectrumRecord.id)],
      sourceAnchor: "lq-wien-source-spectrum",
    },
    {
      ...draft,
      id: "lq-wien-take-logarithms",
      from: normalizedSpectrum,
      to: loggedSpectrum,
      changedSubexpressionIds: ["lq-entropy.op.log-density", "lq-entropy.op.log-exponential"],
      rule: {
        kind: "monotonic-function",
        params: {
          function: "ln",
          domain: "Both sides are positive real numbers in the positive-temperature Wien domain.",
          positiveArguments: {
            left: "ρν > 0 and Aν³ > 0 give a strictly positive ratio.",
            right: "The exponential of the finite real number −Bν/T is strictly positive.",
          },
        },
      },
      reasonKind: "algebra",
      reasons: {
        r0: "Both sides are positive, so their natural logarithms can be compared.",
        r1: "Apply the natural logarithm to both sides. The density ratio is positive and an exponential is positive, so neither logarithm crosses a forbidden zero or negative argument.",
        r2: "The logarithm is one-to-one on the positive real numbers. On the left, ρν > 0 and Aν³ > 0 make the quotient positive. On the right, exp(−Bν/T) is positive for finite real Bν/T. Thus applying ln to both sides preserves the equality. The logarithm acts on the entire dimensionless density ratio, not on a dimensional density by itself; the endpoint ρν = 0 is reserved for a later limit.",
      },
      tool: "foundation:logarithms",
      premiseRefs: [premise("lq-positive-wien-domain")],
      sourceAnchor: "lq-wien-source-inversion",
    },
    {
      ...draft,
      id: "lq-wien-invert-exponential",
      from: loggedSpectrum,
      to: invertedExponential,
      changedSubexpressionIds: ["lq-entropy.op.log-exponential"],
      rule: {
        kind: "registered-identity",
        params: {
          identityId: "log-exp-inverse",
          targetId: "lq-entropy.op.log-exponential",
          citedPremises: ["ln(exp(x)) = x for finite real x"],
        },
      },
      reasonKind: "identity",
      reasons: {
        r0: "The logarithm undoes the exponential, exposing the temperature in its exponent.",
        r1: "Use ln(exp(x)) = x with x = −Bν/T. The right-hand side becomes −Bν/T, while the logarithm of the density ratio stays unchanged.",
        r2: "Set x = −Bν/T, which is finite for the positive finite parameters under discussion. Since natural logarithm and exponential are inverse functions, ln(exp(x)) = x exactly. Replace just that nested pair on the right by −Bν/T. No sign changes and no logarithm of the left-hand ratio is removed. The remaining equality now contains 1/T linearly, ready for division by −Bν.",
      },
      tool: "foundation:logarithms",
      premiseRefs: [premise("lq-positive-wien-domain")],
      sourceAnchor: "lq-wien-source-inversion",
    },
    {
      ...draft,
      id: "lq-wien-isolate-inverse-temperature",
      from: invertedExponential,
      to: inverseTemperature,
      changedSubexpressionIds: ["lq-entropy.op.inverse-temperature", B.termId, nu.termId],
      rule: {
        kind: "add-subtract-multiply-divide",
        params: { operation: "divide", quantity: negate(betaNu), nonzeroCondition: "Bν > 0." },
      },
      reasonKind: "algebra",
      reasons: {
        r0: "Divide by the negative spectral factor to find one over the temperature.",
        r1: "Divide both sides by −Bν and write 1/T on the left. The negative logarithm divided by Bν is positive because the Wien density ratio is below one.",
        r2: "From ln[ρν/(Aν³)] = −Bν/T, divide both sides by −Bν, which is nonzero because B and ν are positive. The right becomes 1/T and the left becomes −ln[ρν/(Aν³)]/(Bν); exchange the equal sides to reach the displayed form. Its sign checks the result: the ratio is below one, its logarithm is negative, and the leading minus sign gives the required positive inverse temperature.",
      },
      tool: "foundation:bridge-fractions-ratios",
      premiseRefs: [premise("lq-positive-wien-domain")],
      sourceAnchor: "lq-wien-source-inversion",
    },
    {
      ...draft,
      id: "lq-wien-use-entropy-slope",
      from: inverseTemperature,
      to: entropySlope,
      changedSubexpressionIds: [
        "lq-entropy.op.inverse-temperature",
        "eq-model-lq-entropy-temperature.op.derivative",
      ],
      rule: {
        kind: "substitute",
        params: {
          targetId: "lq-entropy.op.inverse-temperature",
          replacement: entropyTemperature.left,
          citedEquality: "eq-model-lq-entropy-temperature: (∂sν/∂ρν)ν = 1/T from §3.",
        },
      },
      reasonKind: "physical-premise",
      reasons: {
        r0: "Thermodynamics turns inverse temperature into the slope of entropy as energy density changes.",
        r1: "Section 3 supplies (∂sν/∂ρν)ν = 1/T. Replace 1/T by this derivative, keeping frequency fixed, so the spectral law becomes a differential equation for entropy density.",
        r2: "The thermodynamic identity dS/dE = 1/T and the equilibrium argument of §3 give (∂sν/∂ρν)ν = 1/T at each frequency. Substitute this derivative for the single inverse-temperature term on the left. The subscript ν matters: it says to vary energy density while holding the frequency fixed, rather than differentiate the spectrum along its frequency axis. The right-hand side is now the function of ρν that must be integrated.",
      },
      tool: "foundation:entropy-temperature",
      premiseRefs: [premise("arg-lq-entropy-temperature"), teaching(temperatureRecord.id)],
      sourceAnchor: "lq-wien-source-boundary",
    },
    {
      ...draft,
      id: "lq-wien-integrate-with-constant",
      from: entropySlope,
      to: entropyWithConstant,
      changedSubexpressionIds: [C.termId, "eq-model-lq-wien-entropy-density.op.bracket"],
      rule: { kind: "integrate", params: { variable: rho.termId, integrationConstant: C.termId } },
      reasonKind: "calculus",
      reasons: {
        r0: "Integrate at fixed frequency and keep the undetermined entropy-density constant visible.",
        r1: "Integrate with respect to ρν while ν stays fixed. The antiderivative of ln(ρν/a) is ρν[ln(ρν/a) − 1], and the integration constant may still depend on ν.",
        r2: "Write a = Aν³, a constant in this integration. Integration by parts gives ∫ln(ρν/a)dρν = ρν ln(ρν/a) − ∫1 dρν = ρν[ln(ρν/a) − 1]. Multiplying by −1/(Bν) gives the displayed entropy density. Add C(ν), because differentiation with respect to ρν cannot determine any term depending only on the fixed frequency. Omitting that term before using a boundary condition would leave the later volume comparison unjustified.",
      },
      tool: "foundation:integration",
      premiseRefs: [premise("arg-lq-wien-integration")],
      sourceAnchor: "lq-wien-source-integral",
    },
    {
      ...draft,
      id: "lq-wien-fix-zero-density-boundary",
      from: entropyWithConstant,
      to: zeroedConstant,
      changedSubexpressionIds: [C.termId],
      rule: {
        kind: "substitute",
        params: {
          targetId: C.termId,
          replacement: zero,
          citedEquality: "§3, p. 139: sν(0) = 0; lim ρν→0+ ρν ln[ρν/(Aν³)] = 0 implies C(ν) = 0.",
        },
      },
      reasonKind: "boundary-condition",
      reasons: {
        r0: "The paper sets entropy density to zero when radiation vanishes, fixing C(ν) to zero.",
        r1: "At zero density, the logarithmic term tends to zero: ρν ln ρν → 0. The paper's boundary condition sν(0) = 0 therefore forces C(ν) = 0 at each fixed frequency.",
        r2: "Approach ρν = 0 from positive densities; do not substitute zero inside the logarithm. For fixed positive A and ν, ρν ln[ρν/(Aν³)] = ρν ln ρν − ρν ln(Aν³) tends to zero, as does the remaining term proportional to ρν. Thus the limit of the integrated expression is C(ν). The end of §3, p. 139, explicitly requires the entropy density to vanish there. This boundary condition, rather than a later cancellation, fixes C(ν) = 0.",
      },
      tool: "foundation:integration",
      premiseRefs: [premise("lq-zero-density-entropy-boundary")],
      sourceAnchor: "lq-wien-source-boundary",
    },
    {
      ...draft,
      id: "lq-wien-remove-fixed-constant",
      from: zeroedConstant,
      to: entropyWithoutConstant,
      changedSubexpressionIds: ["eq-model-lq-wien-entropy-density.op.total"],
      rule: { kind: "collect", params: {} },
      reasonKind: "algebra",
      reasons: {
        r0: "Remove the now-fixed zero term to obtain the entropy density used in the paper.",
        r1: "The boundary condition has set the additive term to zero, so it can now be removed. The remaining expression is the entropy density printed in §4.",
        r2: "The preceding step supplied C(ν) = 0 independently at each frequency. Adding that zero changes no value, so collect the right-hand side into the single logarithmic entropy-density term. This is precisely where the freedom in the antiderivative ends. It would be incorrect to justify this omission by saying that every integration constant cancels in entropy differences: C(ν) is a density, and the total entropy contains the additional volume factor.",
      },
      tool: "foundation:integration",
      premiseRefs: [premise("lq-zero-density-entropy-boundary")],
      sourceAnchor: "lq-wien-source-integral",
    },
    {
      ...draft,
      id: "lq-wien-hold-energy-and-band",
      from: entropyWithoutConstant,
      to: totalEntropy,
      changedSubexpressionIds: [rho.termId, E.termId, V.termId, dNu.termId],
      rule: {
        kind: "add-subtract-multiply-divide",
        params: { operation: "multiply", quantity: product(V, dNu) },
      },
      reasonKind: "physical-premise",
      reasons: {
        r0: "Compare the same energy in the same narrow frequency band, so a larger volume means a smaller density.",
        r1: "Hold E, ν and Δν fixed. Then ρν = E/(VΔν) and total entropy is S(V) = VΔν sν. Substituting and multiplying removes VΔν from the prefactor but leaves V inside the logarithm.",
        r2: "For a narrow band whose density is represented by its value at ν, E = VΔνρν and S(V) = VΔνsν. Substitute ρν = E/(VΔν) into the boundary-fixed entropy density, then multiply by VΔν. The prefactor VΔνρν becomes E; the logarithm becomes ln[E/(VΔνAν³)]. Compare equilibrium states with the same E, ν and Δν, and require both states to remain dilute. A moving reflecting wall changes energy and frequency, so its compression process does not keep these constraints.",
      },
      tool: "foundation:entropy-temperature",
      premiseRefs: [premise("lq-fixed-energy-frequency-band"), premise("arg-lq-fixed-band-volume")],
      sourceAnchor: "lq-wien-source-total",
      isMove: true,
      moveLabel: "Hold the energy and frequency band fixed while changing the volume.",
    },
    {
      ...draft,
      id: "lq-wien-subtract-reference-volume",
      from: totalEntropy,
      to: comparedEntropy,
      changedSubexpressionIds: [S0.termId, V0.termId],
      rule: {
        kind: "add-subtract-multiply-divide",
        params: { operation: "subtract", quantity: S0 },
      },
      reasonKind: "algebra",
      reasons: {
        r0: "Subtract the entropy of a reference volume with the same energy and frequency band.",
        r1: "Evaluate the same total-entropy formula at V₀, with E, ν and Δν unchanged. Subtract S(V₀) from S(V) so only their dependence on volume can remain.",
        r2: "Use S(V₀) = −E/(Bν){ln[E/(V₀ΔνAν³)] − 1}, obtained from the preceding formula by evaluating it at the reference volume V₀. Subtract this value from both sides of S(V)'s equation. The two states must satisfy the same fixed-energy, fixed-band constraints and each must be in Wien's dilute regime. The prefactor E/(Bν) is common, and the two constant terms proportional to 1 will cancel in the next collection.",
      },
      tool: "foundation:bridge-fractions-ratios",
      premiseRefs: [premise("lq-fixed-energy-frequency-band")],
      sourceAnchor: "lq-wien-source-volume",
    },
    {
      ...draft,
      id: "lq-wien-collect-volume-ratio",
      from: comparedEntropy,
      to: lqVolumeEntropyResult,
      changedSubexpressionIds: [
        "eq-model-lq-volume-entropy.op.log",
        "eq-model-lq-volume-entropy.op.coefficient",
      ],
      rule: { kind: "collect", params: {} },
      reasonKind: "algebra",
      reasons: {
        r0: "The shared terms cancel, leaving a logarithm of the volume ratio.",
        r1: "The constant terms cancel and the logarithms combine into ln(V/V₀). The entropy change is E/(Bν) times this logarithm: positive for expansion, negative for compression and zero at equal volumes.",
        r2: "Factor E/(Bν). The remaining difference is ln[E/(V₀ΔνAν³)] − ln[E/(VΔνAν³)], since the two minus-one terms cancel. Both logarithm arguments are positive. Their quotient is V/V₀, so the logarithm difference is ln(V/V₀). No division by ln(V/V₀) is used here, so V = V₀ is allowed and gives zero. Had C(ν) remained unfixed, the difference would also contain Δν C(ν)(V − V₀), which generally does not vanish.",
      },
      tool: "foundation:logarithms",
      premiseRefs: [
        premise("lq-fixed-energy-frequency-band"),
        premise("lq-zero-density-entropy-boundary"),
      ],
      sourceAnchor: "lq-wien-source-volume",
    },
  ],
};

const volumeLog = log(quotient(V, V0), "comparison-volume-log");
const radiationCoefficient = quotient(E, betaNu);
const gasCoefficient = product(quotient(R, N), n);
const matchingVolumeLaws = relation(
  product(radiationCoefficient, volumeLog),
  product(gasCoefficient, volumeLog),
  "matching-volume-laws",
);
const matchingCoefficients = relation(
  radiationCoefficient,
  gasCoefficient,
  "matching-coefficients",
);
export const lqEffectiveCountResult = relation(
  n,
  quotient(product(N, E), product(R, B, nu)),
  "effective-count",
);
const energyPerPoint = quotient(E, n);
const withEffectiveCount = substituteNode(energyPerPoint, n.termId, lqEffectiveCountResult.right);
export const lqEnergyPerElementResult = quotient(product(R, B, nu), N);
export const lqIndependentGasLaw = relation(
  symbols.gasEntropyChange,
  product(product(quotient(R, N), symbols.independentPointCount), volumeLog),
  "independent-gas-law",
);

export const lqCoefficientCorrespondence: DerivationChain = {
  id: "chain-lq-entropy-correspondence",
  proofRouteId: "route-lq-entropy-coefficients",
  routeKind: "pedagogical-reconstruction",
  entryAssumptions: [
    premise("arg-lq-fixed-band-volume"),
    premise("arg-lq-independent-configurations"),
    premise("lq-positive-wien-domain"),
    teaching("lq-heuristic-independent-energy-elements"),
    teaching("lq-nontrivial-volume-ratio"),
  ],
  target: "lq-energy-per-independent-element",
  targetStepId: "lq-correspondence-energy-per-element",
  essentialForPrint: true,
  steps: [
    {
      ...draft,
      id: "lq-correspondence-match-coefficients",
      from: matchingVolumeLaws,
      to: matchingCoefficients,
      changedSubexpressionIds: ["lq-entropy.op.comparison-volume-log"],
      rule: {
        kind: "add-subtract-multiply-divide",
        params: {
          operation: "divide",
          quantity: volumeLog,
          nonzeroCondition: "V/V₀ > 0 and V/V₀ ≠ 1 give ln(V/V₀) ≠ 0.",
        },
      },
      reasonKind: "physical-premise",
      reasons: {
        r0: "The shared entropy law suggests an independent-element model for dilute light; it does not prove that picture.",
        r1: "For independent gas points, the coefficient is (R/N)n; for dilute radiation it is E/(Bν). Ask what effective n makes their volume dependence agree, and cancel the common logarithm for V/V₀ ≠ 1.",
        r2: "Section 5 obtains ΔS = (R/N)n ln(V/V₀) because n independently placed points give a configuration factor (V/V₀)ⁿ. Section 4 gives ΔS = [E/(Bν)] ln(V/V₀) for dilute radiation. Matching these volume-dependence families is the heuristic move: it proposes a model that shares this thermodynamic property. For positive V/V₀ other than one, divide by the nonzero common logarithm to compare coefficients. At V = V₀ both changes are zero and this observation identifies no count. Correlated points need not have exponent n, so independence is essential.",
      },
      tool: "foundation:probability-independence",
      premiseRefs: [
        premise("arg-lq-independent-configurations"),
        teaching("lq-heuristic-independent-energy-elements"),
        teaching("lq-nontrivial-volume-ratio"),
      ],
      sourceAnchor: "lq-correspondence-source-comparison",
      isMove: true,
      moveLabel:
        "Interpret the shared coefficient as an effective count of independent energy elements.",
    },
    {
      ...draft,
      id: "lq-correspondence-solve-effective-count",
      from: matchingCoefficients,
      to: lqEffectiveCountResult,
      changedSubexpressionIds: [n.termId, R.termId, N.termId],
      rule: {
        kind: "add-subtract-multiply-divide",
        params: {
          operation: "divide",
          quantity: quotient(R, N),
          nonzeroCondition: "R > 0 and N > 0.",
        },
      },
      reasonKind: "algebra",
      reasons: {
        r0: "Solve for the effective count that reproduces radiation's entropy coefficient.",
        r1: "Divide the coefficient equality by R/N and put n on the left. This gives n = NE/(RBν), a model's effective count rather than a measured or rounded number of particles.",
        r2: "Start with E/(Bν) = (R/N)n. R and N are positive, so multiplying both sides by N/R is valid. The result is NE/(RBν) = n; exchange the equal sides to put the effective count first. E/(Bν) and R/N both have entropy units, so their ratio is dimensionless. This algebra only identifies the count within the proposed independent-element description; it neither measures individual elements nor requires rounding a continuous thermodynamic ratio to an integer.",
      },
      tool: "foundation:bridge-fractions-ratios",
      premiseRefs: [teaching("lq-heuristic-independent-energy-elements")],
      sourceAnchor: "lq-correspondence-source-probability",
    },
    {
      ...draft,
      id: "lq-correspondence-substitute-effective-count",
      from: energyPerPoint,
      to: withEffectiveCount,
      changedSubexpressionIds: [n.termId],
      rule: {
        kind: "substitute",
        params: {
          targetId: n.termId,
          replacement: lqEffectiveCountResult.right,
          citedEquality: "The preceding coefficient comparison gives n = NE/(RBν).",
        },
      },
      reasonKind: "definition",
      reasons: {
        r0: "Divide the total energy by that effective count to find the proposed energy per element.",
        r1: "The energy per independent element is E/n in this model. Substitute the effective count just found, keeping the nested fraction visible before simplifying it.",
        r2: "The candidate description assigns the total energy E to n independent energy elements, so its energy per element is E/n. Replace n in this quotient by NE/(RBν), using the immediately preceding result. E, N, R, B and ν are positive in the stated domain, which makes the denominator positive. The displayed nested fraction records exactly this substitution; it introduces no Planck constant and assumes no photon energy law in advance.",
      },
      tool: "foundation:bridge-fractions-ratios",
      premiseRefs: [teaching("lq-correspondence-solve-effective-count")],
      sourceAnchor: "lq-correspondence-source-elements",
    },
    {
      ...draft,
      id: "lq-correspondence-energy-per-element",
      from: withEffectiveCount,
      to: lqEnergyPerElementResult,
      changedSubexpressionIds: [E.termId, R.termId, B.termId, nu.termId, N.termId],
      rule: { kind: "collect", params: {} },
      reasonKind: "algebra",
      reasons: {
        r0: "The proposed energy per element is proportional to frequency, with coefficient RB/N.",
        r1: "Dividing by NE/(RBν) multiplies by RBν/(NE). The positive total energy cancels, leaving E/n = RBν/N. The heuristic comparison fixes this energy scale, not the full nature of light.",
        r2: "Invert the positive denominator: E/[NE/(RBν)] = E·RBν/(NE). Cancel E, which is nonzero for the radiation under discussion, to obtain RBν/N. Thus the inferred energy per element is proportional to frequency and independent of the total amount of radiation. Only afterward may modern notation identify RB/N with h and write hν. That identification is not a premise of the entropy comparison, and agreement of one entropy law does not establish every property of independent particles.",
      },
      tool: "foundation:bridge-fractions-ratios",
      premiseRefs: [
        teaching("lq-heuristic-independent-energy-elements"),
        premise("lq-positive-wien-domain"),
      ],
      sourceAnchor: "lq-correspondence-source-elements",
    },
  ],
};

const glyphs: Readonly<Record<string, string>> = {
  frequencyEnergyDensity: "ρ_ν",
  frequency: "ν",
  wienConstantAlpha: "A",
  wienConstantBeta: "B",
  temperature: "T",
  spectralEntropyDensity: "s_ν",
  entropyDensityConstant: "C",
  entropyFromUnfixedConstant: "ΔS_C",
  radiationEntropy: "S",
  radiationEnergy: "E",
  bandwidth: "Δν",
  volume: "V",
  molarGasConstant: "R",
  avogadroConstant: "N",
  effectiveIndependentCount: "n",
  independentPointCount: "n",
  gasEntropyChange: "ΔS_gas",
};

export function lightQuantaDisplayExpression(expression: Expression): Expression {
  return projectDerivationSymbols(
    expression,
    (symbol) => glyphs[symbol.quantityId] ?? symbol.quantityId,
  );
}

/** The checker consumes the canonical chain, not this display-only glyph projection. */
export function lightQuantaDisplayChain(chain: DerivationChain): DerivationChain {
  return {
    ...chain,
    steps: chain.steps.map((step) => ({
      ...step,
      from: lightQuantaDisplayExpression(step.from),
      to: lightQuantaDisplayExpression(step.to),
      changedSubexpressionIds: step.changedSubexpressionIds.map((id) => {
        const symbol = symbols[id as Binding];
        return symbol ? (glyphs[symbol.quantityId] ?? id) : id;
      }),
    })),
  };
}

export const lightQuantaDerivationMetadata = {
  review: "draft",
  historicalStatus: "pedagogical-reconstruction",
  modelStatus: "wien-approximation",
  s4: { argument: "arg-lq-fixed-band-volume", ownerBeadId: "am-lq-equations-s1-s4-9gl5" },
  s6: { argument: "arg-lq-entropy-correspondence", ownerBeadId: "am-lq-equations-s5-s9-3cjh" },
} as const;

/** R3 supplies historical context alongside each step's already-authored R0/R1/R2. */
export const lightQuantaHistoricalReadings: Readonly<Record<"s4" | "s6", string>> = {
  s4: "Einstein's §3, p. 139, explicitly sets the entropy density to zero at zero radiation density. Section 4 then uses Wien's approximate law to derive the entropy-volume relation. This reconstruction writes A, B, sν and V for the paper's α, β, φ and v, and Δν for its narrow interval dν. The printed argument carries the integration constant implicitly through its stated zero-density boundary condition.",
  s6: "In §6, pp. 142–143, Einstein rewrites the radiation entropy through Boltzmann's principle and compares its configuration exponent with the independent molecular points of §5. He concludes that dilute monochromatic radiation behaves thermodynamically as if it consisted of independent energy quanta of magnitude Rβν/N. The coefficient comparison here unpacks that heuristic argument; h is only a subsequent modern identification.",
};

export function lightQuantaReadingSet(
  step: DerivationStep,
  section: "s4" | "s6",
): StepReadings & {
  readonly r3: string;
  readonly r3Citations: readonly string[];
} {
  return {
    ...step.reasons,
    r3: lightQuantaHistoricalReadings[section],
    r3Citations: [
      `Einstein, A. (1905). Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt. Annalen der Physik 17, 132–148 (${section === "s4" ? "§§3–4, pp. 138–140" : "§§5–6, pp. 140–143"}).`,
    ],
  };
}
