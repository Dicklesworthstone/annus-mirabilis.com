/**
 * Action Equivalence Verification Harness (am-a11y-action-contracts-k75g).
 *
 * Verifies that performing an action visually and through its nonvisual equivalent
 * from the same starting state yields:
 * 1. Identical canonical command hashes
 * 2. Identical accepted output hashes
 * 3. Identical snapshot version increment
 */

import type { ActionExecutionResult, EquivalenceComparisonResult } from "./types.ts";

export function compareActionEquivalence(
  visualExecution: ActionExecutionResult,
  equivalentExecution: ActionExecutionResult,
): EquivalenceComparisonResult {
  if (visualExecution.actionId !== equivalentExecution.actionId) {
    return Object.freeze({
      actionId: visualExecution.actionId,
      equivalent: false,
      commandHashMatches: false,
      outputsHashMatches: false,
      snapshotVersionMatches: false,
      visualExecution,
      equivalentExecution,
      mismatchReason: `Action ID mismatch: visual is "${visualExecution.actionId}", equivalent is "${equivalentExecution.actionId}"`,
    });
  }

  const commandHashMatches = visualExecution.commandHash === equivalentExecution.commandHash;
  const outputsHashMatches = visualExecution.outputsHash === equivalentExecution.outputsHash;
  const snapshotVersionMatches =
    visualExecution.snapshotVersion === equivalentExecution.snapshotVersion;

  const equivalent = commandHashMatches && outputsHashMatches && snapshotVersionMatches;

  let mismatchReason: string | undefined;
  if (!equivalent) {
    const reasons: string[] = [];
    if (!commandHashMatches) {
      reasons.push(
        `Command hash mismatch: visual=${visualExecution.commandHash.slice(0, 12)} vs equivalent=${equivalentExecution.commandHash.slice(0, 12)}`,
      );
    }
    if (!outputsHashMatches) {
      reasons.push(
        `Outputs hash mismatch: visual=${visualExecution.outputsHash.slice(0, 12)} vs equivalent=${equivalentExecution.outputsHash.slice(0, 12)}`,
      );
    }
    if (!snapshotVersionMatches) {
      reasons.push(
        `Snapshot version mismatch: visual=${visualExecution.snapshotVersion} vs equivalent=${equivalentExecution.snapshotVersion}`,
      );
    }
    mismatchReason = reasons.join("; ");
  }

  return Object.freeze({
    actionId: visualExecution.actionId,
    equivalent,
    commandHashMatches,
    outputsHashMatches,
    snapshotVersionMatches,
    visualExecution,
    equivalentExecution,
    mismatchReason,
  });
}

export interface RuntimeEquivalenceHarnessOptions {
  readonly visualAction: () => Promise<ActionExecutionResult> | ActionExecutionResult;
  readonly equivalentAction: () => Promise<ActionExecutionResult> | ActionExecutionResult;
}

/**
 * High-level equivalence harness exported for testing runtime actions across
 * all interaction families (am-a11y-action-contracts-k75g / am-inst-interaction-families-m2ps).
 */
export async function verifyRuntimeEquivalence(
  options: RuntimeEquivalenceHarnessOptions,
): Promise<EquivalenceComparisonResult> {
  const visualExecution = await options.visualAction();
  const equivalentExecution = await options.equivalentAction();
  return compareActionEquivalence(visualExecution, equivalentExecution);
}
