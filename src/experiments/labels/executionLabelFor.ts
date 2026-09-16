/**
 * The four public execution labels, earned per accepted snapshot
 * (am-inst-execution-labels-5ywv). Renders `ExecutionStateKind`
 * (src/experiments/provenance/executionState.ts) into the exact public wording and the
 * `data-execution-label` value the harness DOM contract (scripts/e2e/domContract.ts,
 * `EXECUTION_LABELS`) validates against. This module owns none of the derivation: it takes
 * only the already-derived state, so a loader flag or an artifact digest has no parameter to
 * travel through even if a caller had one.
 */
import type { ExecutionStateKind } from "../provenance/executionState.ts";

/** Matches scripts/e2e/domContract.ts's `EXECUTION_LABELS`, declared independently (that
 * module lives outside src/ and is not imported from production code) and cross-checked by
 * executionLabelFor.test.ts rather than shared by import. */
export const DATA_EXECUTION_LABEL_VALUES = ["frankensim", "host", "static", "unavailable"] as const;
export type DataExecutionLabelValue = (typeof DATA_EXECUTION_LABEL_VALUES)[number];

export type ExecutionLabelInfo = Readonly<{
  text: string;
  dataExecutionLabel: DataExecutionLabelValue;
}>;

/**
 * Pure, exhaustive mapping from the four derived states to their public wording. The switch
 * has no default case: an `ExecutionStateKind` value added upstream without a case here fails
 * `bun run typecheck` (`exhaustive` is typed `never`), rather than silently rendering nothing.
 */
export function executionLabelFor(state: ExecutionStateKind): ExecutionLabelInfo {
  switch (state) {
    case "frankensim-accepted":
      return Object.freeze({
        text: "Ideal model, computed with FrankenSim",
        dataExecutionLabel: "frankensim",
      });
    case "host-accepted":
      return Object.freeze({
        text: "Ideal model, host calculation",
        dataExecutionLabel: "host",
      });
    case "static-example":
      return Object.freeze({ text: "Static worked example", dataExecutionLabel: "static" });
    case "unavailable":
      return Object.freeze({
        text: "This experiment is unavailable on this device",
        dataExecutionLabel: "unavailable",
      });
    default: {
      const exhaustive: never = state;
      throw new Error(`Unhandled execution state: ${String(exhaustive)}`);
    }
  }
}
