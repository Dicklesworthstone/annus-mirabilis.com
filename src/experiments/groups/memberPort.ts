import { convertValue } from "../../units/adapters.ts";
import { makeRefusal, type RequestRefusal } from "../results/refusals.ts";
import type {
  AcceptedSnapshot,
  ExperimentView,
  ParameterClass,
  Parameters,
  RequestToken,
} from "../store/instanceStore.ts";
import {
  type ExperimentGroupDefinition,
  ExperimentGroupDefinitionError,
  type GroupMemberDefinition,
} from "./schema.ts";

export type GroupMemberRequest =
  | Readonly<{ kind: "accepted"; actionIndex: number }>
  | Readonly<{ kind: "refused"; refusal: RequestRefusal }>;

export type GroupMemberPort = Readonly<{
  instanceId: string;
  definition: GroupMemberDefinition;
  getSnapshot(): ExperimentView;
  subscribe(listener: () => void): () => void;
  request(valueSI: number, generationId: number): GroupMemberRequest;
  valueSI(snapshot: AcceptedSnapshot): number | null;
}>;

type Session = Readonly<{
  getSnapshot(): ExperimentView;
  subscribe(listener: () => void): () => void;
  acceptedParameters(): Parameters;
  apply(
    input: unknown,
  ):
    | Readonly<{ kind: "accepted"; data: RequestToken }>
    | Readonly<{ kind: "refused"; refusal: RequestRefusal }>;
}>;

/** Adapts the existing owner; no second store, numerical routine, or shared work queue is created. */
export function createGroupMemberPort(
  group: ExperimentGroupDefinition,
  instrumentId: string,
  session: Session,
  parameterClasses: Readonly<Record<string, ParameterClass>>,
): GroupMemberPort {
  const definition = group.members.find((member) => member.instrumentId === instrumentId);
  const initial = session.getSnapshot().accepted;
  if (
    !definition ||
    !initial ||
    initial.experimentId !== instrumentId ||
    parameterClasses[definition.parameterId] !== "observer"
  )
    throw new ExperimentGroupDefinitionError(
      "invalid-experiment-group",
      `${instrumentId} must supply its own accepted instance and observer-class input.`,
    );
  return Object.freeze({
    instanceId: initial.instanceId,
    definition,
    getSnapshot: session.getSnapshot,
    subscribe: session.subscribe,
    request(valueSI: number, _generationId: number): GroupMemberRequest {
      if (!Number.isFinite(valueSI))
        return {
          kind: "refused",
          refusal: makeRefusal(
            "invalid-parameter",
            { parameterIds: [definition.parameterId] },
            {
              details: { requirements: "Enter a finite observer speed." },
            },
          ),
        };
      const value = convertValue(valueSI, group.canonicalUnit, definition.displayUnit);
      const applied = session.apply({
        ...session.acceptedParameters(),
        [definition.parameterId]: value,
      });
      return applied.kind === "accepted"
        ? { kind: "accepted", actionIndex: applied.data.actionIndex }
        : applied;
    },
    valueSI(snapshot: AcceptedSnapshot) {
      const value = snapshot.parameters[definition.parameterId];
      if (typeof value !== "number" || !Number.isFinite(value)) return null;
      return convertValue(value, definition.displayUnit, group.canonicalUnit);
    },
  });
}
