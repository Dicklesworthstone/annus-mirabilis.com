/** Substitute a subtree by id using a cited equality. */

import { structurallyEqual, substituteNode } from "../treeUtils.ts";
import type { RuleCheckArgs, RuleCheckResult, RuleDefinition } from "./types.ts";

export interface SubstituteParams {
  readonly targetId: string;
  readonly replacement: unknown;
  readonly citedEquality: string;
}

function check({ from, to, params }: RuleCheckArgs): RuleCheckResult {
  const p = params as unknown as SubstituteParams;
  if (!p.citedEquality?.trim()) {
    return {
      outcome: "fail",
      reason: "substitute requires a citedEquality naming what justifies the replacement.",
    };
  }
  if (!p.targetId?.trim()) {
    return { outcome: "fail", reason: "substitute requires a targetId." };
  }
  const expected = substituteNode(
    from,
    p.targetId,
    p.replacement as Parameters<typeof substituteNode>[2],
  );
  if (!structurallyEqual(to, expected)) {
    return {
      outcome: "fail",
      reason: `substituting "${p.targetId}" into "from" does not produce "to".`,
    };
  }
  return { outcome: "pass" };
}

export const substituteRule: RuleDefinition = { kind: "substitute", check };
