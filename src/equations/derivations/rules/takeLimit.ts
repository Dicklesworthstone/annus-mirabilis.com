/**
 * Take a mathematical limit as a variable approaches a target value.
 */

import type { RuleCheckArgs, RuleCheckResult, RuleDefinition } from "./types.ts";

export interface TakeLimitParams {
  readonly variable: string;
  readonly approaches: string | number;
  readonly domain?: string;
}

function check({ params }: RuleCheckArgs): RuleCheckResult {
  const p = params as unknown as TakeLimitParams;
  if (!p.variable || typeof p.variable !== "string" || !p.variable.trim()) {
    return { outcome: "fail", reason: "take-limit requires a variable." };
  }
  if (p.approaches === undefined || p.approaches === null || String(p.approaches).trim() === "") {
    return { outcome: "fail", reason: "take-limit requires an approached value." };
  }
  return {
    outcome: "unverifiable",
    reason: "symbolic limits are not checked structurally; requires a spot check and review.",
  };
}

export const takeLimitRule: RuleDefinition = { kind: "take-limit", check };
