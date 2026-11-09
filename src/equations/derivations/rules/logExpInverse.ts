import { findNode } from "../../ast.ts";
import { structurallyEqual, substituteNode } from "../treeUtils.ts";
import type { RuleCheckArgs, RuleCheckResult } from "./types.ts";

/** ln(exp(x)) = x for real x; this does not admit exp(ln(x)) without a positive-domain premise. */
export function checkLogExpInverse({ from, to, params }: RuleCheckArgs): RuleCheckResult {
  const targetId = params.targetId;
  if (typeof targetId !== "string" || !targetId.trim()) {
    return { outcome: "fail", reason: "log-exp-inverse requires the id of the logarithm node." };
  }
  const target = findNode(from, targetId);
  if (
    target?.kind !== "function" ||
    target.name !== "ln" ||
    target.argument.kind !== "function" ||
    target.argument.name !== "exp"
  ) {
    return { outcome: "fail", reason: "the declared node must be a logarithm of an exponential." };
  }
  const expected = substituteNode(from, targetId, target.argument.argument);
  return structurallyEqual(to, expected)
    ? { outcome: "pass" }
    : {
        outcome: "fail",
        reason: "removing the declared ln(exp(...)) pair does not produce the stated result.",
      };
}
