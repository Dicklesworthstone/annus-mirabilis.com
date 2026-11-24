/** Exact analytic limit and coefficient algebra; no sampled spectra stand in for a proof. */
import {
  divide,
  formatRational,
  parseRational,
  rational,
} from "../../content/dimensions/rational.ts";
import type { Expression } from "../ast.ts";
import { LIGHT_QUANTA_QUANTITIES } from "../lightQuantaQuantities.ts";
import { monomialQuotientLimit } from "./exactSeries.ts";
import {
  lqPlanckExpressions as e,
  type LqPlanckInput,
  lqPlanckAssumptions,
  lqPlanckCheckRows,
  lqPlanckInput,
  lqPlanckSymbols as p,
  planckNumber,
  planckProduct,
  planckQuotient,
  planckSum,
} from "./lightQuantaPlanck.ts";
import { boundedLqExpression } from "./lightQuantaProofTree.ts";
import { logarithmicCalculus } from "./logarithmicCalculus.ts";
import { structurallyEqual, substituteNode } from "./treeUtils.ts";

type Relation = Extract<Expression, { kind: "relation" }>;
type Symbol = Extract<Expression, { kind: "symbol" }>;
type CheckId = (typeof lqPlanckCheckRows)[number];
type Limit = ReturnType<typeof monomialQuotientLimit>;
export type LqPlanckProofReport = Readonly<{
  passed: boolean;
  rows: readonly Readonly<{ id: CheckId; passed: boolean; reason: string }>[];
  reason?: string;
  limit?: Limit;
}>;
const pi: Symbol = { kind: "symbol", quantityId: "positivePi", termId: "positivePi" };
function calculusTree(expression: Expression): Expression {
  switch (expression.kind) {
    case "constant":
      return expression.name === "pi" ? pi : expression;
    case "sum":
    case "product":
      return { ...expression, args: expression.args.map(calculusTree) };
    case "quotient":
      return {
        ...expression,
        numerator: calculusTree(expression.numerator),
        denominator: calculusTree(expression.denominator),
      };
    case "power":
      return { ...expression, base: calculusTree(expression.base) };
    case "group":
    case "negate":
      return { ...expression, argument: calculusTree(expression.argument) };
    default:
      return expression;
  }
}
function equal(left: Expression, right: Expression): boolean {
  return logarithmicCalculus({
    positive: [p.A, p.B, p.nu, p.T, p.R, p.N, p.c, p.k, p.x, p.thermal, pi],
  }).equal(calculusTree(left), calculusTree(right));
}
function same(left: Expression | undefined, right: Expression): boolean {
  try {
    return left !== undefined && structurallyEqual(left, right);
  } catch {
    return false;
  }
}
const equality = (value: Expression | undefined): value is Relation =>
  value?.kind === "relation" && value.operator === "=";
function check(
  id: CheckId,
  reason: string,
  run: () => boolean,
): LqPlanckProofReport["rows"][number] {
  try {
    const passed = run();
    return {
      id,
      passed,
      reason: passed ? reason : `The supplied expressions do not establish this step. ${reason}`,
    };
  } catch (error) {
    return {
      id,
      passed: false,
      reason:
        error instanceof Error
          ? error.message
          : "The expression is outside the supported exact calculation.",
    };
  }
}

/** The exact ratio API is reused after x = ν/(T/B) has been checked. */
function exponentialLimit(difference: Expression): Limit | undefined {
  const frequency = LIGHT_QUANTA_QUANTITIES.frequency;
  if (!frequency) return undefined;
  const equationId = "eq-model-lq-planck-limit-check";
  const normalized = substituteNode(difference, p.x.termId, planckQuotient(p.nu, p.thermal));
  let next = 0;
  function stamp(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stamp);
    if (!value || typeof value !== "object") return value;
    const copy = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, stamp(item)]));
    if (copy.kind === "symbol") copy.termId = `${equationId}.t.n${next++}`;
    else if (copy.kind && copy.kind !== "number" && copy.kind !== "constant")
      copy.opId = `${equationId}.op.n${next++}`;
    return copy;
  }
  return monomialQuotientLimit(
    {
      expression: stamp(normalized) as Expression,
      equationId,
      registry: {
        frequency,
        thermalFrequencyScale: {
          ...frequency,
          id: "thermalFrequencyScale",
          name: "Positive frequency scale T/B",
          glyph: "ν_T",
          role: "constant",
          definition: "A local mathematical name for T/B, held fixed in the low-frequency limit.",
        },
      },
      variable: { numerator: "frequency", denominator: "thermalFrequencyScale" },
      order: 3,
    },
    1,
  );
}

export function verifyLqPlanckConstants(input: LqPlanckInput = lqPlanckInput): LqPlanckProofReport {
  const low = boundedLqExpression(input.lowFrequency);
  const classical = boundedLqExpression(input.classical);
  const coefficient = boundedLqExpression(input.coefficient);
  const conclusion = boundedLqExpression(input.conclusion);
  const frequencyScale = boundedLqExpression(input.frequencyScale);
  const difference = boundedLqExpression(input.difference);
  const ratio = boundedLqExpression(input.ratio);
  const differenceLimit = boundedLqExpression(input.differenceLimit);
  const spectrumLimit = boundedLqExpression(input.spectrumLimit);
  let limit: Limit | undefined;
  const rows: LqPlanckProofReport["rows"][number][] = [];
  rows.push(
    check(
      "planck-premises",
      "The fitted Planck law, positive domain, classical compatibility and separate input provenance remain explicit premises.",
      () =>
        low?.kind === "relation" &&
        low.operator === "approx" &&
        same(low.left, e.lowFrequency.left) &&
        same(classical, e.classical) &&
        Array.isArray(input.premises) &&
        input.premises.length === lqPlanckAssumptions.length &&
        lqPlanckAssumptions.every(
          ({ id }) => input.premises.filter((premise) => premise === id).length === 1,
        ),
    ),
  );
  rows.push(
    check(
      "planck-ratio-normalization",
      "The actual spectrum divided by its proposed leading term is x/[exp(x) − 1], with x = Bν/T = ν/(T/B).",
      () => {
        if (
          low?.kind !== "relation" ||
          low.left.kind !== "quotient" ||
          low.left.denominator.kind !== "sum" ||
          low.left.denominator.args.length !== 2 ||
          !equality(frequencyScale) ||
          !same(frequencyScale.left, p.thermal) ||
          !same(frequencyScale.right, e.frequencyScale.right) ||
          !equality(ratio) ||
          !difference
        )
          return false;
        const [exponential, constant] = low.left.denominator.args;
        if (
          exponential?.kind !== "function" ||
          exponential.name !== "exp" ||
          !constant ||
          !same(constant, planckNumber("-1"))
        )
          return false;
        return (
          equal(exponential.argument, planckQuotient(p.nu, frequencyScale.right)) &&
          equal(planckQuotient(low.left.numerator, low.right), exponential.argument) &&
          same(difference, planckSum({ ...exponential, argument: p.x }, constant)) &&
          same(ratio.left, planckQuotient(low.left, low.right)) &&
          same(ratio.right, planckQuotient(p.x, difference))
        );
      },
    ),
  );
  rows.push(
    check(
      "planck-exponential-limit",
      "The exact analytic jet has zero constant term and linear coefficient one, so (exp(x) − 1)/x tends to one without evaluating 0/0.",
      () => {
        if (
          !difference ||
          !equality(differenceLimit) ||
          differenceLimit.left.kind !== "limit" ||
          !same(differenceLimit.left.variable, p.x) ||
          !same(differenceLimit.left.approaches, p.zero) ||
          !same(differenceLimit.left.expression, planckQuotient(difference, p.x))
        )
          return false;
        limit = exponentialLimit(difference);
        return (
          limit?.limit === "1" &&
          limit.quotientAtZero === "not-applicable" &&
          same(differenceLimit.right, planckNumber(limit.limit))
        );
      },
    ),
  );
  rows.push(
    check(
      "planck-reciprocal-limit",
      "The nonzero difference-quotient limit permits the reciprocal limit; the spectra have the same leading coefficient only under the stated compatibility premise.",
      () => {
        if (
          !limit ||
          !difference ||
          !equality(spectrumLimit) ||
          spectrumLimit.left.kind !== "limit" ||
          !same(spectrumLimit.left.variable, p.x) ||
          !same(spectrumLimit.left.approaches, p.zero) ||
          !same(spectrumLimit.left.expression, planckQuotient(p.x, difference))
        )
          return false;
        const value = parseRational(limit.limit);
        return (
          value.num !== 0n &&
          same(spectrumLimit.right, planckNumber(formatRational(divide(rational(1n), value))))
        );
      },
    ),
  );
  rows.push(
    check(
      "planck-coefficient-match",
      "Dividing both admitted leading spectra by positive ν²T gives exactly the supplied coefficient equality, after kB = R/N.",
      () => {
        if (low?.kind !== "relation" || !equality(classical) || !equality(coefficient))
          return false;
        const common = planckProduct(
          { kind: "power", base: p.nu, exponent: { num: 2, den: 1 } },
          p.T,
        );
        return (
          equal(coefficient.left, planckQuotient(low.right, common)) &&
          equal(
            coefficient.right,
            planckQuotient(
              substituteNode(classical.right, p.k.termId, planckQuotient(p.R, p.N)),
              common,
            ),
          )
        );
      },
    ),
  );
  rows.push(
    check(
      "planck-number-inference",
      "Positive factors isolate N uniquely, and substituting the actual proposed inference restores the supplied coefficient equality exactly.",
      () => {
        if (!equality(coefficient) || !equality(conclusion) || !same(conclusion.left, p.N))
          return false;
        const solved = planckProduct(p.N, planckQuotient(coefficient.right, coefficient.left));
        return (
          equal(conclusion.right, solved) &&
          equal(
            substituteNode(coefficient.left, p.N.termId, conclusion.right),
            substituteNode(coefficient.right, p.N.termId, conclusion.right),
          )
        );
      },
    ),
  );
  const failed = rows.find((row) => !row.passed);
  return {
    passed: rows.length === lqPlanckCheckRows.length && !failed,
    rows,
    ...(failed ? { reason: failed.reason } : {}),
    ...(limit ? { limit } : {}),
  };
}
