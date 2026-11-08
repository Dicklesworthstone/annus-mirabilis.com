import type { VerifiablePublication } from "../../workers/scheduler/verifiedChannel.ts";
import { type DigestFields, scientificDigest } from "../digest/scientificDigest.ts";
import { parseU64 } from "../identity/u64.ts";
import type { TapeScientificCheckpoint, TapeV2 } from "../permalink/types.ts";
import { FRANKENSIM_NORMAL_VERSION, PINNED_ARTIFACT } from "../provenance/pinnedFrankenSim.ts";
import { BM01_ALLOCATION } from "../streams/allocation.ts";
import {
  BM01_CLASSES,
  BM01_DEFAULTS,
  BM01_FRANKENSIM_RECORDER_OWNER,
  type Bm01Parameters,
} from "./definition.ts";
import type { Bm01RecordingCheckpoint } from "./recordingCheckpoint.ts";

/** The owner records the whole fixed grid before any observation interval is selected. */
export function bm01ScientificState(p: Bm01Parameters): TapeScientificCheckpoint {
  const steps = Math.round(p.H / p.h);
  return {
    checkpointVersion: 1,
    streamSemanticsVersion: BM01_ALLOCATION.streamVersion,
    stepIndex: steps,
    simulatedTime: p.H,
    seed: parseU64(p.seed),
    streamPositions: Array.from({ length: p.M * BM01_ALLOCATION.axes }, (_, tile) => ({
      allocationId: BM01_ALLOCATION.allocationId,
      streamKernelId: `0x${BM01_ALLOCATION.streamKernelId.toString(16)}`,
      tile: parseU64(String(tile)),
      index: parseU64(String(steps * BM01_ALLOCATION.drawsPerStep)),
    })),
  };
}

/** No setup default, rounded seed, or implied stream position can repair a historical record. */
export function validateBm01ScientificTape(
  tape: TapeV2,
  states: readonly Readonly<Record<string, unknown>>[],
  sourceDigest: string,
): string | null {
  if (tape.modelIdentity.artifactDigest !== sourceDigest.replace(/^source:/, "host:"))
    return "This Brownian checkpoint was recorded with another evaluator source. Calculate a new run to use this edition.";
  const keys = Object.keys(BM01_DEFAULTS);
  if (
    Object.keys(tape.initialConditions).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(tape.initialConditions, key))
  )
    return "This Brownian checkpoint needs its complete original setup, including its constants, seed and recording grid.";
  for (const state of states) {
    if (state.seed !== tape.seed)
      return "The checkpoint's full seed differs from its recorded settings.";
    if (state.constantSetId !== tape.constantSetId)
      return "The checkpoint's constant set differs from its recorded settings.";
    if (state.h !== tape.replayGrid?.baseSpacing || state.H !== tape.replayGrid?.horizon)
      return "The checkpoint's fixed recording grid differs from its recorded settings.";
  }
  for (const event of tape.events) {
    const cls = BM01_CLASSES[event.paramId as keyof Bm01Parameters];
    const command =
      cls === "input"
        ? "setup-change"
        : cls === "measurement"
          ? "measurement-change"
          : "estimator-change";
    if (!cls || event.commandClass !== command)
      return "A recorded Brownian control has the wrong scientific command class.";
  }
  const last = states.at(-1) as Bm01Parameters | undefined;
  const recorded = tape.acceptedCheckpoint.scientificState;
  if (!last || !recorded)
    return "This Brownian checkpoint is missing its scientific recording and stream positions.";
  const expected = bm01ScientificState(last);
  if (
    recorded.checkpointVersion !== expected.checkpointVersion ||
    recorded.streamSemanticsVersion !== expected.streamSemanticsVersion ||
    recorded.seed !== expected.seed ||
    recorded.stepIndex !== expected.stepIndex ||
    recorded.simulatedTime !== expected.simulatedTime ||
    recorded.streamPositions.length !== expected.streamPositions.length ||
    recorded.streamPositions.some((position, i) => {
      const actual = expected.streamPositions[i];
      return (
        !actual ||
        position.allocationId !== actual.allocationId ||
        position.streamKernelId !== actual.streamKernelId ||
        position.tile !== actual.tile ||
        position.index !== actual.index
      );
    })
  )
    return "The checkpoint's recording position or random-stream allocation does not match this complete Brownian trial.";
  if (!/^host:sha256:[a-f0-9]{64}$/.test(tape.acceptedCheckpoint.digest))
    return "This Brownian checkpoint needs a scientific SHA-256 digest of the accepted trial.";
  return null;
}

/**
 * Fingerprint the actual full trajectory checksum and every accepted scientific output. The cache
 * reuse flag and local publication counters describe execution, not the experiment, and are
 * deliberately excluded. The authored action index remains bound to the recorded stop.
 */
export async function bm01CheckpointDigest(
  publication: VerifiablePublication,
  sourceDigest: string,
  actionIndex: number,
): Promise<
  Readonly<{ kind: "digest"; digest: string } | { kind: "not-restored"; notice: string }>
> {
  const recording = publication.recordingCheckpoint as Bm01RecordingCheckpoint | undefined;
  if (!recording)
    return {
      kind: "not-restored",
      notice: "The Brownian worker did not supply a verified complete-trajectory checkpoint.",
    };
  if (
    recording.ownerId !== BM01_FRANKENSIM_RECORDER_OWNER ||
    recording.normalVersion !== FRANKENSIM_NORMAL_VERSION ||
    recording.artifactDigest !== `sha256:${PINNED_ARTIFACT.wasmDigest}`
  )
    return {
      kind: "not-restored",
      notice:
        "This recorded trial requires the pinned FrankenSim Brownian engine. The host fallback uses a different normal transform; calculate a new run to use it.",
    };
  if (recording.sourceDigest !== sourceDigest)
    return {
      kind: "not-restored",
      notice: "The recording checkpoint belongs to another evaluator source.",
    };
  const p = publication.parameters as Bm01Parameters;
  const position = bm01ScientificState(p);
  if (
    !publication.final ||
    publication.stepIndex !== position.stepIndex ||
    publication.simulationTime !== position.simulatedTime
  )
    return {
      kind: "not-restored",
      notice: "The worker has not completed the checkpoint's full recording grid.",
    };
  const outputs = publication.outputs
    .filter((output) => output.quantityId !== "reusedRecording")
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
  const { digest } = await scientificDigest({
    format: "bm01-scientific-checkpoint-v1",
    experimentId: "bm-01",
    modelId: "brownian-motion-reference",
    modelVersion: 1,
    sourceDigest,
    actionIndex,
    parameters: p,
    scientificState: position,
    recording,
    outputs,
  });
  return { kind: "digest", digest };
}

export async function verifyBm01ScientificCheckpoint(
  tape: TapeV2,
  publication: VerifiablePublication,
  sourceDigest: string,
): Promise<string | null> {
  const calculated = await bm01CheckpointDigest(
    publication,
    sourceDigest,
    tape.acceptedCheckpoint.acceptedActionIndex,
  );
  if (calculated.kind !== "digest") return calculated.notice;
  return calculated.digest === tape.acceptedCheckpoint.digest
    ? null
    : "The worker's full trajectory and accepted scientific results do not match the recorded checkpoint. The previous accepted result has been kept.";
}
