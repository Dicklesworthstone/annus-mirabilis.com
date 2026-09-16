/**
 * The rule-checker contract. Three outcomes, not two: a checker that
 * cannot structurally decide a rule's correctness must say so
 * (`"unverifiable"`) rather than default to `"pass"`. `verifyChain.ts`
 * then requires an `unverifiable` step to be authored `authored-unverified`
 * with a passing spot check — a step can never claim `verified` for a
 * transformation no checker actually checked.
 */

import type { Expression } from "../../ast.ts";
import type { RuleKind } from "../types.ts";

export interface RuleCheckArgs {
  readonly from: Expression;
  readonly to: Expression;
  readonly params: Readonly<Record<string, unknown>>;
}

export type RuleCheckOutcome = "pass" | "fail" | "unverifiable";

export interface RuleCheckResult {
  readonly outcome: RuleCheckOutcome;
  /** Required for "fail"; explains why for "unverifiable"; optional for "pass". */
  readonly reason?: string | undefined;
}

export interface RuleDefinition {
  readonly kind: RuleKind;
  readonly check: (args: RuleCheckArgs) => RuleCheckResult;
}
