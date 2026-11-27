import type { PublishedResult } from "../store/instanceStore.ts";
import type { ExpectedDisplayValue } from "../tapes/schema.ts";
import { type LabTapeBinding, settingsFromTape } from "./sessionTape.ts";
import { sameWalkthroughSettings } from "./walkthroughActions.ts";

type OwnerBinding = Pick<LabTapeBinding, "environment" | "defaults" | "constantSetIdForSettings">;
type PublicationIdentity = Readonly<{
  instanceId?: string | undefined;
  runId?: string | undefined;
  actionIndex?: number | undefined;
}>;
export type CheckpointReadoutView = Readonly<{
  status?: string | undefined;
  pending?: boolean | undefined;
  requested?: PublicationIdentity | null | undefined;
  accepted: (PublicationIdentity & Readonly<{
    experimentId?: string | undefined;
    final?: boolean | undefined;
    parameters?: object | undefined;
    outputs?: readonly PublishedResult[] | undefined;
  }>) | null;
}>;

export type CheckpointReadoutOwner = Readonly<{
  binding: OwnerBinding;
  session: Readonly<{
    getSnapshot(): CheckpointReadoutView;
    subscribe?(listener: () => void): () => void;
  }>;
}>;

export type AcceptedReadings = Readonly<{
  runId: string;
  constantSetId: string;
  outputs: readonly PublishedResult[];
}>;

/** Read only the owner's current final publication. Inspecting a stop never evaluates the model. */
export function currentCheckpointReadings(
  view: CheckpointReadoutView | null,
  binding: OwnerBinding,
  experimentId: string,
  settings: Readonly<Record<string, number | string>>,
): AcceptedReadings | null {
  const accepted = view?.accepted;
  const request = view?.requested;
  if (!accepted?.final || !request || view?.pending || view?.status !== "accepted") return null;
  if (
    binding.environment.experimentId !== experimentId ||
    accepted.experimentId !== experimentId ||
    !accepted.instanceId ||
    accepted.instanceId !== request.instanceId ||
    !accepted.runId ||
    accepted.runId !== request.runId ||
    accepted.actionIndex === undefined ||
    accepted.actionIndex !== request.actionIndex ||
    !accepted.parameters ||
    !accepted.outputs
  ) {
    return null;
  }
  const recorded = { ...binding.defaults, ...settingsFromTape(settings, binding.defaults) };
  if (!sameWalkthroughSettings(recorded, accepted.parameters)) return null;
  return {
    runId: accepted.runId,
    constantSetId:
      binding.constantSetIdForSettings?.(accepted.parameters as Readonly<Record<string, unknown>>) ??
      binding.environment.constantSetId,
    outputs: accepted.outputs,
  };
}

export type ReadingComparison =
  | Readonly<{ kind: "value"; value: number }>
  | Readonly<{ kind: "unavailable"; reason: string }>;

export function compareRecordedReading(
  recorded: ExpectedDisplayValue,
  accepted: AcceptedReadings,
): ReadingComparison {
  if (recorded.constantSetId !== accepted.constantSetId)
    return { kind: "unavailable", reason: "This run used a different set of constants." };
  const id = recorded.outputId ?? recorded.label;
  // A canonical quantity can occur in more than one field. Only a unique exact output is usable.
  const matches = accepted.outputs.filter((output) => output.quantityId === id);
  const output = matches[0];
  if (!output || matches.length !== 1)
    return { kind: "unavailable", reason: "No unique published output for this reading." };
  if (recorded.unit !== output.unit)
    return {
      kind: "unavailable",
      reason: "The laboratory published this reading in different units.",
    };
  if (output.status !== "value")
    return {
      kind: "unavailable",
      reason: `The laboratory reports “${output.status.replaceAll("-", " ")}”.`,
    };
  if (typeof output.value !== "number" || !Number.isFinite(output.value))
    return { kind: "unavailable", reason: "The laboratory did not publish a finite scalar here." };
  return { kind: "value", value: output.value };
}
