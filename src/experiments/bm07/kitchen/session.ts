import {
  sharedLaboratoryAdmission,
  type WorkerAdmission,
} from "../../../workers/scheduler/admission.ts";
import type { WorkerChannel } from "../../../workers/scheduler/hostScheduler.ts";
import { executionOutcomeRegistry } from "../../results/outcomes.ts";
import { makeRefusal } from "../../results/refusals.ts";
import {
  type AcceptedSnapshot,
  createInstanceStore,
  type ExperimentView,
} from "../../store/instanceStore.ts";
import { exportKitchenCsv } from "./csv.ts";
import {
  KITCHEN_OPTIONS,
  KITCHEN_OUTPUTS,
  type KitchenAnalysis,
  type KitchenOptions,
} from "./definition.ts";
import {
  checkCsvSize,
  decodeKitchenResponse,
  KITCHEN_PROTOCOL,
  type KitchenRequest,
  textDigest,
  validateKitchenOptions,
} from "./protocol.ts";
import type { KitchenDocument } from "./schema.ts";
export type KitchenReport = Omit<KitchenAnalysis, "outputs">;
export type KitchenAccepted = Readonly<{
  document: KitchenDocument;
  report: KitchenReport;
  snapshot: AcceptedSnapshot;
  sourceId: string;
  documentDigest: string;
  csv: string;
}>;
export type KitchenView = Readonly<{
  view: ExperimentView;
  accepted: KitchenAccepted | null;
  message: string;
  preparing: boolean;
}>;
function frozen<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(frozen);
    Object.freeze(value);
  }
  return value;
}
export function createKitchenSession(
  instanceId: string,
  factory: () => WorkerChannel,
  sourceDigest: string,
  admission: WorkerAdmission = sharedLaboratoryAdmission(),
) {
  const makeStore = (suffix: string) =>
    createInstanceStore({
      experimentId: "bm-07-kitchen",
      instanceId: instanceId + suffix,
      initialParameters: { sourceId: "", documentDigest: "", ...KITCHEN_OPTIONS },
      parameterClasses: {
        sourceId: "input",
        documentDigest: "measurement",
        track: "measurement",
        axis: "measurement",
        coverage: "estimator",
        constantSet: "estimator",
      },
      outputs: KITCHEN_OUTPUTS,
      allowPartial: true,
    });
  let store = makeStore(""),
    accepted: KitchenAccepted | null = null,
    generation = 0,
    clears = 0;
  let channel: WorkerChannel | null = null,
    unlisten: (() => void) | null = null,
    active: KitchenRequest | null = null,
    queued: KitchenRequest | null = null;
  let deadline: ReturnType<typeof setTimeout> | null = null;
  let schedulingPaused = false;
  let connectionGeneration = 0;
  const admissionOwner = {};
  type Reservation = { phase: "waiting" | "active"; releaseRequested: boolean };
  let reservation: Reservation | null = null;
  let settling = 0;
  const listeners = new Set<() => void>();
  let state: KitchenView = Object.freeze({
    view: store.getSnapshot(),
    accepted: null,
    message: "",
    preparing: false,
  });
  const initial = state;
  const emit = (message = "", preparing = false) => {
    state = Object.freeze({ view: store.getSnapshot(), accepted, message, preparing });
    for (const fn of listeners)
      try {
        fn();
      } catch {
        /* A subscriber cannot corrupt the accepted bundle. */
      }
  };
  function clearDeadline() {
    if (deadline) clearTimeout(deadline);
    deadline = null;
  }
  function releaseAdmission(slot: Reservation) {
    if (reservation !== slot) return;
    reservation = null;
    admission.release(admissionOwner);
  }
  /**
   * Keep the old lease through publication and teardown. A listener may stop, clear or submit
   * again synchronously; that new work must not acquire an owner still held by the old job.
   */
  function settle(slot: Reservation | null, operation: () => void) {
    settling++;
    try {
      operation();
    } finally {
      if (slot) slot.releaseRequested = true;
      settling--;
      if (settling === 0) {
        const finished = reservation;
        if (finished?.releaseRequested) releaseAdmission(finished);
        dispatchQueued();
      }
    }
  }
  /** Fence old callbacks before publishing; dispose the saved worker before releasing capacity. */
  function detachWorker() {
    connectionGeneration++;
    clearDeadline();
    const previousUnlisten = unlisten;
    const previousChannel = channel;
    unlisten = null;
    channel = null;
    active = null;
    queued = null;
    return () => {
      try {
        previousUnlisten?.();
      } catch {
        /* The connection generation already fences late callbacks. */
      }
      try {
        previousChannel?.dispose();
      } catch {
        /* A failed teardown must not overwrite a newer accepted bundle. */
      }
    };
  }
  const fail = (message: string) => {
    settle(reservation, () => {
      const disposeWorker = detachWorker();
      const token = store.getSnapshot().requested;
      if (token && store.getSnapshot().pending)
        store.fail(token, {
          outcome: "invariant-violation",
          ...executionOutcomeRegistry["invariant-violation"],
        });
      emit(message);
      disposeWorker();
    });
  };
  function current(request: KitchenRequest, slot: Reservation) {
    return active === request && reservation === slot && slot.phase === "active";
  }
  function send(request: KitchenRequest, slot: Reservation) {
    active = request;
    deadline = setTimeout(() => {
      if (current(request, slot))
        fail(
          "The local analysis timed out. Accepted data remain unchanged; retry or use a smaller file.",
        );
    }, 30000);
    try {
      let connected = channel;
      if (!connected) {
        const epoch = ++connectionGeneration;
        const created = factory();
        if (epoch !== connectionGeneration || !current(request, slot)) {
          created.dispose();
          return;
        }
        channel = created;
        const stopListening = created.listen(
          (input) => {
            if (epoch === connectionGeneration && channel === created) receive(input);
          },
          () => {
            if (epoch === connectionGeneration && channel === created)
              fail("The local analysis worker stopped. The last accepted analysis is unchanged.");
          },
        );
        if (epoch === connectionGeneration && channel === created) unlisten = stopListening;
        else {
          stopListening();
          return;
        }
        connected = created;
      }
      if (current(request, slot) && channel === connected) connected.send(request);
    } catch {
      if (current(request, slot))
        fail(
          "The local analysis worker is unavailable. The accepted observations remain available for export.",
        );
    }
  }
  function dispatchQueued() {
    if (settling || schedulingPaused || active || !queued || state.preparing || reservation) return;
    const slot: Reservation = { phase: "waiting", releaseRequested: false };
    reservation = slot;
    admission.acquire(
      admissionOwner,
      () => {
        if (reservation !== slot) return;
        slot.phase = "active";
        if (schedulingPaused || !queued || state.preparing) {
          releaseAdmission(slot);
          return;
        }
        const request = queued;
        queued = null;
        send(request, slot);
      },
      () => {
        if (reservation === slot)
          fail(
            "The local analysis worker is unavailable. The accepted observations remain available for export.",
          );
      },
    );
  }
  function receive(input: unknown) {
    const job = active;
    const slot = reservation;
    if (!job || !slot || slot.phase !== "active") return;
    settle(slot, () => {
      active = null;
      clearDeadline();
      try {
        // Even a superseded packet must attest a terminal result before its worker frees a slot.
        const { message, document } = decodeKitchenResponse(input, job);
        if (
          !state.preparing &&
          store.getSnapshot().pending &&
          job.token.actionIndex === store.getSnapshot().requested?.actionIndex
        ) {
          if (message.result.kind === "refused") {
            store.refuse(
              job.token,
              makeRefusal(
                "invalid-parameter",
                { capabilityId: "diffusion.inference" },
                { details: { requirements: message.result.message } },
              ),
            );
            emit(message.result.message);
          } else {
            const { outputs, ...report } = message.result.analysis;
            const decision = store.publish({
              ...job.token,
              outputs,
              stepIndex: 0,
              simulationTime: 0,
              final: true,
            });
            if (!decision.accepted) throw new TypeError("The observation publication was rejected.");
            if (!document) throw new TypeError("Missing accepted observation document.");
            const acceptedSnapshot = store.getSnapshot().accepted;
            if (!acceptedSnapshot) throw new TypeError("Missing accepted snapshot.");
            accepted = frozen({
              document,
              report,
              snapshot: acceptedSnapshot,
              sourceId: String(job.token.parameters.sourceId),
              documentDigest: String(job.token.parameters.documentDigest),
              csv: job.csv,
            });
            emit();
          }
        }
      } catch {
        fail(
          "A malformed or mismatched analysis was rejected. The accepted observations are unchanged.",
        );
      }
    });
  }
  async function submit(csv: string, options: KitchenOptions = KITCHEN_OPTIONS, newSource = true) {
    const ticket = ++generation;
    const waiting = reservation?.phase === "waiting" ? reservation : null;
    queued = null;
    try {
      checkCsvSize(csv);
      options = validateKitchenOptions(options);
    } catch (e) {
      settle(waiting, () => {
        store.pause();
        emit(e instanceof Error ? e.message : "Invalid import.");
      });
      return false;
    }
    // Invalidate old publication and withdraw queued admission before awaiting the new digest.
    settle(waiting, () => {
      store.pause();
      emit("Checking the local file identity. Existing results remain unchanged.", true);
    });
    if (ticket !== generation) return false;
    try {
      const documentDigest = await textDigest(csv);
      if (ticket !== generation) return false;
      const sourceId = newSource || !accepted ? documentDigest : accepted.sourceId;
      let token =
        newSource ||
        !store.getSnapshot().requested ||
        store.getSnapshot().requested?.parameters.sourceId !== sourceId
          ? store.issue("setup-change", { sourceId })
          : null;
      const prev = store.getSnapshot().requested?.parameters ?? {};
      const measurement = { documentDigest, track: options.track, axis: options.axis };
      if (Object.entries(measurement).some(([k, v]) => prev[k] !== v))
        token = store.issue("measurement-change", measurement);
      const estimator = { coverage: options.coverage, constantSet: options.constantSet };
      if (Object.entries(estimator).some(([k, v]) => prev[k] !== v))
        token = store.issue("estimator-change", estimator);
      token ??= store.issue("continue");
      const request: KitchenRequest = { version: KITCHEN_PROTOCOL, sourceDigest, token, csv };
      queued = request;
      emit();
      if (ticket !== generation) return false;
      dispatchQueued();
      return true;
    } catch (e) {
      if (ticket !== generation) return false;
      emit(e instanceof Error ? e.message : "The local file could not be prepared.");
      return false;
    }
  }
  return Object.freeze({
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    submit,
    setSchedulingPaused(paused: boolean) {
      schedulingPaused = paused;
      if (paused && reservation?.phase === "waiting")
        settle(reservation, () => {});
      else if (!paused) dispatchQueued();
    },
    reanalyze(options: KitchenOptions) {
      if (!accepted) throw new Error("Import observations first.");
      return submit(accepted.csv, options, false);
    },
    revise(document: KitchenDocument, options?: KitchenOptions) {
      if (!accepted) throw new Error("Import observations first.");
      return submit(exportKitchenCsv(document), options ?? accepted.report.options, false);
    },
    stop() {
      generation++;
      settle(reservation, () => {
        const disposeWorker = detachWorker();
        store.pause();
        emit("Stopped. Accepted observations remain readable and exportable.");
        disposeWorker();
      });
    },
    clear() {
      generation++;
      settle(reservation, () => {
        const disposeWorker = detachWorker();
        accepted = null;
        store = makeStore(`/clear/${++clears}`);
        emit("Local observations cleared from this laboratory. Downloaded files are not deleted.");
        disposeWorker();
      });
    },
    disconnect() {
      generation++;
      settle(reservation, () => {
        const disposeWorker = detachWorker();
        store.pause();
        emit();
        disposeWorker();
      });
    },
  });
}
