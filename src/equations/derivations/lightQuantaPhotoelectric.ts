/**
 * Light quanta §8: conditional energy accounting for an escaping electron.
 * The quantum-transfer and attainable lossless-edge premises supply the budget;
 * exact arithmetic supplies its consequences, not evidence that those premises hold.
 */
import maximumRecord from "../../../content/equations/light-quanta/eq-model-lq-photoelectric-maximum.json";
import stoppingRecord from "../../../content/equations/light-quanta/eq-model-lq-stopping-energy.json";
import { type Expression, walk } from "../ast.ts";
import { projectDerivationSymbols } from "./projectSymbols.ts";
import { structurallyEqual } from "./treeUtils.ts";
import { type DerivationChain, DerivationSchemaError, type PremiseRef } from "./types.ts";

type Relation = Extract<Expression, { kind: "relation" }>;
type SymbolExpression = Extract<Expression, { kind: "symbol" }>;
type CanonicalRecord = Readonly<{ id: string; tree: unknown }>;

export class PhotoelectricDerivationError extends DerivationSchemaError {
  readonly code: string;
  constructor(code: string, message: string, path: string) {
    super(message, path);
    this.code = code;
  }
}

const named = (quantityId: string): SymbolExpression => ({
  kind: "symbol",
  termId: quantityId,
  quantityId,
});
const product = (...args: Expression[]): Expression => ({ kind: "product", args });
const sum = (...args: Expression[]): Expression => ({ kind: "sum", args });
const equation = (left: Expression, right: Expression, id: string): Relation => ({
  kind: "relation",
  operator: "=",
  left,
  right,
  opId: `lq-photoelectric.op.${id}`,
});
const K = named("maxKineticEnergy");
const h = named("planckConstant");
const frequency = named("frequency");
const work = named("escapeWork");
const charge = named("elementaryCharge");
const voltage = named("stoppingPotentialMagnitude");
const quantum = product(h, frequency);
const remainder = sum(quantum, { kind: "negate", argument: work });

/** Bind by quantity, retaining scale, index and evaluation point so none can silently change. */
export function createPhotoelectricSetup(
  maximum: CanonicalRecord = maximumRecord,
  stopping: CanonicalRecord = stoppingRecord,
) {
  const max = projectDerivationSymbols(maximum.tree as Expression, (s) => s.quantityId);
  const measured = projectDerivationSymbols(stopping.tree as Expression, (s) => s.quantityId);
  const expectedMaximum = equation(K, remainder, "expected-maximum");
  const electricalWork = equation(product(charge, voltage), K, "electrical-work");
  const expectedStopping = equation(electricalWork, remainder, "expected-stopping");
  if (
    maximum.id !== maximumRecord.id ||
    stopping.id !== stoppingRecord.id ||
    !structurallyEqual(max, expectedMaximum) ||
    !structurallyEqual(measured, expectedStopping)
  ) {
    throw new PhotoelectricDerivationError(
      "lq-photoelectric-canonical-mismatch",
      "The photoelectric argument requires the one-quantum maximum and the positive-charge stopping-energy records.",
      "photoelectric.canonical-equations",
    );
  }
  return Object.freeze({
    // Authored independently of the conclusion: this physical budget is explicitly admitted.
    budget: equation(sum(K, work), quantum, "optimal-energy-budget"),
    maximum: max as Relation,
    electricalWork,
    measured: measured as Relation,
    stoppingEnergy: equation(product(charge, voltage), remainder, "stopping-energy"),
    stoppingVoltage: equation(
      voltage,
      {
        kind: "quotient",
        numerator: remainder,
        denominator: charge,
        opId: "lq-photoelectric.op.energy-per-charge",
      },
      "stopping-voltage",
    ),
    work,
    charge,
    voltage,
    kineticEnergy: K,
  });
}

export const photoelectricEquations = createPhotoelectricSetup();
const premise = (ref: string): PremiseRef => ({ ref, edgeType: "pedagogical-reconstruction" });
export const photoelectricPremises = [
  premise("lq-photoelectric-whole-quantum"),
  premise("lq-photoelectric-attainable-edge"),
  premise("lq-photoelectric-admissible-domain"),
  premise("lq-photoelectric-retarding-work"),
] as const;
const draft = {
  historicalStatus: "pedagogical-reconstruction",
  modelStatus: "exact-within-model",
  verification: { status: "authored-unverified" },
} as const;

/** Every displayed transformation consumes the previous result. */
export const photoelectricChain: DerivationChain = {
  id: "chain-lq-photoelectric-energy",
  proofRouteId: "route-lq-one-quantum-stopping-budget",
  routeKind: "pedagogical-reconstruction",
  entryAssumptions: [...photoelectricPremises],
  target: stoppingRecord.id,
  targetStepId: "lq-photoelectric-divide-charge",
  essentialForPrint: true,
  steps: [
    {
      ...draft,
      id: "lq-photoelectric-subtract-escape-work",
      from: photoelectricEquations.budget,
      to: photoelectricEquations.maximum,
      changedSubexpressionIds: [
        "lq-photoelectric.op.optimal-energy-budget",
        maximumRecord.tree.opId,
      ],
      rule: {
        kind: "add-subtract-multiply-divide",
        params: { operation: "subtract", quantity: work, simplify: true },
      },
      reasonKind: "algebra",
      reasons: {
        r0: "One quantum pays the cost of escape. Subtract that cost to find what the fastest electron can keep.",
        r1: "Admit that one electron receives one whole quantum, and that the fastest escaping electrons can avoid extra losses. Their energy of motion plus the escape work is h times the frequency. Subtract the same escape work from both sides.",
        r2: "The starting equation K_max + W = hν is a physical energy-accounting premise, with complete one-quantum transfer and an attainable zero-extra-loss edge. Subtracting W gives K_max = hν − W. Nonnegative extra losses alone establish an upper bound; they do not prove equality is attained. No intensity or second quantum contributes to this electron's budget.",
      },
      tool: "foundation:work-energy",
      premiseRefs: photoelectricPremises.slice(0, 3),
      sourceAnchor: "lq-photoelectric-source-transfer",
      isMove: true,
      moveLabel:
        "Give one electron the energy of one whole quantum and account for the cost of escape.",
    },
    {
      ...draft,
      id: "lq-photoelectric-measure-energy",
      from: photoelectricEquations.maximum,
      to: photoelectricEquations.stoppingEnergy,
      changedSubexpressionIds: [K.termId, "lq-photoelectric.op.stopping-energy"],
      rule: {
        kind: "substitute",
        params: {
          targetId: K.termId,
          replacement: photoelectricEquations.electricalWork.left,
          citedEquality:
            "At the stopping boundary, the independently admitted retarding work is e V_s = K_max, with e the positive charge magnitude.",
        },
      },
      reasonKind: "physical-premise",
      reasons: {
        r0: "A stopping voltage measures the fastest electron's energy: charge magnitude times voltage magnitude.",
        r1: "At the stopping boundary the retarding field takes exactly the fastest electron's kinetic energy. Replace that energy by e times the stopping-potential magnitude. This imports electrical work; it does not derive the work law from the quantum hypothesis.",
        r2: "The measurement premise is e V_s = K_max. The source charges the illuminated body positively relative to its surroundings, retarding a negative electron as it leaves. Here e is positive and V_s is the nonnegative magnitude of that retarding potential. The signed electron charge is −e; substituting it for the magnitude would reverse the sign. Contact potentials and the electrode response require additional modeling.",
      },
      tool: "foundation:work-energy",
      premiseRefs: [photoelectricPremises[3]],
      sourceAnchor: "lq-photoelectric-source-stopping",
      isMove: false,
    },
    {
      ...draft,
      id: "lq-photoelectric-divide-charge",
      from: photoelectricEquations.stoppingEnergy,
      to: photoelectricEquations.stoppingVoltage,
      changedSubexpressionIds: [
        "lq-photoelectric.op.stopping-energy",
        "lq-photoelectric.op.stopping-voltage",
      ],
      rule: {
        kind: "add-subtract-multiply-divide",
        params: {
          operation: "divide",
          quantity: charge,
          simplify: true,
          nonzeroCondition: "The elementary-charge magnitude e is strictly positive.",
        },
      },
      reasonKind: "algebra",
      reasons: {
        r0: "Divide the remaining energy by the positive charge magnitude to obtain the stopping voltage.",
        r1: "Divide both sides by e. The stopping-potential magnitude is (h times frequency minus escape work) divided by e. At fixed escape work the line has slope h/e; changing intensity does not enter this energy calculation.",
        r2: "Division requires e > 0. The physical domain also has h > 0, ν > 0, W ≥ 0 and hν ≥ W. Below threshold the algebraic line is negative, so it no longer represents an escaping electron or a stopping-potential magnitude. It must not be clamped into a claimed measurement of zero. At hν = W the available energy is zero, without any guarantee of a measurable current. Partial transfer or unavoidable extra loss weakens the equality to an upper bound.",
      },
      tool: "foundation:bridge-fractions-ratios",
      premiseRefs: [photoelectricPremises[2], photoelectricPremises[3]],
      sourceAnchor: "lq-photoelectric-source-stopping",
      isMove: false,
    },
  ],
};

const glyphs: Readonly<Record<string, string>> = {
  maxKineticEnergy: "K_{\\max}",
  planckConstant: "h",
  frequency: "ν",
  escapeWork: "W",
  elementaryCharge: "e",
  stoppingPotentialMagnitude: "V_s",
};
export function presentPhotoelectricExpression(expression: Expression): Expression {
  return projectDerivationSymbols(expression, (s) => glyphs[s.quantityId] ?? s.quantityId);
}
export function presentPhotoelectricChain(chain: DerivationChain): DerivationChain {
  const symbols = new Map<string, string>();
  for (const step of chain.steps)
    for (const node of [...walk(step.from), ...walk(step.to)])
      if (node.kind === "symbol")
        symbols.set(node.termId, glyphs[node.quantityId] ?? node.quantityId);
  return {
    ...chain,
    steps: chain.steps.map((step) => ({
      ...step,
      from: presentPhotoelectricExpression(step.from),
      to: presentPhotoelectricExpression(step.to),
      changedSubexpressionIds: step.changedSubexpressionIds.map((id) => symbols.get(id) ?? id),
    })),
  };
}

export const photoelectricMetadata = {
  argument: "arg-lq-photoelectric-energy",
  anchor: "lq-photoelectric-derivation",
  ownerBeadId: "am-rc1001-bridge-plan-pcjk.31",
} as const;
