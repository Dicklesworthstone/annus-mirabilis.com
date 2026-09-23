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
    message: "Only what you saved is shown. Nothing has been run again.",
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
          "Stopped before it finished. What you saved is unchanged.",
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
            message: "The baseline is rebuilt. Now running the one change you made.",
          });
          issue({ ...snapshot.parameters, [event.paramId]: event.value });
          return;
        }
      }
      const a = state.baseline;
      if (!a || !baselineSnapshot) {
        fail("The baseline did not finish, so the change cannot be run.");
        return;
      }
      const result = compareBaselines(a, accepted, BM01_COMPARISON);
      const error = verifyBm01Comparison(baselineSnapshot, snapshot, result);
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
            ? "Finished. The new numbers agree within relative tolerance 1e-12 of the saved ones, that is, to one part in a trillion. The particles' paths were not saved, so they were not compared."
            : "Finished, but some numbers differ from the saved ones. Both sets are shown.",
      });
    } catch {
      fail(
        "The run returned results in a form this page cannot compare. What you saved is unchanged.",
      );
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
        session = createBm01Session(id, options.example, options.workerFactory);
        unsubscribe = session.subscribe(refresh);
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
      emit({ phase: "stopped", message: "Stopped. What you saved is unchanged." });
    },
    dispose() {
      generation++;
      disconnect();
      listeners.clear();
    },
  });
}
