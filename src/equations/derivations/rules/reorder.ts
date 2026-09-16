/**
 * Reorder terms or factors without semantic change (commutativity and associativity).
 */

import type { Expression } from "../../ast.ts";
import { structurallyEqual } from "../treeUtils.ts";
import type { RuleCheckArgs, RuleCheckResult, RuleDefinition } from "./types.ts";

export interface ReorderParams {
  readonly associative?: boolean;
}

function isPermutationOf(a: readonly Expression[], b: readonly Expression[]): boolean {
  if (a.length !== b.length) return false;
  const matched = new Set<number>();
  for (const itemA of a) {
    let found = false;
    for (let i = 0; i < b.length; i++) {
      const itemB = b[i];
      if (!matched.has(i) && itemB && structurallyEqual(itemA, itemB)) {
        matched.add(i);
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  return true;
}

function check({ from, to }: RuleCheckArgs): RuleCheckResult {
  if (structurallyEqual(from, to)) {
    return { outcome: "pass" };
  }

  if (from.kind === "sum" && to.kind === "sum") {
    if (isPermutationOf(from.args, to.args)) {
      return { outcome: "pass" };
    }
    return { outcome: "fail", reason: "reordered sum args do not match original terms." };
  }

  if (from.kind === "product" && to.kind === "product") {
    if (isPermutationOf(from.args, to.args)) {
      return { outcome: "pass" };
    }
    return { outcome: "fail", reason: "reordered product factors do not match original factors." };
  }

  if (from.kind === "relation" && to.kind === "relation" && from.operator === to.operator) {
    const leftOk =
      structurallyEqual(from.left, to.left) ||
      (from.left.kind === "sum" &&
        to.left.kind === "sum" &&
        isPermutationOf(from.left.args, to.left.args)) ||
      (from.left.kind === "product" &&
        to.left.kind === "product" &&
        isPermutationOf(from.left.args, to.left.args));
    const rightOk =
      structurallyEqual(from.right, to.right) ||
      (from.right.kind === "sum" &&
        to.right.kind === "sum" &&
        isPermutationOf(from.right.args, to.right.args)) ||
      (from.right.kind === "product" &&
        to.right.kind === "product" &&
        isPermutationOf(from.right.args, to.right.args));

    if (leftOk && rightOk) {
      return { outcome: "pass" };
    }
    return { outcome: "fail", reason: "reordering in relation sides does not preserve terms." };
  }

  return {
    outcome: "fail",
    reason: "reorder rule requires sum, product, or relation of sums/products.",
  };
}

export const reorderRule: RuleDefinition = { kind: "reorder", check };
