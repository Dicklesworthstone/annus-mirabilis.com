/**
 * The two closing uses of the light-quantum hypothesis, in the paper's order.
 * These are conditional energy and counting arguments, not a proof of the hypothesis.
 * Canonical bound records supply the conclusions; added bookkeeping is explicitly modern.
 */
import fluorescenceRecord from "../../../content/equations/light-quanta/eq-model-lq-fluorescence-bound.json";
import countRecord from "../../../content/equations/light-quanta/eq-model-lq-ion-count-bound.json";
import thresholdRecord from "../../../content/equations/light-quanta/eq-model-lq-ionization-threshold.json";
import type { Expression } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { structurallyEqual } from "./treeUtils.ts";
import { DerivationSchemaError, type FoundationToolId, type StepReadings } from "./types.ts";

type Relation = Extract<Expression, { kind: "relation" }>;
type RecordInput = Readonly<{ id: string; argument: string; tree: unknown }>;
export type ClosingQuantaSection = "s7" | "s9";

export class ClosingQuantaCanonicalError extends DerivationSchemaError {
  readonly code = "lq-closing-canonical-mismatch";
  constructor(recordId: string) {
    super(
      "The closing light-quantum argument requires its canonical one-event bound and positive-energy count denominator.",
      "lightQuantaClosing." + recordId,
    );
    this.name = "ClosingQuantaCanonicalError";
  }
}

const symbol = (quantityId: string): Expression => ({ kind: "symbol", termId: quantityId, quantityId });
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const quotient = (numerator: Expression, denominator: Expression): Expression => ({
  kind: "quotient", numerator, denominator,
});
const relation = (left: Expression, right: Expression, operator: Relation["operator"] = "="): Relation => ({
  kind: "relation", operator, left, right,
});
const zero: Expression = { kind: "number", value: "0" };
const h = symbol("planckConstant");
const inputFrequency = symbol("incidentFrequency");
const outputFrequency = symbol("emittedFrequency");
const frequency = symbol("frequency");
const otherEnergy = symbol("otherChannelEnergy");
const absorbedEnergy = symbol("absorbedLightEnergy");
const absorbedCount = symbol("absorbedQuantumCount");
const ionCount = symbol("ionCount");
const ionizationWork = symbol("ionizationEnergyPerMolecule");
const avogadro = symbol("avogadroConstant");
const gasConstant = symbol("gasConstant");
const wienBeta = symbol("wienBeta");
const yieldFraction = symbol("quantumYield");
const absorbedPower = symbol("absorbedPower");

/** Validate the scientific form, not IDs alone. No floating samples or copied LaTeX. */
function canonical(record: RecordInput, expected: RecordInput, form: Expression): Relation {
  const projected = projectDerivationSymbols(record.tree as Expression, (node) => node.quantityId);
  if (record.id !== expected.id || record.argument !== expected.argument || !structurallyEqual(projected, form)) {
    throw new ClosingQuantaCanonicalError(record.id);
  }
  return projected as Relation;
}

export function createClosingQuantaExpressions(
  fluorescence: RecordInput = fluorescenceRecord,
  threshold: RecordInput = thresholdRecord,
  count: RecordInput = countRecord,
) {
  return Object.freeze({
    quantumNotation: relation(h, quotient(product(gasConstant, wienBeta), avogadro)),
    fluorescenceBudget: relation(product(h, inputFrequency), sum(product(h, outputFrequency), otherEnergy)),
    nonnegativeRemainder: relation(otherEnergy, zero, "ge"),
    fluorescenceBound: canonical(fluorescence, fluorescenceRecord, relation(product(h, outputFrequency), product(h, inputFrequency), "le")),
    frequencyBound: relation(outputFrequency, inputFrequency, "le"),
    absorbedRate: relation(symbol("absorbedQuantumRate"), quotient(absorbedPower, product(h, inputFrequency))),
    emittedRate: relation(symbol("emittedQuantumRate"), product(yieldFraction, symbol("absorbedQuantumRate"))),
    emittedPower: relation(symbol("emittedPower"), product(yieldFraction, quotient(outputFrequency, inputFrequency), absorbedPower)),
    pooledBudget: relation(outputFrequency, product(symbol("pooledQuantumCount"), inputFrequency), "le"),
    ionizationBudget: relation(product(h, frequency), sum(ionizationWork, symbol("excessEnergy"))),
    ionizationThreshold: canonical(threshold, thresholdRecord, relation(product(h, frequency), ionizationWork, "ge")),
    thresholdFrequency: relation(symbol("thresholdFrequency"), quotient(ionizationWork, h)),
    absorbedEnergy: relation(absorbedEnergy, product(absorbedCount, h, frequency)),
    absorbedCount: relation(absorbedCount, quotient(absorbedEnergy, product(h, frequency))),
    ionCountWithYield: relation(ionCount, product(symbol("ionizationYield"), absorbedCount)),
    nonnegativeCount: relation(ionCount, zero, "ge"),
    ionCountBound: canonical(count, countRecord, relation(ionCount, quotient(absorbedEnergy, product(h, frequency)), "le")),
    fullYieldCount: relation(ionCount, quotient(absorbedEnergy, product(h, frequency))),
    gramMolecules: relation(symbol("ionizedGramMolecules"), quotient(ionCount, avogadro)),
    sourceCount: relation(symbol("ionizedGramMolecules"), quotient(absorbedEnergy, product(gasConstant, wienBeta, frequency))),
  });
}

export const closingQuantaExpressions = createClosingQuantaExpressions();

export type ClosingQuantaStep = Readonly<{
  id: string;
  title: string;
  expressions: readonly Expression[];
  reasons: StepReadings;
  tool: FoundationToolId;
  source: Readonly<{ anchor: string; label: string }>;
  isMove?: boolean;
}>;

/** Reasons distinguish an admitted physical premise from the arithmetic it permits. */
export const closingQuantaSteps: Readonly<Record<ClosingQuantaSection, readonly ClosingQuantaStep[]>> = Object.freeze({
  s7: Object.freeze([
    {
      id: "lq-fluorescence-one-event",
      title: "Account for one absorbed quantum",
      isMove: true,
      expressions: [closingQuantaExpressions.fluorescenceBudget, closingQuantaExpressions.nonnegativeRemainder],
      reasons: {
        r0: "One absorbed quantum pays for the chosen emitted quantum and everything else produced. The body supplies no extra energy.",
        r1: "Admit the paper's elementary-event hypothesis: in sufficiently sparse exciting light, one quantum acts on its own. Its energy pays for the chosen emitted quantum. E_other includes any additional emitted quanta, heat and other channels; it is nonnegative when the body supplies no energy of its own.",
        r2: "This energy ledger is a modern reconstruction of §7, not a measurement and not a claim that only one photon can emerge. The paper explicitly allows other emitted frequencies and heat. The bound concerns each chosen emitted quantum, because all the other outgoing energy is nonnegative. Pooling several absorbed quanta or drawing energy from the body changes the premise.",
      },
      tool: "foundation:work-energy",
      source: { anchor: "s7-p1-s3", label: "Read the elementary transformation and its other channels" },
    },
    {
      id: "lq-fluorescence-positive-factor",
      title: "Remove the nonnegative remainder, then divide by the same positive constant",
      expressions: [closingQuantaExpressions.fluorescenceBound, closingQuantaExpressions.frequencyBound],
      reasons: {
        r0: "The emitted quantum cannot have more energy than the absorbed one. Since energy per quantum is h times frequency, its frequency cannot be higher.",
        r1: "Subtract the nonnegative energy in the other channels. The chosen emitted quantum has at most the incoming energy. Divide the inequality by h > 0; its direction is preserved. Equality means no energy was left for those other channels.",
        r2: "The source prints (R/N)βν₂ ≤ (R/N)βν₁ and then ν₂ ≤ ν₁. In the modern shorthand h = Rβ/N the common factor is strictly positive. A negative or zero factor would not license this division. The conclusion is a bound on an allowed elementary event, not a prediction of the emitted spectrum or of a nonzero fluorescence yield.",
      },
      tool: "foundation:bridge-fractions-ratios",
      source: { anchor: "s7-p1-s5", label: "Read the energy bound and Stokes's rule" },
    },
    {
      id: "lq-fluorescence-independent-rates",
      title: "Add a separate counting assumption to discuss brightness",
      expressions: [closingQuantaExpressions.absorbedRate, closingQuantaExpressions.emittedRate, closingQuantaExpressions.emittedPower],
      reasons: {
        r0: "More absorbed power brings more quanta of the same size. With the same chance of emission per absorption, it produces proportionally more light.",
        r1: "At fixed frequencies, divide absorbed power by one incoming quantum's energy to obtain the average absorption rate. A fixed yield η for the chosen emission channel multiplies that rate. Multiplying by hν₂ gives emitted power η(ν₂/ν₁)P_abs, linear in absorbed power.",
        r2: "This is the laboratory's modern rate model for the source's weak-illumination independence premise. It holds the yield, frequencies and absorption conditions fixed, with 0 ≤ η ≤ 1 for the selected channel. Neither the energy bound nor the algebra fixes η. A positive fixed yield removes an intensity threshold in this model; it does not guarantee a detected photon during every arbitrarily short exposure. These rates are not supplied for pooled multi-quantum processes.",
      },
      tool: "foundation:bridge-fractions-ratios",
      source: { anchor: "s7-p2-s1", label: "Read why the paper predicts proportionality in weak light" },
    },
  ] satisfies readonly ClosingQuantaStep[]),
  s9: Object.freeze([
    {
      id: "lq-ionization-energy-threshold",
      title: "Require enough energy for one elementary ionization",
      isMove: true,
      expressions: [closingQuantaExpressions.ionizationBudget, closingQuantaExpressions.ionizationThreshold, closingQuantaExpressions.thresholdFrequency],
      reasons: {
        r0: "One quantum must pay the ionization work of one molecule. Brightening light whose quanta are too small cannot repair that shortfall in this model.",
        r1: "Admit that one quantum supplies one elementary ionization, with no pooled quanta or other energy source. The remaining energy must be nonnegative, so hν ≥ J_mol. With h > 0, the minimum energetic frequency is J_mol/h.",
        r2: "J_mol denotes work per molecule in this modern ledger. The source's J is work per gram-equivalent, so its displayed inequality is Rβν ≥ J. The threshold is necessary, not sufficient: energy accounting does not establish absorption, a nonzero transition probability or a measurable rate. At the threshold the available excess is zero. Below it the laboratory reports the single-quantum count as not applicable, not as a measured zero.",
      },
      tool: "foundation:work-energy",
      source: { anchor: "s9-p1-s2", label: "Read the necessary ionization-work bound" },
    },
    {
      id: "lq-ionization-count-absorbed",
      title: "Count absorbed quanta, using absorbed energy",
      expressions: [closingQuantaExpressions.absorbedEnergy, closingQuantaExpressions.absorbedCount],
      reasons: {
        r0: "Divide the energy the gas actually absorbs by the energy in one quantum. Incident light that passes through does not belong in this count.",
        r1: "For monochromatic absorbed light, N_abs identical quanta carry total energy L = N_abs hν. Divide by hν, which is strictly positive. The laboratory determines L from the accepted power, absorption share and exposure; this step uses that absorbed energy.",
        r2: "The algebra counts quanta at one frequency. A broadband field requires counting each frequency contribution separately. At macroscopic scale the laboratory reports an average count, which need not be an integer; it does not simulate individual absorption events. L is absorbed energy, not incident power, so confusing energy with power would also omit the exposure duration.",
      },
      tool: "foundation:bridge-fractions-ratios",
      source: { anchor: "s9-p3-s5", label: "Read the absorbed-energy counting statement" },
    },
    {
      id: "lq-ionization-yield-bound",
      title: "Keep an unknown ionization yield as a bound",
      expressions: [closingQuantaExpressions.ionCountWithYield, closingQuantaExpressions.nonnegativeCount, closingQuantaExpressions.ionCountBound],
      reasons: {
        r0: "If some absorbed quanta do something else, fewer molecules are ionized. Without that share, the energy budget supplies an upper bound rather than a count.",
        r1: "Above the energetic threshold, introduce a separate ionization yield a between zero and one. One absorbed quantum produces at most one primary ionization, so N_ion = a N_abs. An unknown a leaves every count between zero and N_abs compatible with this model.",
        r2: "The one-primary-ionization-per-absorbed-quantum restriction excludes secondary ionization cascades and multi-quantum mechanisms. Specifying a is additional model input; hν ≥ J_mol cannot determine it. The upper bound does not become an equality merely because the frequency exceeds the threshold. The paper's last sentence explicitly excludes appreciable absorption that is unaccompanied by ionization when claiming its equality.",
      },
      tool: "foundation:bridge-fractions-ratios",
      source: { anchor: "s9-p3-s6", label: "Read the qualification about non-ionizing absorption" },
    },
    {
      id: "lq-ionization-full-yield",
      title: "Recover the printed equality only when every absorbed quantum ionizes",
      expressions: [closingQuantaExpressions.fullYieldCount, closingQuantaExpressions.gramMolecules, closingQuantaExpressions.sourceCount],
      reasons: {
        r0: "Set the yield to one. Then divide the number of ionized molecules by the number of molecules in a gram-molecule to obtain the paper's j.",
        r1: "Under the extra premise a = 1, N_ion = L/(hν). A gram-molecule contains N molecules, so j = N_ion/N = L/(Nhν). Using h = Rβ/N cancels N and leaves the printed j = L/(Rβν).",
        r2: "Here N is the paper's molecular number per gram-molecule, not N_abs or N_ion. All of N, R, β, h and ν are positive; the cancellation concerns a fixed consistent constant convention. The laboratory uses modern SI constants, whereas the source's historical numerical checks use its printed constants. The resulting equality is a conditional proposed experimental test. A simulator that assumes a = 1 cannot establish it as an observation.",
      },
      tool: "foundation:bridge-fractions-ratios",
      source: { anchor: "s9-p3-s5", label: "Read the printed gram-molecule equality" },
    },
  ] satisfies readonly ClosingQuantaStep[]),
});

const glyphs: Readonly<Record<string, string>> = Object.freeze({
  planckConstant: "h", incidentFrequency: "ν_1", emittedFrequency: "ν_2", frequency: "ν",
  otherChannelEnergy: "E_{\\mathrm{other}}", absorbedLightEnergy: "L", absorbedQuantumCount: "N_{\\mathrm{abs}}",
  ionCount: "N_{\\mathrm{ion}}", ionizationEnergyPerMolecule: "J_{\\mathrm{mol}}", avogadroConstant: "N",
  gasConstant: "R", wienBeta: "β", quantumYield: "η", absorbedPower: "P_{\\mathrm{abs}}",
  absorbedQuantumRate: "r_{\\mathrm{abs}}", emittedQuantumRate: "r_{\\mathrm{em}}", emittedPower: "P_{\\mathrm{em}}",
  pooledQuantumCount: "k", excessEnergy: "E_{\\mathrm{excess}}", thresholdFrequency: "ν_0", ionizationYield: "a",
  ionizedGramMolecules: "j",
});

export function presentClosingQuantaExpression(expression: Expression): Expression {
  return projectDerivationSymbols(expression, (node) => glyphs[node.quantityId] ?? node.quantityId);
}
