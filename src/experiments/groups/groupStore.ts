import { makeRefusal, type RequestRefusal } from "../results/refusals.ts";
import type { AcceptedSnapshot } from "../store/instanceStore.ts";
import type { GroupMemberPort } from "./memberPort.ts";
import {
  type ExperimentGroupDefinition,
  ExperimentGroupDefinitionError,
  insideGroupDomain,
} from "./schema.ts";

export type GroupAction =
  | Readonly<{ kind: "accepted"; generationId: number }>
  | Readonly<{ kind: "refused"; refusal: RequestRefusal }>;

export type GroupMemberState = Readonly<{
  instanceId: string;
  instrumentId: string;
  label: string;
  status: "independent" | "pending" | "accepted" | "refused";
  accepted: AcceptedSnapshot | null;
  refusal: RequestRefusal | null;
}>;

export type CoherentGroupSnapshot = Readonly<{
  generationId: number;
  valueSI: number;
  members: readonly Readonly<{
    instanceId: string;
    instrumentId: string;
    snapshot: AcceptedSnapshot;
  }>[];
}>;

export type ExperimentGroupState = Readonly<{
  enabled: boolean;
  generationId: number;
  phase: "independent" | "pending" | "accepted" | "refused";
  requestedValueSI: number | null;
  coherent: CoherentGroupSnapshot | null;
  /** Last unlinked descriptions, kept until the first coherent generation exists. */
  independentSnapshots: readonly AcceptedSnapshot[];
  members: readonly GroupMemberState[];
  message: string;
  refusal: RequestRefusal | null;
}>;

function refused(
  requirements: string,
  parameterId = "beta",
  instrumentId?: string,
): RequestRefusal {
  return makeRefusal(
    "invalid-parameter",
    { parameterIds: [parameterId] },
    {
      details: { requirements, ...(instrumentId ? { instrumentId } : {}) },
    },
  );
}

function sameValue(left: number | null, right: number): boolean {
  return (
    left !== null &&
    Math.abs(left - right) <= 8 * Number.EPSILON * Math.max(1, Math.abs(left), Math.abs(right))
  );
}

/**
 * Publishes a whole generation only after each existing owner accepts its own request. The
 * generation/action-index association lives here; an old owner's response cannot borrow a newer
 * group's identity. Consumers show `coherent` while enabled, never the live per-member snapshots.
 */
export function createExperimentGroup(
  definition: ExperimentGroupDefinition,
  initialMembers: readonly GroupMemberPort[],
) {
  function admitted(port: GroupMemberPort): boolean {
    const declared = definition.members.find((member) => member === port.definition);
    const accepted = port.getSnapshot().accepted;
    return (
      !!declared &&
      !!accepted &&
      accepted.instanceId === port.instanceId &&
      accepted.experimentId === declared.instrumentId
    );
  }
  if (
    initialMembers.length < 2 ||
    initialMembers.length > 8 ||
    new Set(initialMembers.map((port) => port.instanceId)).size !== initialMembers.length ||
    initialMembers.some((port) => !admitted(port))
  )
    throw new ExperimentGroupDefinitionError(
      "invalid-experiment-group",
      "A group needs two to eight distinct accepted owners bound to its declared members.",
    );
  const ports = new Map(initialMembers.map((member) => [member.instanceId, member]));
  const subscriptions = new Map<string, () => void>();
  const listeners = new Set<() => void>();
  let connected = false;
  let dispatching = false;
  type Ticket = {
    actionIndex: number | null;
    refusal: RequestRefusal | null;
    previousRunId: string | null;
  };
  type Flight = { generationId: number; valueSI: number; tickets: Map<string, Ticket> };
  let flight: Flight | null = null;

  const independentMembers = (): readonly GroupMemberState[] =>
    Object.freeze(
      [...ports.values()].map((port) =>
        Object.freeze({
          instanceId: port.instanceId,
          instrumentId: port.definition.instrumentId,
          label: port.definition.label,
          status: "independent" as const,
          accepted: port.getSnapshot().accepted,
          refusal: null,
        }),
      ),
    );
  const beforeLink = independentMembers();
  let state: ExperimentGroupState = Object.freeze({
    enabled: false,
    generationId: 0,
    phase: "independent",
    requestedValueSI: null,
    coherent: null,
    members: beforeLink,
    independentSnapshots: Object.freeze(
      beforeLink.flatMap((member) => (member.accepted ? [member.accepted] : [])),
    ),
    message:
      "These instruments have independent observer controls. Link them when you want one observer.",
    refusal: null,
  });
  const serverState = state;
  function emit(patch: Partial<ExperimentGroupState>) {
    state = Object.freeze({ ...state, ...patch });
    for (const listener of listeners) listener();
  }

  function refresh() {
    if (dispatching || !connected) return;
    if (!state.enabled) {
      const members = independentMembers();
      emit({
        members,
        independentSnapshots: Object.freeze(
          members.flatMap((member) => (member.accepted ? [member.accepted] : [])),
        ),
      });
      return;
    }
    const current = flight;
    if (!current) return;
    const accepted: CoherentGroupSnapshot["members"][number][] = [];
    const members = [...ports.values()].map((port): GroupMemberState => {
      const view = port.getSnapshot();
      const ticket = current.tickets.get(port.instanceId);
      let failure = ticket?.refusal ?? null;
      let status: GroupMemberState["status"] = "pending";
      if (ticket && ticket.actionIndex !== null) {
        if (view.requested && view.requested.actionIndex > ticket.actionIndex)
          failure = refused(
            "This instrument received a newer independent request. Apply the shared speed again or unlink.",
            port.definition.parameterId,
            port.definition.instrumentId,
          );
        else if (!view.pending && view.requested?.actionIndex === ticket.actionIndex) {
          if (
            view.status === "accepted" &&
            view.accepted?.final &&
            view.accepted.actionIndex === ticket.actionIndex &&
            view.accepted.instanceId === port.instanceId &&
            view.accepted.experimentId === port.definition.instrumentId &&
            view.accepted.runId === ticket.previousRunId &&
            sameValue(port.valueSI(view.accepted), current.valueSI)
          ) {
            status = "accepted";
            accepted.push(
              Object.freeze({
                instanceId: port.instanceId,
                instrumentId: port.definition.instrumentId,
                snapshot: view.accepted,
              }),
            );
          } else if (view.status === "accepted") {
            failure = refused(
              "The returned observer description does not preserve this run or match the shared speed.",
              port.definition.parameterId,
              port.definition.instrumentId,
            );
          } else {
            failure =
              view.refusal ??
              refused(
                "This instrument could not complete the shared observer change. The last complete comparison is kept.",
                port.definition.parameterId,
                port.definition.instrumentId,
              );
          }
        }
      }
      if (failure) status = "refused";
      return Object.freeze({
        instanceId: port.instanceId,
        instrumentId: port.definition.instrumentId,
        label: port.definition.label,
        status,
        accepted: view.accepted,
        refusal: failure,
      });
    });
    if (flight !== current) return;
    const failure = members.find((member) => member.refusal)?.refusal ?? null;
    if (!failure && accepted.length === ports.size && ports.size >= 2) {
      emit({
        phase: "accepted",
        members: Object.freeze(members),
        coherent: Object.freeze({
          generationId: current.generationId,
          valueSI: current.valueSI,
          members: Object.freeze(accepted),
        }),
        refusal: null,
        message:
          "All linked instruments now describe the same observer. The light and each experiment's run are unchanged.",
      });
      return;
    }
    emit({
      phase: failure ? "refused" : "pending",
      members: Object.freeze(members),
      refusal: failure,
      message: failure
        ? state.coherent
          ? "The shared change did not complete. The last complete comparison remains below."
          : "The shared change did not complete. The separate descriptions from before linking remain below."
        : `Waiting for ${ports.size - accepted.length} of ${ports.size} instruments. ${state.coherent ? "The last complete comparison remains below." : "The separate descriptions from before linking remain below."}`,
    });
  }

  function change(valueSI: number): GroupAction {
    if (!connected || !state.enabled || ports.size < 2)
      return {
        kind: "refused",
        refusal: refused(
          "Link at least two mounted instruments before changing their shared observer.",
        ),
      };
    const excluding = [...ports.values()].find(
      (port) => !insideGroupDomain(port.definition.domain, valueSI),
    );
    if (excluding) {
      flight = null; // No older response may publish as the result of the refused request.
      const failure = refused(
        `The observer speed is outside the admitted range for ${excluding.definition.label}. Keep a speed within the shared range.`,
        excluding.definition.parameterId,
        excluding.definition.instrumentId,
      );
      emit({
        generationId: state.generationId + 1,
        phase: "refused",
        requestedValueSI: Number.isFinite(valueSI) ? valueSI : null,
        members: Object.freeze(
          independentMembers().map((member) =>
            Object.freeze({ ...member, status: "refused" as const, refusal: failure }),
          ),
        ),
        refusal: failure,
        message: state.coherent
          ? "No member was changed. The last complete comparison is kept."
          : "No member was changed. The separate accepted descriptions are kept.",
      });
      return { kind: "refused", refusal: failure };
    }
    const current: Flight = {
      generationId: state.generationId + 1,
      valueSI,
      tickets: new Map(
        [...ports.values()].map((port) => [
          port.instanceId,
          {
            actionIndex: null,
            refusal: null,
            previousRunId: port.getSnapshot().accepted?.runId ?? null,
          },
        ]),
      ),
    };
    flight = current;
    dispatching = true;
    emit({
      enabled: true,
      generationId: current.generationId,
      phase: "pending",
      requestedValueSI: valueSI,
      members: Object.freeze(
        independentMembers().map((member) =>
          Object.freeze({ ...member, status: "pending" as const }),
        ),
      ),
      refusal: null,
      message: "Applying one observer speed to the linked instruments.",
    });
    try {
      for (const port of ports.values()) {
        if (flight !== current || !state.enabled || !connected) break;
        const ticket = current.tickets.get(port.instanceId);
        if (!ticket) continue;
        try {
          const result = port.request(valueSI, current.generationId);
          if (
            result.kind === "accepted" &&
            Number.isSafeInteger(result.actionIndex) &&
            result.actionIndex >= 0
          )
            ticket.actionIndex = result.actionIndex;
          else
            ticket.refusal =
              result.kind === "refused"
                ? result.refusal
                : refused(
                    "The instrument did not identify its observer request.",
                    port.definition.parameterId,
                    port.definition.instrumentId,
                  );
        } catch {
          ticket.refusal = refused(
            "The instrument could not apply this observer change. The last complete comparison is kept.",
            port.definition.parameterId,
            port.definition.instrumentId,
          );
        }
      }
    } finally {
      dispatching = false;
    }
    if (flight === current) refresh();
    return state.phase === "refused" && state.refusal
      ? { kind: "refused", refusal: state.refusal }
      : { kind: "accepted", generationId: current.generationId };
  }

  function unlink() {
    flight = null;
    const members = independentMembers();
    emit({
      enabled: false,
      phase: "independent",
      requestedValueSI: null,
      members,
      independentSnapshots: Object.freeze(
        members.flatMap((member) => (member.accepted ? [member.accepted] : [])),
      ),
      refusal: null,
      message:
        "The observers are unlinked. Each instrument keeps its current accepted speed and run.",
    });
  }

  return Object.freeze({
    definition,
    getSnapshot: () => state,
    getServerSnapshot: () => serverState,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    connect() {
      if (connected) return;
      connected = true;
      for (const port of ports.values())
        subscriptions.set(port.instanceId, port.subscribe(refresh));
      refresh();
    },
    disconnect() {
      connected = false;
      for (const unsubscribe of subscriptions.values()) unsubscribe();
      subscriptions.clear();
    },
    link(valueSI: number): GroupAction {
      if (!connected || ports.size < 2)
        return {
          kind: "refused",
          refusal: refused("At least two mounted instruments are needed for a shared observer."),
        };
      // A failed first link still labels the controls as linked and keeps each static example
      // separately labelled until the first complete generation exists.
      state = Object.freeze({ ...state, enabled: true });
      return change(valueSI);
    },
    change,
    unlink,
    /** Membership is explicit. An ordinary second instance is never discovered or linked. */
    attach(port: GroupMemberPort): GroupAction {
      if (!admitted(port) || ports.has(port.instanceId) || ports.size >= 8)
        return {
          kind: "refused",
          refusal: refused("Choose a declared member with a distinct instance identity."),
        };
      ports.set(port.instanceId, port);
      if (connected) subscriptions.set(port.instanceId, port.subscribe(refresh));
      if (state.enabled && state.requestedValueSI !== null) return change(state.requestedValueSI);
      refresh();
      return { kind: "accepted", generationId: state.generationId };
    },
    detach(instanceId: string) {
      subscriptions.get(instanceId)?.();
      subscriptions.delete(instanceId);
      ports.delete(instanceId);
      flight?.tickets.delete(instanceId);
      if (ports.size < 2) unlink();
      else refresh();
    },
  });
}
