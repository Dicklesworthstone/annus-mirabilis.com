/**
 * The closed, versioned rule library for derivation chains.
 * Collects all rule checkers and provides lookup and mapping utilities.
 */

import type { RuleKind } from "../types.ts";
import { addSubtractMultiplyDivideRule } from "./addSubtractMultiplyDivide.ts";
import { cancelCommonFactorRule } from "./cancelCommonFactor.ts";
import { collectRule } from "./collect.ts";
import { differentiateRule } from "./differentiate.ts";
import { evaluateNumericalInstanceRule } from "./evaluateNumericalInstance.ts";
import { expandRule } from "./expand.ts";
import { factorRule } from "./factor.ts";
import { integrateRule } from "./integrate.ts";
import { monotonicFunctionRule } from "./monotonicFunction.ts";
import { registeredIdentityRule } from "./registeredIdentity.ts";
import { reorderRule } from "./reorder.ts";
import { substituteRule } from "./substitute.ts";
import { takeLimitRule } from "./takeLimit.ts";
import { truncateSeriesRule } from "./truncateSeries.ts";
import type { RuleDefinition } from "./types.ts";

export const ruleLibrary: readonly RuleDefinition[] = Object.freeze([
  substituteRule,
  cancelCommonFactorRule,
  monotonicFunctionRule,
  integrateRule,
  truncateSeriesRule,
  registeredIdentityRule,
  expandRule,
  collectRule,
  factorRule,
  reorderRule,
  addSubtractMultiplyDivideRule,
  differentiateRule,
  takeLimitRule,
  evaluateNumericalInstanceRule,
]);

const ruleMap = new Map<RuleKind, RuleDefinition>(ruleLibrary.map((rule) => [rule.kind, rule]));

export function getRule(kind: RuleKind): RuleDefinition | undefined {
  return ruleMap.get(kind);
}

/**
 * Mapping from colloquial / paper-bead rule names to canonical library RuleKind.
 */
export const RULE_NAME_MAPPING: Readonly<Record<string, RuleKind>> = Object.freeze({
  substitute: "substitute",
  "expand to stated order": "truncate-series",
  "cancel with stated reason": "cancel-common-factor",
  "apply symmetry": "registered-identity",
  "apply normalization": "registered-identity",
  integrate: "integrate",
  "take square root": "monotonic-function",
  expand: "expand",
  collect: "collect",
  factor: "factor",
  reorder: "reorder",
  differentiate: "differentiate",
  "take limit": "take-limit",
  evaluate: "evaluate-numerical-instance",
});

export * from "./addSubtractMultiplyDivide.ts";
export * from "./cancelCommonFactor.ts";
export * from "./collect.ts";
export * from "./differentiate.ts";
export * from "./evaluateNumericalInstance.ts";
export * from "./expand.ts";
export * from "./factor.ts";
export * from "./integrate.ts";
export * from "./monotonicFunction.ts";
export * from "./registeredIdentity.ts";
export * from "./reorder.ts";
export * from "./substitute.ts";
export * from "./takeLimit.ts";
export * from "./truncateSeries.ts";
export * from "./types.ts";
