import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { BM01_CLASSES } from "../bm01/definition.ts";
import { BM06_PARAMETER_CLASSES } from "../bm06/definition.ts";
import { type ApplyFailure, applyFailure, failureFromThrown } from "../results/applyFailure.ts";
import type {
  AcceptedSnapshot,
  ExperimentView,
  Parameters,
  RequestToken,
} from "../store/instanceStore.ts";
import { type CoherentGroupSnapshot, createExperimentGroup } from "./groupStore.ts";
import { createGroupMemberPort } from "./memberPort.ts";
import { type ExperimentGroupDefinition, ExperimentGroupDefinitionError } from "./schema.ts";

export type BrownianOwner = Readonly<{
  getSnapshot(): ExperimentView;
  subscribe(listener: () => void): () => void;
  acceptedParameters(): Parameters;
  apply(input: unknown): Computation<RequestToken>;
  stop(): void;
  disconnect(): void;
  setSchedulingPaused(paused: boolean): void;
}>;

export function assertBrownianComparisonInputs(tracer: Parameters, density: Parameters): void {
  if (
    tracer.T !== density.T ||
    tracer.eta !== density.eta ||
    tracer.interval !== density.t ||
    tracer.constantSetId !== "modern-si-2019" ||
    tracer.d !== 1 ||
    tracer.axis !== 0 ||
    density.gridEnabled !== false ||
    density.copiedDiffusivityInstanceId !== "" ||
    density.copiedDiffusivityRunId !== "" ||
    density.copiedDiffusivitySnapshotVersion !== 0 ||
    density.copiedDiffusivityValue !== 0
  )
    throw new ExperimentGroupDefinitionError(
      "invalid-experiment-group",
      "The Brownian comparison requires the same temperature, viscosity and observation interval, modern SI constants, one x coordinate, an unbounded density and no copied diffusivity.",
    );
}

type CoherentPair = Readonly<{
  generationId: number;
  value: number;
  snapshots: readonly AcceptedSnapshot[];
}>;

type MemberView = Readonly<{
  instrumentId: string;
  instanceId: string;
  view: ExperimentView;
  status: "ready" | "pending" | "accepted" | "refused" | "paused" | "unavailable";
  failure: ApplyFailure | null;
}>;

export type BrownianRadiusView = Readonly<{
  enabled: boolean;
  generationId: number;
  requestedValue: number | null;
  status: "independent" | "pending" | "accepted" | "incomplete";
  members: readonly MemberView[];
  coherent: CoherentPair | null;
  displayed: readonly AcceptedSnapshot[];
}>;

/**
 * Brownian composition over the shared group store. The store owns coherent generations and
 * request admission; this consumer owns its two worker sessions, visibility and independent forms.
 */
export function createBrownianRadiusGroup(
  definition: ExperimentGroupDefinition,
  owners: readonly [BrownianOwner, BrownianOwner],
  options: Readonly<{ onError?: (error: unknown) => void }> = {},
) {
  assertBrownianComparisonInputs(owners[0].acceptedParameters(), owners[1].acceptedParameters());
  const ports = [
    createGroupMemberPort(definition, "bm-01", owners[0], BM01_CLASSES),
    createGroupMemberPort(definition, "bm-06", owners[1], BM06_PARAMETER_CLASSES),
  ] as const;
  const group = createExperimentGroup(definition, ports, options);
  let connected = false;
  let closing = false;
  let issuing = 0;
  let unsubscribe: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const independentFailures: (ApplyFailure | null)[] = [null, null];
  const independentEpoch = [0, 0];
  let sourcePair: CoherentGroupSnapshot | null = null;
  let pair: CoherentPair | null = null;

  function project(): BrownianRadiusView {
    const state = group.getSnapshot();
    if (sourcePair !== state.coherent) {
      sourcePair = state.coherent;
      pair = sourcePair
        ? Object.freeze({
            generationId: sourcePair.generationId,
            value: sourcePair.valueSI,
            snapshots: Object.freeze(sourcePair.members.map((member) => member.snapshot)),
          })
        : null;
    }
    const members = owners.map((owner, index): MemberView => {
      const view = owner.getSnapshot();
      const port = ports[index];
      const member = state.members.find((entry) => entry.instanceId === port?.instanceId);
      const failure = state.enabled
        ? (member?.failure ??
          (member?.refusal ? applyFailure({ kind: "refused", refusal: member.refusal }) : null))
        : (independentFailures[index] ??
          (view.refusal
            ? applyFailure({ kind: "refused", refusal: view.refusal })
            : view.outcome
              ? applyFailure({ kind: "outcome", outcome: view.outcome })
              : null));
      const status: MemberView["status"] = failure
        ? failure.kind === "refused"
          ? "refused"
          : "unavailable"
        : state.enabled
          ? member?.status === "independent" || !member
            ? "ready"
            : member.status
          : view.pending
            ? "pending"
            : view.status === "paused"
              ? "paused"
              : "ready";
      return Object.freeze({
        instrumentId: port?.definition.instrumentId ?? "",
        instanceId: port?.instanceId ?? "",
        view,
        status,
        failure,
      });
    });
    return Object.freeze({
      enabled: state.enabled,
      generationId: state.generationId,
      requestedValue: state.requestedValueSI,
      status:
        state.phase === "refused" || state.phase === "incomplete" ? "incomplete" : state.phase,
      members: Object.freeze(members),
      coherent: pair,
      displayed: state.enabled && pair ? pair.snapshots : state.independentSnapshots,
    });
  }

  let snapshot = project();
  const serverSnapshot = snapshot;
  function reportError(error: unknown) {
    if (options.onError) {
      try {
        options.onError(error);
      } catch (reportingError) {
        queueMicrotask(() => {
          throw reportingError;
        });
      }
    } else
      queueMicrotask(() => {
        throw error;
      });
  }
  function refresh() {
    if (issuing) return;
    snapshot = project();
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        reportError(error);
      }
    }
  }
  function stopPendingOwners() {
    for (const owner of owners) {
      if (!owner.getSnapshot().pending) continue;
      try {
        owner.stop();
      } catch (error) {
        reportError(error);
      }
    }
  }
  function disconnectOwners() {
    for (const owner of owners) {
      try {
        owner.disconnect();
      } catch (error) {
        reportError(error);
      }
    }
  }
  function afterApply(cancelIfUnlinked = false) {
    // A synchronous owner subscriber can unmount before apply creates its scheduler. Retire
    // any scheduler created after that cleanup, including when an independent form was submitted.
    if (!connected && issuing === 0) disconnectOwners();
    else if (cancelIfUnlinked && !group.getSnapshot().enabled) stopPendingOwners();
    refresh();
  }
  function linkedChange(value: number, link: boolean) {
    if (!connected || closing) return;
    if (!link && !group.getSnapshot().enabled) return;
    independentFailures.fill(null);
    issuing += 1;
    try {
      if (link) group.link(value);
      else group.change(value);
    } finally {
      issuing -= 1;
      afterApply(true);
    }
  }
  function unlink() {
    if (closing) return;
    closing = true;
    independentFailures.fill(null);
    for (let index = 0; index < independentEpoch.length; index++)
      independentEpoch[index] = (independentEpoch[index] ?? 0) + 1;
    issuing += 1;
    try {
      stopPendingOwners();
      group.unlink();
    } finally {
      issuing -= 1;
      refresh();
      closing = false;
    }
  }
  return Object.freeze({
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    connect() {
      if (connected || closing) return;
      connected = true;
      unsubscribe = group.subscribe(refresh);
      group.connect();
      refresh();
    },
    link: (value: number) => linkedChange(value, true),
    update: (value: number) => linkedChange(value, false),
    applyMember(instrumentId: string, value: number) {
      if (!connected || closing) return;
      if (group.getSnapshot().enabled) {
        linkedChange(value, false);
        return;
      }
      const index = ports.findIndex((port) => port.definition.instrumentId === instrumentId);
      const port = ports[index];
      if (!port) return;
      const epoch = (independentEpoch[index] ?? 0) + 1;
      independentEpoch[index] = epoch;
      const generation = group.getSnapshot().generationId;
      independentFailures[index] = null;
      let failure: ApplyFailure | null = null;
      issuing += 1;
      try {
        failure = applyFailure(port.request(value, generation));
      } catch (error) {
        failure = failureFromThrown(error, "This instrument could not accept the particle radius.");
      } finally {
        issuing -= 1;
      }
      if (
        connected &&
        !group.getSnapshot().enabled &&
        group.getSnapshot().generationId === generation &&
        independentEpoch[index] === epoch
      )
        independentFailures[index] = failure;
      afterApply();
    },
    unlink,
    setSchedulingPaused(paused: boolean) {
      for (const owner of owners) owner.setSchedulingPaused(paused);
    },
    disconnect() {
      if (closing) return;
      closing = true;
      connected = false;
      unsubscribe?.();
      unsubscribe = null;
      group.disconnect();
      try {
        independentFailures.fill(null);
        for (let index = 0; index < independentEpoch.length; index++)
          independentEpoch[index] = (independentEpoch[index] ?? 0) + 1;
        stopPendingOwners();
        group.unlink();
        disconnectOwners();
        refresh();
      } finally {
        closing = false;
      }
    },
  });
}
