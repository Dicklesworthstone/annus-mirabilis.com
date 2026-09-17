import type { ControlledComparisonState } from "../../experiments/compare/controlledComparison.ts";
import type { ComparisonParameters } from "../../experiments/compare/Baseline.ts";
import type { ReplayPrediction } from "./replayEntry.ts";

export type ComparisonPredictionIntent = Readonly<{
  candidate: ReplayPrediction;
  baselineInstanceId: string;
  baselineRunId: string;
  baselineVersion: number;
  previousActionIndex: number;
  requested: ComparisonParameters;
}>;
/** Capture intent BEFORE issuing the request, not from a choice made after its result. */
export function predictionIntent(candidate: ReplayPrediction | null, state: ControlledComparisonState, requested: ComparisonParameters): ComparisonPredictionIntent | null {
  return candidate === null ? null : Object.freeze({ candidate,
    baselineInstanceId: state.baseline.instanceId, baselineRunId: state.baseline.runId,
    baselineVersion: state.baseline.snapshotVersion, previousActionIndex: state.variantSnapshot.actionIndex,
    requested: Object.freeze({...requested}),
  });
}
export function predictionForAccepted(intent: ComparisonPredictionIntent | null, state: ControlledComparisonState): ReplayPrediction | null {
  if (!intent || state.pending || state.result.kind !== "accepted" || !state.variantSnapshot.final ||
      state.baseline.instanceId !== intent.baselineInstanceId || state.baseline.runId !== intent.baselineRunId ||
      state.baseline.snapshotVersion !== intent.baselineVersion || state.variantSnapshot.actionIndex <= intent.previousActionIndex ||
      Object.keys(intent.requested).length !== Object.keys(state.variant.parameters).length ||
      Object.keys(intent.requested).some(key => !Object.is(intent.requested[key],state.variant.parameters[key]))) return null;
  return intent.candidate;
}
