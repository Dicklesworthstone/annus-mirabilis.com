/**
 * Apply one arithmetic operation to both sides. Exact simplification is opt-in so an authored
 * draft gains a machine check only when its owner requests the bounded rational vocabulary.
 * Division retains its stated nonzero condition; a side exchange is explicit.
 */
import type { Expression } from "../../ast.ts";
import { checkRationalSimplification } from "../rationalSimplification.ts";
import { structurallyEqual } from "../treeUtils.ts";
import type { RuleCheckArgs, RuleCheckResult, RuleDefinition } from "./types.ts";

export type ArithmeticOperation = "add" | "subtract" | "multiply" | "divide";

export interface AddSubtractMultiplyDivideParams {
  readonly operation: ArithmeticOperation;
  readonly quantity: Expression;
  readonly nonzeroCondition?: string;
  readonly simplify?: boolean;
  readonly swapSides?: boolean;
}

function applyOperation(
  side: Expression,
  op: ArithmeticOperation,
  quantity: Expression,
): Expression {
  switch (op) {
    case "add":
      return { kind: "sum", args: [side, quantity] };
    case "subtract":
      return { kind: "sum", args: [side, { kind: "negate", argument: quantity }] };
    case "multiply":
      return { kind: "product", args: [side, quantity] };
    case "divide":
      return { kind: "quotient", numerator: side, denominator: quantity };
  }
}

function check({ from, to, params }: RuleCheckArgs): RuleCheckResult {
  const p = params as unknown as AddSubtractMultiplyDivideParams;
  if (!["add", "subtract", "multiply", "divide"].includes(p.operation)) {
    return {
      outcome: "fail",
      reason: "add-subtract-multiply-divide requires a supported operation.",
    };
  }
  if (!p.quantity) {
    return {
      outcome: "fail",
      reason: "add-subtract-multiply-divide requires a quantity to apply.",
    };
  }
  if (
    p.operation === "divide" &&
    (typeof p.nonzeroCondition !== "string" || !p.nonzeroCondition.trim())
  ) {
    return {
      outcome: "fail",
      reason: "division requires a nonzeroCondition for the divisor.",
    };
  }
  if (from.kind !== "relation" || to.kind !== "relation") {
    return {
      outcome: "fail",
      reason: "add-subtract-multiply-divide requires both from and to to be relations.",
    };
  }
  if (from.operator !== to.operator) {
    return {
      outcome: "fail",
      reason: "Arithmetic must preserve the relation's operator.",
    };
  }
  if (p.simplify !== undefined && typeof p.simplify !== "boolean") {
    return {
      outcome: "fail",
      reason: "simplify must be an explicit boolean.",
    };
  }
  if (p.swapSides !== undefined && typeof p.swapSides !== "boolean") {
    return {
      outcome: "fail",
      reason: "swapSides must be an explicit boolean.",
    };
  }
  if (p.swapSides && from.operator !== "=") {
    return {
      outcome: "fail",
      reason: "Only an exact equality may exchange its sides.",
    };
  }
  if (structurallyEqual(from, to)) {
    return {
      outcome: "fail",
      reason: "Arithmetic returned its own input without a changed step.",
    };
  }
  if (
    (from.operator === "le" || from.operator === "ge") &&
    (p.operation === "multiply" || p.operation === "divide")
  ) {
    return {
      outcome: "unverifiable",
      reason: "Multiplication or division of a bound needs a checked sign condition.",
    };
  }

  const left = applyOperation(from.left, p.operation, p.quantity);
  const right = applyOperation(from.right, p.operation, p.quantity);
  const expected: Expression = {
    kind: "relation",
    operator: from.operator,
    left: p.swapSides ? right : left,
    right: p.swapSides ? left : right,
  };
  if (p.simplify !== true) {
    if (structurallyEqual(to, expected)) return { outcome: "pass" };
    return {
      outcome: "unverifiable",
      reason:
        "The result is not the literal operation; exact simplification requires simplify: true.",
    };
  }

  const comparisons = [
    checkRationalSimplification(expected.left, to.left),
    checkRationalSimplification(expected.right, to.right),
  ];
  const refusal = comparisons.find((result) =>
    ["different", "undefined", "domain-change"].includes(result.outcome),
  );
  if (refusal) {
    return {
      outcome: "fail",
      reason:
        refusal.reason ?? "The stated arithmetic operation does not produce the proposed result.",
    };
  }
  if (comparisons.every((result) => result.outcome === "equal")) return { outcome: "pass" };
  return {
    outcome: "unverifiable",
    reason:
      comparisons.find((result) => result.outcome === "unsupported")?.reason ??
      "The proposed simplification is outside bounded exact rational arithmetic.",
  };
}

export const addSubtractMultiplyDivideRule: RuleDefinition = {
  kind: "add-subtract-multiply-divide",
  check,
};
