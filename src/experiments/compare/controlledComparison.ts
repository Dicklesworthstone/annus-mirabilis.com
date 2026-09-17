import { type Baseline, type ComparisonIdentity, type ComparisonParameters, type ComparisonSnapshot, pinBaseline } from "./Baseline.ts";
import { compareBaselines, type ComparisonResult } from "./compatibility.ts";
import { comparisonStatement } from "./comparisonStatement.ts";
import { type ComparisonContract, singleVariationLock } from "./singleVariationLock.ts";

type Refusal = Readonly<{ message: string; details?: Readonly<Record<string, unknown>> }>;
export type ComparisonPort = Readonly<{
  getSnapshot(): Readonly<{ pending: boolean; status: string; accepted: ComparisonSnapshot | null;
    requested: Readonly<{ actionIndex: number }> | null; refusal: Refusal | null; outcome: Readonly<{ message: string }> | null }>;
  subscribe(listener: () => void): () => void;
  apply(parameters: ComparisonParameters): Readonly<
    { kind: "accepted"; data: Readonly<{ actionIndex: number }> } |
    { kind: "refused"; refusal: Refusal } | { kind: "outcome"; outcome: Readonly<{ message: string }> }>;
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
export function createControlledComparison(port: ComparisonPort, options: Readonly<{
  contract: ComparisonContract;
  identity: ComparisonIdentity;
  baseline: ComparisonSnapshot;
  variant: ComparisonSnapshot;
  verifyAccepted?: (baseline: ComparisonSnapshot, variant: ComparisonSnapshot, result: ComparisonResult) => string | null;
}>) {
  const ids = options.contract.outputs.map((output) => output.id);
  const capture = (snapshot: ComparisonSnapshot) => pinBaseline(snapshot, options.identity, ids);
  const initialBaseline = capture(options.baseline), initialVariant = capture(options.variant);
  const initialResult = compareBaselines(initialBaseline, initialVariant, options.contract);
  if (initialResult.kind !== "accepted") throw new TypeError(`Invalid static comparison: ${initialResult.message}`);
  let state: ControlledComparisonState = Object.freeze({ phase: "example", pending: false,
    baseline: initialBaseline, variant: initialVariant, baselineSnapshot: options.baseline,
    variantSnapshot: options.variant, result: initialResult, requestedParameters: null,
    message: "Static worked comparison, calculated when this site was built.", error: "" });
  const serverState = state;
  let unsubscribe: (() => void) | null = null;
  let flight: { purpose: "baseline" | "variant"; action: number | null } | null = null;
  const listeners = new Set<() => void>();
  const emit = (patch: Partial<ControlledComparisonState>) => {
    state = Object.freeze({ ...state, ...patch });
    for (const listener of listeners) listener();
  };
  const failure = (message: string) => {
    flight = null;
    emit({ pending: false, error: message, message: "The previous completed comparison is unchanged." });
  };
  function refresh() {
    if (!flight || flight.action === null) return;
    const view = port.getSnapshot(), active = flight;
    if (view.pending || view.requested?.actionIndex !== active.action) return;
    if (view.status !== "accepted" || !view.accepted?.final || view.accepted.actionIndex !== active.action) {
      if (["refused", "paused", "unavailable"].includes(view.status))
        failure(view.refusal?.message ?? view.outcome?.message ?? "Calculation stopped before a completed result.");
      return;
    }
    const snapshot = view.accepted;
    try {
      const current = capture(snapshot);
      if (active.purpose === "baseline") {
        flight = null;
        emit({ phase: "live", pending: false, baseline: current, variant: current,
          baselineSnapshot: snapshot, variantSnapshot: snapshot,
          result: compareBaselines(current, current, options.contract), requestedParameters: null,
          error: "", message: "Live baseline ready. Choose one input to vary; every other input stays fixed." });
        return;
      }
      const result = compareBaselines(state.baseline, current, options.contract);
      const invariantError = options.verifyAccepted?.(state.baselineSnapshot, snapshot, result);
      if (result.kind !== "accepted" || invariantError) {
        failure(invariantError ?? (result.kind === "refused" ? result.message : "Comparison not accepted."));
        return;
      }
      flight = null;
      emit({ pending: false, variant: current, variantSnapshot: snapshot, result,
        requestedParameters: null, error: "",
        message: comparisonStatement(state.baseline, current, options.contract, result) });
    } catch {
      failure("The returned result does not satisfy this comparison's accepted-data contract.");
    }
  }
  function send(parameters: ComparisonParameters, purpose: "baseline" | "variant") {
    if (!unsubscribe || state.pending) return false;
    flight = { purpose, action: null };
    emit({ pending: true, requestedParameters: Object.freeze({ ...parameters }), error: "",
      message: purpose === "baseline" ? "Reconstructing the baseline recording. The worked comparison remains visible."
        : "Calculating the requested variant. Both previous completed results remain visible." });
    try {
      const request = port.apply(parameters);
      if (request.kind !== "accepted") {
        failure(request.kind === "refused"
          ? typeof request.refusal.details?.requirements === "string" ? request.refusal.details.requirements : request.refusal.message
          : request.outcome.message);
        return false;
      }
      if (flight) flight.action = request.data.actionIndex;
      refresh();
      return true;
    } catch {
      failure("The calculation could not start. The previous completed results remain available.");
      return false;
    }
  }
  return Object.freeze({
    getSnapshot: () => state,
    getServerSnapshot: () => serverState,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    connect() { unsubscribe ??= port.subscribe(refresh); },
    start() { return send(state.baseline.parameters, "baseline"); },
    apply(parameters: ComparisonParameters) {
      if (state.phase !== "live" || state.pending) return false;
      const decision = singleVariationLock(state.baseline.parameters, parameters, options.contract);
      if (decision.kind === "refused") { emit({ error: decision.message }); return false; }
      return send(parameters, "variant");
    },
    pinCurrent() {
      if (state.phase !== "live" || state.pending) return false;
      emit({ baseline: state.variant, baselineSnapshot: state.variantSnapshot,
        result: compareBaselines(state.variant, state.variant, options.contract), requestedParameters: null,
        error: "", message: "Current completed result pinned as the new baseline. You may now vary a different input." });
      return true;
    },
    stop() {
      if (!state.pending) return;
      flight = null;
      port.stop();
      emit({ pending: false, message: "Calculation stopped. The previous completed comparison is unchanged.", error: "" });
    },
    disconnect() {
      flight = null;
      unsubscribe?.(); unsubscribe = null;
      port.disconnect();
      // A remount has no retained worker recording, even if its last readouts remain available.
      emit({ phase: "example", pending: false, requestedParameters: null,
        message: "The completed comparison is retained. Start a live comparison to reconstruct its recording." });
    },
  });
}
