import type { AcceptedSnapshot, ExperimentView, RequestToken } from "../../experiments/store/instanceStore.ts";
import type { VerifiablePublication } from "./verifiedChannel.ts";

type Receipt = Readonly<{
  token: RequestToken;
  stepIndex: number;
  simulationTime: number;
  recordingCheckpoint?: unknown;
}>;

/**
 * Retain only a small owner receipt. Numeric buffers remain in the accepted store and are copied
 * only when requested; a transport candidate is never evidence that the store accepted it.
 */
export function createAcceptedPublicationReader(
  getSnapshot: () => ExperimentView,
  experimentId: string,
  outputIds: readonly string[],
) {
  let receipt: Receipt | null = null;
  function matches(accepted: AcceptedSnapshot, request: RequestToken): boolean {
    return (
      accepted.experimentId === experimentId &&
      accepted.experimentId === request.experimentId &&
      accepted.instanceId === request.instanceId &&
      accepted.runId === request.runId &&
      accepted.parentRunId === request.parentRunId &&
      accepted.actionIndex === request.actionIndex &&
      Object.entries(request.revisions).every(
        ([key, value]) => accepted.revisions[key as keyof typeof request.revisions] === value,
      ) &&
      Object.keys(accepted.parameters).length === Object.keys(request.parameters).length &&
      Object.entries(request.parameters).every(
        ([key, value]) => Object.is(accepted.parameters[key], value),
      )
    );
  }
  return Object.freeze({
    remember(token: RequestToken, publication: Pick<VerifiablePublication, "stepIndex" | "simulationTime" | "recordingCheckpoint">) {
      receipt = {
        token,
        stepIndex: publication.stepIndex,
        simulationTime: publication.simulationTime,
        ...(publication.recordingCheckpoint === undefined
          ? {}
          : { recordingCheckpoint: structuredClone(publication.recordingCheckpoint) }),
      };
    },
    read(): VerifiablePublication | null {
      const view = getSnapshot();
      const accepted = view.accepted;
      const current = receipt;
      if (
        !current ||
        !accepted?.final ||
        view.pending ||
        view.status !== "accepted" ||
        view.requested !== current.token ||
        !matches(accepted, current.token) ||
        accepted.stepIndex !== current.stepIndex ||
        accepted.simulationTime !== current.simulationTime
      ) return null;
      const quantities = new Set(accepted.outputs.map((output) => output.quantityId));
      if (outputIds.some((id) => !quantities.has(id))) return null;
      return {
        ...current.token,
        parameters: { ...accepted.parameters },
        revisions: { ...accepted.revisions },
        stepIndex: accepted.stepIndex,
        simulationTime: accepted.simulationTime,
        final: true,
        outputs: accepted.outputs.map((output) =>
          output.status === "value"
            ? structuredClone({
                ...output,
                value: typeof output.value === "number" ? output.value : output.value.copy(),
              })
            : structuredClone(output),
        ),
        ...(current.recordingCheckpoint === undefined
          ? {}
          : { recordingCheckpoint: structuredClone(current.recordingCheckpoint) }),
      };
    },
  });
}
