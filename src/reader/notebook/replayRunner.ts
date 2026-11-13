import {
  type Baseline,
  type ComparisonIdentity,
  type ComparisonParameters,
  type ComparisonSnapshot,
  pinBaseline,
} from "../../experiments/compare/Baseline.ts";
import {
  type ComparisonResult,
  compareBaselines,
} from "../../experiments/compare/compatibility.ts";
import { compareBitwise, withinTolerance } from "../../units/tolerance.ts";
import {
  ComparisonReplayAdapterError,
  type ComparisonReplayOwner,
  type ComparisonReplaySession,
  comparisonReplayAdapter,
} from "./comparisonAdapters.ts";
import {
  type ComparisonReplay,
  parseComparisonReplay,
  verifyReplayEvidence,
} from "./replayEntry.ts";

export type ReplayRunState = Readonly<{
  phase: "idle" | "checking" | "baseline" | "variant" | "complete" | "stopped" | "failed";
  message: string;
  baseline: Baseline | null;
  variant: Baseline | null;
  result: ComparisonResult | null;
  reproduction: "not-checked" | "matching-scalars" | "different-scalars" | "new-model";
}>;
/** Only scalar checkpoints are compared. Matching readouts do not certify unrecorded history. */
function sameScalars(saved: Baseline, current: Baseline): boolean {
  return Object.entries(saved.outputs).every(([key, a]) => {
    const b = current.outputs[key];
    if (!b || a.status !== b.status || a.unit !== b.unit || a.semanticKind !== b.semanticKind)
      return false;
    if (a.status !== "value") return a.reason === b.reason;
    if (a.value === null || b.value === null) return false;
    return (
      compareBitwise(a.value, b.value).ok ||
      withinTolerance(b.value, a.value, { relative: 1e-12 }).ok
    );
  });
}

/** Restores validated inputs through the registered instrument's scheduler/store/owner. */
export function createComparisonReplayRunner(
  input: ComparisonReplay,
  options: ComparisonReplayOwner & Readonly<{ newInstanceId?: () => string }>,
) {
  const replay = parseComparisonReplay(input);
  const adapter = comparisonReplayAdapter(options.instrumentId ?? "bm-01");
  if (adapter.instrumentId !== replay.baseline.experimentId)
    throw new ComparisonReplayAdapterError(
      "replay-owner-mismatch",
      "The saved comparison and the selected replay instrument differ. Nothing was run.",
    );
  let state: ReplayRunState = Object.freeze({
    phase: "idle",
    message: "Only what you saved is shown. Nothing has been run again.",
    baseline: null,
    variant: null,
    result: null,
    reproduction: "not-checked",
  });
  let session: ComparisonReplaySession | null = null;
  let schedulingPaused = false;
  let unsubscribe: (() => void) | null = null;
  let baselineSnapshot: ComparisonSnapshot | null = null;
  let expected: number | null = null;
  let expectedParameters: ComparisonParameters | null = null;
  let generation = 0;
  const listeners = new Set<() => void>();
  const emit = (patch: Partial<ReplayRunState>) => {
    state = Object.freeze({ ...state, ...patch });
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        /* Detached views cannot change a run. */
      }
    }
  };
  function disconnect() {
    expected = null;
    expectedParameters = null;
    unsubscribe?.();
    unsubscribe = null;
    session?.disconnect();
    session = null;
  }
  function fail(message: string) {
    disconnect();
    emit({ phase: "failed", message, baseline: null, variant: null, result: null });
  }
  function refresh() {
    if (!session || expected === null || !expectedParameters) return;
    const thisRun = generation;
    const activeSession = session;
    const view = session.getSnapshot();
    if (view.pending || view.requested?.actionIndex !== expected) return;
    if (
      view.status !== "accepted" ||
      !view.accepted?.final ||
      view.accepted.actionIndex !== expected ||
      view.accepted.experimentId !== adapter.instrumentId ||
      Object.keys(view.accepted.parameters).length !== Object.keys(expectedParameters).length ||
      Object.entries(expectedParameters).some(
        ([key, value]) => !Object.is(view.accepted?.parameters[key], value),
      )
    ) {
      fail(
        view.refusal?.message ??
          view.outcome?.message ??
          "Stopped before it finished. What you saved is unchanged.",
      );
      return;
    }
    const snapshot = view.accepted;
    try {
      const accepted = pinBaseline(
        snapshot,
        options.identity,
        adapter.contract.outputs.map((o) => o.id),
      );
      if (state.phase === "baseline") {
        baselineSnapshot = snapshot;
        emit({ baseline: accepted });
        if (generation !== thisRun || session !== activeSession) return;
        const event = replay.tape.events[0];
        if (event) {
          emit({
            phase: "variant",
            message: "The baseline is rebuilt. Now running the one change you made.",
          });
          if (generation !== thisRun || session !== activeSession) return;
          issue({ ...snapshot.parameters, [event.paramId]: event.value });
          return;
        }
      }
      const a = state.baseline;
      if (!a || !baselineSnapshot) {
        fail("The baseline did not finish, so the change cannot be run.");
        return;
      }
      const result = compareBaselines(a, accepted, adapter.contract);
      const error = adapter.verifyAccepted(baselineSnapshot, snapshot, result);
      if (result.kind !== "accepted" || error) {
        fail(
          error ??
            (result.kind === "refused"
              ? result.message
              : "The run returned a result this page cannot read."),
        );
        return;
      }
      const changed = Object.keys(options.identity).some(
        (key) =>
          options.identity[key as keyof ComparisonIdentity] !==
          replay.baseline.identity[key as keyof ComparisonIdentity],
      );
      const reproduction = changed
        ? "new-model"
        : sameScalars(replay.baseline, a) && sameScalars(replay.variant, accepted)
          ? "matching-scalars"
          : "different-scalars";
      disconnect();
      emit({
        phase: "complete",
        baseline: a,
        variant: accepted,
        result,
        reproduction,
        message: changed
          ? "The new run finished under the current model. What you saved was not replaced."
          : reproduction === "matching-scalars"
            ? adapter.matchingScalarsMessage
            : "Finished, but some numbers differ from the saved ones. Both sets are shown.",
      });
    } catch {
      fail(
        "The run returned results in a form this page cannot compare. What you saved is unchanged.",
      );
    }
  }
  function issue(parameters: ComparisonParameters) {
    if (!session) return;
    expected = null;
    expectedParameters = Object.freeze({ ...parameters });
    const request = session.apply(parameters);
    if (request.kind !== "accepted") {
      fail(request.kind === "refused" ? request.refusal.message : request.outcome.message);
      return;
    }
    expected = request.data.actionIndex;
    refresh();
  }
  return Object.freeze({
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setSchedulingPaused(paused: boolean) {
      schedulingPaused = paused;
      session?.setSchedulingPaused(paused);
    },
    async start(allowChangedModel = false) {
      const thisRun = ++generation;
      disconnect();
      baselineSnapshot = null;
      emit({
        phase: "checking",
        message: "Checking the saved numbers against their checkpoint before running again.",
        baseline: null,
        variant: null,
        result: null,
        reproduction: "not-checked",
      });
      try {
        if (!(await verifyReplayEvidence(replay))) {
          if (generation === thisRun)
            fail(
              "The saved numbers do not match their checkpoint, so nothing was run. Export the original to keep it.",
            );
          return;
        }
        if (generation !== thisRun) return;
        const changed = Object.keys(options.identity).some(
          (key) =>
            options.identity[key as keyof ComparisonIdentity] !==
            replay.baseline.identity[key as keyof ComparisonIdentity],
        );
        if (changed && !allowChangedModel) {
          fail(
            "The model has changed since you saved this. To continue, choose to run it again under the current model.",
          );
          return;
        }
        if (options.example.sourceDigest !== options.identity.sourceDigest) {
          fail(
            "The page's example and its calculation are different versions, so this cannot be run.",
          );
          return;
        }
        const id = options.newInstanceId?.() ?? `notebook-replay-${crypto.randomUUID()}`;
        if (id === replay.baseline.instanceId || id === replay.variant.instanceId) {
          fail("Running it again needs a fresh copy of the instrument.");
          return;
        }
        adapter.parameters(options.example.parameters);
        const created = await adapter.createSession(id, options);
        if (generation !== thisRun) {
          created.disconnect();
          return;
        }
        created.setSchedulingPaused(schedulingPaused);
        session = created;
        unsubscribe = session.subscribe(() => {
          if (generation === thisRun && session === created) refresh();
        });
        emit({
          phase: "baseline",
          message: "Rebuilding the saved baseline with the current calculation.",
        });
        issue(replay.tape.initialConditions);
      } catch {
        if (generation === thisRun)
          fail("It could not be run again in this browser. What you saved is unchanged.");
      }
    },
    stop() {
      generation++;
      disconnect();
      emit({
        phase: "stopped",
        message: "Stopped. What you saved is unchanged.",
        baseline: null,
        variant: null,
        result: null,
      });
    },
    dispose() {
      generation++;
      disconnect();
      listeners.clear();
    },
  });
}
