import {
  type Baseline,
  type ComparisonIdentity,
  type ComparisonParameters,
  type ComparisonSnapshot,
  pinBaseline,
} from "./Baseline.ts";
import { comparisonStatement } from "./comparisonStatement.ts";
import { type ComparisonResult, compareBaselines } from "./compatibility.ts";
import { type ComparisonContract, singleVariationLock } from "./singleVariationLock.ts";

type Refusal = Readonly<{ message: string; details?: Readonly<Record<string, unknown>> }>;
export type ComparisonPort = Readonly<{
  getSnapshot(): Readonly<{
    pending: boolean;
    status: string;
    accepted: ComparisonSnapshot | null;
    requested: Readonly<{ actionIndex: number }> | null;
    refusal: Refusal | null;
    outcome: Readonly<{ message: string }> | null;
  }>;
  subscribe(listener: () => void): () => void;
  apply(
    parameters: ComparisonParameters,
  ): Readonly<
    | { kind: "accepted"; data: Readonly<{ actionIndex: number }> }
    | { kind: "refused"; refusal: Refusal }
    | { kind: "outcome"; outcome: Readonly<{ message: string }> }
  >;
  stop(): void;
  disconnect(): void;
}>;
export type ControlledComparisonState = Readonly<{
  phase: "example" | "live";
  pending: boolean;
  baseline: Baseline;
  variant: Baseline;
  baselineSnapshot: ComparisonSnapshot;
  variantSnapshot: ComparisonSnapshot;
  result: ComparisonResult;
  requestedParameters: ComparisonParameters | null;
  message: string;
  error: string;
}>;

/**
 * Owns comparison intent, not numerical work. The port is the existing instrument session.
 * A worker must reconstruct the baseline on an explicit start before any live variation.
 */
export function createControlledComparison(
  port: ComparisonPort,
  options: Readonly<{
    contract: ComparisonContract;
    identity: ComparisonIdentity;
    baseline: ComparisonSnapshot;
    variant: ComparisonSnapshot;
    verifyAccepted?: (
      baseline: ComparisonSnapshot,
      variant: ComparisonSnapshot,
      result: ComparisonResult,
    ) => string | null;
  }>,
) {
  const ids = options.contract.outputs.map((output) => output.id);
  const capture = (snapshot: ComparisonSnapshot) => pinBaseline(snapshot, options.identity, ids);
  const initialBaseline = capture(options.baseline),
    initialVariant = capture(options.variant);
  const initialResult = compareBaselines(initialBaseline, initialVariant, options.contract);
  if (initialResult.kind !== "accepted")
    throw new TypeError(`Invalid static comparison: ${initialResult.message}`);
  let state: ControlledComparisonState = Object.freeze({
    phase: "example",
    pending: false,
    baseline: initialBaseline,
    variant: initialVariant,
    baselineSnapshot: options.baseline,
    variantSnapshot: options.variant,
    result: initialResult,
    requestedParameters: null,
    message: "Static worked comparison, calculated when this site was built.",
    error: "",
  });
  const serverState = state;
  let unsubscribe: (() => void) | null = null;
  type Flight = {
    purpose: "baseline" | "variant";
    action: number | null;
    parameters: ComparisonParameters;
    outcome: "pending" | "accepted" | "failed" | "cancelled";
  };
  let flight: Flight | null = null;
  const listeners = new Set<() => void>();
  const emit = (patch: Partial<ControlledComparisonState>) => {
    state = Object.freeze({ ...state, ...patch });
    for (const listener of listeners) listener();
  };
  const failure = (message: string, active: Flight) => {
    if (flight !== active) return;
    active.outcome = "failed";
    flight = null;
    emit({
      pending: false,
      requestedParameters: null,
      error: message,
      message: "The previous completed comparison is unchanged.",
    });
  };
  function refresh() {
    const active = flight;
    if (!active || active.action === null) return;
    const action = active.action;
    const view = port.getSnapshot();
    if (flight !== active) return;
    if (view.requested && view.requested.actionIndex > action) {
      failure("A newer session request replaced this comparison calculation.", active);
      return;
    }
    if (view.pending || view.requested?.actionIndex !== action) return;
    if (
      view.status !== "accepted" ||
      !view.accepted?.final ||
      view.accepted.actionIndex !== action
    ) {
      if (["refused", "paused", "unavailable"].includes(view.status))
        failure(
          view.refusal?.message ??
            view.outcome?.message ??
            "Calculation stopped before a completed result.",
          active,
        );
      return;
    }
    const snapshot = view.accepted;
    try {
      const current = capture(snapshot);
      const matching = singleVariationLock(active.parameters, current.parameters, options.contract);
      if (matching.kind !== "accepted" || matching.changedInput !== null) {
        failure("The returned settings do not match the requested comparison.", active);
        return;
      }
      const result = compareBaselines(state.baseline, current, options.contract);
      if (result.kind !== "accepted") {
        failure(result.message, active);
        return;
      }
      if (active.purpose === "baseline") {
        const baselineResult = compareBaselines(current, current, options.contract);
        if (baselineResult.kind !== "accepted") {
          failure(baselineResult.message, active);
          return;
        }
        active.outcome = "accepted";
        flight = null;
        emit({
          phase: "live",
          pending: false,
          baseline: current,
          variant: current,
          baselineSnapshot: snapshot,
          variantSnapshot: snapshot,
          result: baselineResult,
          requestedParameters: null,
          error: "",
          message: "Live baseline ready. Choose one input to vary; every other input stays fixed.",
        });
        return;
      }
      const invariantError = options.verifyAccepted?.(state.baselineSnapshot, snapshot, result);
      // A verifier or a subscription may cancel/restart work synchronously.
      if (flight !== active) return;
      if (invariantError) {
        failure(invariantError, active);
        return;
      }
      active.outcome = "accepted";
      flight = null;
      emit({
        pending: false,
        variant: current,
        variantSnapshot: snapshot,
        result,
        requestedParameters: null,
        error: "",
        message: comparisonStatement(state.baseline, current, options.contract, result),
      });
    } catch {
      failure(
        "The returned result does not satisfy this comparison's accepted-data contract.",
        active,
      );
    }
  }
  function send(parameters: ComparisonParameters, purpose: "baseline" | "variant") {
    if (!unsubscribe || state.pending) return false;
    const active: Flight = {
      purpose,
      action: null,
      parameters: Object.freeze({ ...parameters }),
      outcome: "pending",
    };
    flight = active;
    emit({
      pending: true,
      requestedParameters: active.parameters,
      error: "",
      message:
        purpose === "baseline"
          ? "Reconstructing the baseline recording. The worked comparison remains visible."
          : "Calculating the requested variant. Both previous completed results remain visible.",
    });
    // A reader can stop or unmount in response to the pending-state notification.
    if (flight !== active || !unsubscribe) return false;
    try {
      const request = port.apply(active.parameters);
      if (flight !== active) return false;
      if (request.kind !== "accepted") {
        failure(
          request.kind === "refused"
            ? typeof request.refusal.details?.requirements === "string"
              ? request.refusal.details.requirements
              : request.refusal.message
            : request.outcome.message,
          active,
        );
        return false;
      }
      if (!Number.isSafeInteger(request.data.actionIndex) || request.data.actionIndex < 0) {
        failure("The calculation returned an invalid request identity.", active);
        return false;
      }
      active.action = request.data.actionIndex;
      refresh();
      return active.outcome === "pending" || active.outcome === "accepted";
    } catch {
      failure(
        "The calculation could not start. The previous completed results remain available.",
        active,
      );
      return false;
    }
  }
  return Object.freeze({
    getSnapshot: () => state,
    getServerSnapshot: () => serverState,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    connect() {
      unsubscribe ??= port.subscribe(refresh);
    },
    start() {
      return send(state.baseline.parameters, "baseline");
    },
    apply(parameters: ComparisonParameters) {
      if (state.phase !== "live" || state.pending) return false;
      const decision = singleVariationLock(state.baseline.parameters, parameters, options.contract);
      if (decision.kind === "refused") {
        emit({ error: decision.message });
        return false;
      }
      return send(parameters, "variant");
    },
    pinCurrent() {
      if (state.phase !== "live" || state.pending) return false;
      const result = compareBaselines(state.variant, state.variant, options.contract);
      if (result.kind !== "accepted") {
        emit({ error: result.message });
        return false;
      }
      emit({
        baseline: state.variant,
        baselineSnapshot: state.variantSnapshot,
        result,
        requestedParameters: null,
        error: "",
        message:
          "Current completed result pinned as the new baseline. You may now vary a different input.",
      });
      return true;
    },
    stop() {
      if (!state.pending || !flight) return;
      flight.outcome = "cancelled";
      flight = null;
      let error = "";
      try {
        port.stop();
      } catch {
        error =
          "The stop request could not reach the calculation; its result will not be displayed.";
      }
      emit({
        pending: false,
        requestedParameters: null,
        message: "Comparison cancelled. The previous completed comparison is unchanged.",
        error,
      });
    },
    disconnect() {
      if (flight) flight.outcome = "cancelled";
      flight = null;
      unsubscribe?.();
      unsubscribe = null;
      port.disconnect();
      // A remount has no retained worker recording, even if its last readouts remain available.
      emit({
        phase: "example",
        pending: false,
        requestedParameters: null,
        message:
          "The completed comparison is retained. Start a live comparison to reconstruct its recording.",
      });
    },
  });
}
