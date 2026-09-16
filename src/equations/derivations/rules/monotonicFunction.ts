/**
 * Apply an invertible or monotonic function to both sides of a relation,
 * recording the domain. A square root records the nonnegative domain and,
 * where two roots exist, the chosen branch and the cited condition that
 * selects it.
 */

import type { Expression } from "../../ast.ts";
import { structurallyEqual } from "../treeUtils.ts";
import type { RuleCheckArgs, RuleCheckResult, RuleDefinition } from "./types.ts";

export type MonotonicFunctionName = "square-root" | "square";

export interface MonotonicFunctionParams {
  readonly function: MonotonicFunctionName;
  readonly domain: string;
  /** Required when the function is not globally invertible (a square root has two roots). */
  readonly branch?: "positive" | "negative";
  readonly branchCondition?: string;
}

function applyForward(
  side: Expression,
  fn: MonotonicFunctionName,
  branch: "positive" | "negative" | undefined,
): Expression {
  if (fn === "square") return { kind: "power", base: side, exponent: { num: 2, den: 1 } };
  const root: Expression = { kind: "root", radicand: side, degree: 2 };
  return branch === "negative" ? { kind: "negate", argument: root } : root;
}

function check({ from, to, params }: RuleCheckArgs): RuleCheckResult {
  const p = params as unknown as MonotonicFunctionParams;
  if (!p.domain?.trim()) {
    return { outcome: "fail", reason: "monotonic-function requires a domain." };
  }
  if (p.function === "square-root" && !p.branch) {
    return {
      outcome: "fail",
      reason: "a square root requires a chosen branch (positive or negative).",
    };
  }
  if (p.function === "square-root" && !p.branchCondition?.trim()) {
    return {
      outcome: "fail",
      reason: "a square root requires the cited condition that selects its branch.",
    };
  }
  if (from.kind !== "relation" || to.kind !== "relation") {
    return {
      outcome: "fail",
      reason: "monotonic-function requires both from and to to be relations.",
    };
  }
  const expected: Expression = {
    kind: "relation",
    operator: from.operator,
    left: applyForward(from.left, p.function, p.branch),
    right: applyForward(from.right, p.function, p.branch),
  };
  if (!structurallyEqual(to, expected)) {
    return {
      outcome: "fail",
      reason: `applying ${p.function} to both sides of "from" does not produce "to".`,
    };
  }
  return { outcome: "pass" };
}

export const monotonicFunctionRule: RuleDefinition = { kind: "monotonic-function", check };
