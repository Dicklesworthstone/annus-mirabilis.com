import { BM01_COMPARISON, verifyBm01Comparison } from "../../experiments/bm01/comparison.ts";
import { createBm01Session, type PreparedBm01Example } from "../../experiments/bm01/session.ts";
import {
  type Baseline,
  type ComparisonIdentity,
  type ComparisonSnapshot,
  pinBaseline,
} from "../../experiments/compare/Baseline.ts";
import {
  type ComparisonResult,
  compareBaselines,
} from "../../experiments/compare/compatibility.ts";
import { compareBitwise, withinTolerance } from "../../units/tolerance.ts";
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

/** Restores validated inputs through BM-01's real scheduler/store/owner. Construction never runs. */
export function createComparisonReplayRunner(
  input: ComparisonReplay,
  options: Readonly<{
    example: PreparedBm01Example;
    identity: ComparisonIdentity;
    workerFactory: Parameters<typeof createBm01Session>[2];
    newInstanceId?: () => string;
  }>,
) {
  const replay = parseComparisonReplay(input);
  let state: ReplayRunState = Object.freeze({
    phase: "idle",
    message: "Saved evidence only. No replay has started.",
    baseline: null,
    variant: null,
    result: null,
    reproduction: "not-checked",
  });
  let session: ReturnType<typeof createBm01Session> | null = null;
  let unsubscribe: (() => void) | null = null;
  let baselineSnapshot: ComparisonSnapshot | null = null;
  let expected: number | null = null;
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
    unsubscribe?.();
    unsubscribe = null;
    session?.disconnect();
    session = null;
  }
  function fail(message: string) {
    disconnect();
    emit({ phase: "failed", message });
  }
  function refresh() {
    if (!session || expected === null) return;
    const view = session.getSnapshot();
    if (view.pending || view.requested?.actionIndex !== expected) return;
    if (
      view.status !== "accepted" ||
      !view.accepted?.final ||
      view.accepted.actionIndex !== expected
    ) {
      fail(
        view.refusal?.message ??
          view.outcome?.message ??
          "Replay stopped before a completed result. Saved evidence is unchanged.",
      );
      return;
    }
    const snapshot = view.accepted;
    try {
      const accepted = pinBaseline(
        snapshot,
        options.identity,
        BM01_COMPARISON.outputs.map((o) => o.id),
      );
      if (state.phase === "baseline") {
        baselineSnapshot = snapshot;
        emit({ baseline: accepted });
        const event = replay.tape.events[0];
        if (event) {
          emit({
            phase: "variant",
            message: "Baseline reconstructed. Replaying the one declared change.",
          });
          issue({ ...snapshot.parameters, [event.paramId]: event.value });
          return;
        }
      }
      const a = state.baseline;
      if (!a || !baselineSnapshot) {
        fail("A completed replay baseline is required.");
        return;
      }
      const result = compareBaselines(a, accepted, BM01_COMPARISON);
      const error = verifyBm01Comparison(baselineSnapshot, snapshot, result);
      if (result.kind !== "accepted" || error) {
        fail(error ?? (result.kind === "refused" ? result.message : "Invalid replay result."));
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
          ? "New identified run completed under the current model. Saved results were not replaced."
          : reproduction === "matching-scalars"
            ? "Replay completed. Saved scalar readouts agree within relative tolerance 1e-12; unseen paths are not certified."
            : "Replay completed, but some saved scalar readouts differ. Both sets of results remain visible.",
      });
    } catch {
      fail("The replay returned incompatible result data. Saved evidence is unchanged.");
    }
  }
  function issue(parameters: Parameters<ReturnType<typeof createBm01Session>["apply"]>[0]) {
    if (!session) return;
    expected = null;
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
    async start(allowChangedModel = false) {
      const thisRun = ++generation;
      disconnect();
      baselineSnapshot = null;
      emit({
        phase: "checking",
        message: "Checking the saved scalar checkpoint before starting a new run.",
        baseline: null,
        variant: null,
        result: null,
        reproduction: "not-checked",
      });
      try {
        if (!(await verifyReplayEvidence(replay))) {
          if (generation === thisRun)
            fail(
              "The saved evidence does not match its checkpoint. Export the original; no replay was started.",
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
            "The model has changed. Explicitly start a new run under the current model to continue.",
          );
          return;
        }
        if (options.example.sourceDigest !== options.identity.sourceDigest) {
          fail("Current example and evaluator identities do not match.");
          return;
        }
        const id = options.newInstanceId?.() ?? `notebook-replay-${crypto.randomUUID()}`;
        if (id === replay.baseline.instanceId || id === replay.variant.instanceId) {
          fail("A replay requires a new instance identity.");
          return;
        }
        session = createBm01Session(id, options.example, options.workerFactory);
        unsubscribe = session.subscribe(refresh);
        emit({
          phase: "baseline",
          message: "Reconstructing the saved baseline with the current evaluator.",
        });
        issue(replay.tape.initialConditions);
      } catch {
        if (generation === thisRun)
          fail("Replay could not start in this environment. The saved evidence is unchanged.");
      }
    },
    stop() {
      generation++;
      disconnect();
      emit({ phase: "stopped", message: "Replay stopped. Saved evidence is unchanged." });
    },
    dispose() {
      generation++;
      disconnect();
      listeners.clear();
    },
  });
}
