/**
 * Truncate a series at a stated order with a remainder marker and domain.
 * Symbolic Taylor truncation is not checked structurally; this checker
 * enforces the required side conditions (order, domain, what was
 * neglected) and reports `unverifiable` for the transformation itself.
 */

import type { RuleCheckArgs, RuleCheckResult, RuleDefinition } from "./types.ts";

export interface TruncateSeriesParams {
  readonly variable: string;
  readonly order: number;
  readonly domain: string;
  readonly neglected: string;
}

function check({ params }: RuleCheckArgs): RuleCheckResult {
  const p = params as unknown as TruncateSeriesParams;
  if (!p.variable?.trim())
    return { outcome: "fail", reason: "truncate-series requires a variable." };
  if (!Number.isInteger(p.order) || p.order < 0) {
    return { outcome: "fail", reason: "truncate-series requires a nonnegative integer order." };
  }
  if (!p.domain?.trim()) return { outcome: "fail", reason: "truncate-series requires a domain." };
  if (!p.neglected?.trim())
    return {
      outcome: "fail",
      reason: "truncate-series requires a description of what was neglected.",
    };
  return {
    outcome: "unverifiable",
    reason:
      "symbolic series truncation is not checked structurally; requires a spot check and review.",
  };
}

export const truncateSeriesRule: RuleDefinition = { kind: "truncate-series", check };
