import type { VerifiablePublication } from "../../workers/scheduler/verifiedChannel.ts";
import { type DigestFields, scientificDigest } from "../digest/scientificDigest.ts";
import { tapeStateOf } from "../permalink/sessionTape.ts";
import type { TapeV2 } from "../permalink/types.ts";
import { PINNED_ARTIFACT } from "../provenance/pinnedFrankenSim.ts";
import {
  BM06_DEFAULTS,
  BM06_FRANKENSIM_GRID_OWNER,
  BM06_MODEL,
  BM06_PARAMETER_CLASSES,
  type Bm06Parameters,
} from "./definition.ts";

/** All settings and the actual accepted output fields belong to this deterministic checkpoint. */
export function validateBm06ScientificTape(
  tape: TapeV2,
  _states: readonly Readonly<Record<string, unknown>>[],
  sourceDigest: string,
): string | null {
  if (tape.modelIdentity.artifactDigest !== sourceDigest.replace(/^source:/, "host:"))
    return "This probability checkpoint belongs to another evaluator source.";
  const keys = Object.keys(BM06_DEFAULTS);
  if (
    Object.keys(tape.initialConditions).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(tape.initialConditions, key))
  ) return "This probability checkpoint needs its complete original calculation settings.";
  if (
    tape.seed !== "0" ||
    tape.streamVersion !== "deterministic" ||
    tape.allocationId !== "deterministic" ||
    tape.acceptedCheckpoint.scientificState !== undefined
  ) return "The probability model has no latent random stream; its identity must remain deterministic.";
  for (const event of tape.events) {
    const cls = BM06_PARAMETER_CLASSES[event.paramId as keyof Bm06Parameters];
    const command = cls === "measurement" ? "measurement-change" : "setup-change";
    if (!cls || event.commandClass !== command)
      return "A recorded probability control has the wrong scientific command class.";
  }
  if (!/^host:sha256:[a-f0-9]{64}$/.test(tape.acceptedCheckpoint.digest))
    return "This probability checkpoint needs a scientific SHA-256 digest of its accepted results.";
  return null;
}

/** Local run/revision counters are excluded; all scientific values, units and actual owners remain. */
export async function bm06CheckpointDigest(
  publication: VerifiablePublication,
  sourceDigest: string,
  actionIndex: number,
): Promise<
  Readonly<{ kind: "digest"; digest: string } | { kind: "not-restored"; notice: string }>
> {
  const parameters = tapeStateOf(publication.parameters);
  if (!publication.final || publication.experimentId !== "bm-06" || !parameters)
    return { kind: "not-restored", notice: "The probability owner has no complete accepted calculation." };
  const outputs = [...publication.outputs]
    .sort((left, right) =>
      left.quantityId < right.quantityId ? -1 : left.quantityId > right.quantityId ? 1 : 0,
    )
    .map(
      (output) =>
        ({
          ...Object.fromEntries(Object.entries(output).filter(([, value]) => value !== undefined)),
          ...(output.status === "value" && output.value instanceof Float64Array
            ? { value: output.value.slice() }
            : {}),
        }) as DigestFields,
    );
  const usesPinnedGrid = publication.outputs.some(
    (output) => output.status === "value" && output.ownerId === BM06_FRANKENSIM_GRID_OWNER,
  );
  const { digest } = await scientificDigest({
    format: "bm06-scientific-checkpoint-v1",
    experimentId: "bm-06",
    modelId: BM06_MODEL.id,
    modelVersion: 1,
    constantSetId: BM06_MODEL.constantSetId,
    sourceDigest,
    engineArtifact: usesPinnedGrid ? PINNED_ARTIFACT : "host-reference",
    actionIndex,
    parameters,
    stepIndex: publication.stepIndex,
    simulationTime: publication.simulationTime,
    outputs,
  });
  return { kind: "digest", digest };
}

export async function verifyBm06ScientificCheckpoint(
  tape: TapeV2,
  publication: VerifiablePublication,
  sourceDigest: string,
): Promise<string | null> {
  const calculated = await bm06CheckpointDigest(
    publication,
    sourceDigest,
    tape.acceptedCheckpoint.acceptedActionIndex,
  );
  if (calculated.kind !== "digest") return calculated.notice;
  return calculated.digest === tape.acceptedCheckpoint.digest
    ? null
    : "The probability owner's complete results do not match the recorded checkpoint.";
}
