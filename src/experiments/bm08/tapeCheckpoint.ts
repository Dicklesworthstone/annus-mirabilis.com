import { CAMERA_GRID_DT, CAMERA_GRID_STEPS } from "../../physics/reference/inference/camera.ts";
import type { VerifiablePublication } from "../../workers/scheduler/verifiedChannel.ts";
import { type DigestFields, scientificDigest } from "../digest/scientificDigest.ts";
import { parseU64 } from "../identity/u64.ts";
import type { TapeScientificCheckpoint, TapeV2 } from "../permalink/types.ts";
import { streamAllocationRegistry } from "../streams/allocation.ts";
import { BM08_CLASSES, BM08_DEFAULTS, type Bm08Parameters } from "./definition.ts";
import type { Bm08RecordingCheckpoint } from "./recordingCheckpoint.ts";

const latent = streamAllocationRegistry.getAllocation("bm-08.latent.v1");
const localization = streamAllocationRegistry.getAllocation("bm-08.localization.v1");
const stationary = streamAllocationRegistry.getAllocation("bm-08.stationary-feature.v1");

/**
 * Counter positions, not counts of UI events. Localization visits timestamp-indexed counters;
 * its position is immediately after the last sampled timestamp, including the intervening gaps.
 * The complete settings bind the independent noise and stationary-click seeds as well.
 */
export function bm08ScientificState(p: Bm08Parameters): TapeScientificCheckpoint {
  const position = (allocation: typeof latent, tile: number, index: number) => ({
    allocationId: allocation.allocationId,
    streamKernelId: `0x${allocation.streamKernelId.toString(16)}`,
    tile: parseU64(String(tile)),
    index: parseU64(String(index)),
  });
  return {
    checkpointVersion: 1,
    streamSemanticsVersion: latent.streamVersion,
    stepIndex: CAMERA_GRID_STEPS,
    simulatedTime: CAMERA_GRID_STEPS * CAMERA_GRID_DT,
    seed: parseU64(p.seed),
    streamPositions: [
      position(latent, 0, CAMERA_GRID_STEPS * 4),
      position(latent, 1, CAMERA_GRID_STEPS * 4),
      position(localization, 0, (p.M * (p.dt / CAMERA_GRID_DT) + 1) * 4),
      ...Array.from({ length: p.clicks }, (_, tile) => position(stationary, tile, 4)),
    ],
  };
}

export function validateBm08ScientificTape(
  tape: TapeV2,
  states: readonly Readonly<Record<string, unknown>>[],
  sourceDigest: string,
): string | null {
  if (tape.modelIdentity.artifactDigest !== sourceDigest.replace(/^source:/, "host:"))
    return "This camera checkpoint belongs to another evaluator source. Calculate a new run to use this edition.";
  const keys = Object.keys(BM08_DEFAULTS);
  if (
    Object.keys(tape.initialConditions).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(tape.initialConditions, key))
  )
    return "The camera checkpoint needs its complete original settings, including all three seeds and its noise procedure.";
  if (
    tape.replayGrid?.baseSpacing !== CAMERA_GRID_DT ||
    tape.replayGrid.horizon !== CAMERA_GRID_STEPS * CAMERA_GRID_DT
  )
    return "The camera checkpoint does not identify this fixed recording grid.";
  for (const state of states) {
    if (state.seed !== tape.seed)
      return "The camera checkpoint's exact physical seed differs from its recorded settings.";
    if (state.coverageTrials !== 0)
      return "Recorded camera checkpoints contain one trial. Run hypothetical coverage experiments separately.";
  }
  for (const event of tape.events) {
    const cls = BM08_CLASSES[event.paramId as keyof Bm08Parameters];
    const command =
      cls === "input"
        ? "setup-change"
        : cls === "measurement"
          ? "measurement-change"
          : "estimator-change";
    if (!cls || event.commandClass !== command)
      return "A recorded camera change has the wrong scientific command class.";
  }
  const last = states.at(-1) as Bm08Parameters | undefined;
  const recorded = tape.acceptedCheckpoint.scientificState;
  if (!last || !recorded)
    return "The camera checkpoint is missing its scientific recording and random-stream positions.";
  const expected = bm08ScientificState(last);
  if (
    recorded.checkpointVersion !== expected.checkpointVersion ||
    recorded.streamSemanticsVersion !== expected.streamSemanticsVersion ||
    recorded.seed !== expected.seed ||
    recorded.stepIndex !== expected.stepIndex ||
    recorded.simulatedTime !== expected.simulatedTime ||
    recorded.streamPositions.length !== expected.streamPositions.length ||
    recorded.streamPositions.some((entry, index) => {
      const actual = expected.streamPositions[index];
      return (
        !actual ||
        entry.allocationId !== actual.allocationId ||
        entry.streamKernelId !== actual.streamKernelId ||
        entry.tile !== actual.tile ||
        entry.index !== actual.index
      );
    })
  )
    return "The camera checkpoint's latent, localization or stationary-click stream positions do not match the recorded experiment.";
  if (!/^host:sha256:[a-f0-9]{64}$/.test(tape.acceptedCheckpoint.digest))
    return "The camera checkpoint needs a scientific SHA-256 digest, not a settings checksum.";
  return null;
}

/** Reuse counters describe execution; all physical observations and inference outputs are hashed. */
const cacheOutputs = new Set([
  "requestDraws",
  "measurementDraws",
  "reusedRecording",
  "reusedObservation",
  "retainedBytes",
]);

export async function bm08CheckpointDigest(
  publication: VerifiablePublication,
  sourceDigest: string,
  actionIndex: number,
): Promise<
  Readonly<{ kind: "digest"; digest: string } | { kind: "not-restored"; notice: string }>
> {
  const p = publication.parameters as Bm08Parameters;
  const recording = publication.recordingCheckpoint as Bm08RecordingCheckpoint | undefined;
  if (
    recording?.checkpointVersion !== 1 ||
    recording.sourceDigest !== sourceDigest ||
    recording.ownerId !== "inference.bm08" ||
    recording.seed !== p.seed ||
    recording.diffusion !== p.D ||
    recording.flowDrift !== p.flowDrift ||
    recording.steps !== CAMERA_GRID_STEPS ||
    recording.baseSpacing !== CAMERA_GRID_DT ||
    recording.draws !== CAMERA_GRID_STEPS * 8 ||
    !/^host:sha256:[a-f0-9]{64}$/.test(recording.digest)
  )
    return {
      kind: "not-restored",
      notice:
        "The camera worker did not supply this trial's complete latent-path and exposure-integral checkpoint.",
    };
  const position = bm08ScientificState(p);
  if (
    !publication.final ||
    publication.stepIndex !== position.stepIndex ||
    publication.simulationTime !== position.simulatedTime
  )
    return {
      kind: "not-restored",
      notice: "The camera worker has not finished the recorded trial.",
    };
  const outputs = publication.outputs
    .filter((output) => !cacheOutputs.has(output.quantityId))
    .sort((a, b) => (a.quantityId < b.quantityId ? -1 : a.quantityId > b.quantityId ? 1 : 0))
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
    format: "bm08-scientific-checkpoint-v1",
    experimentId: "bm-08",
    modelId: "inference-bm08-host",
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

export async function verifyBm08ScientificCheckpoint(
  tape: TapeV2,
  publication: VerifiablePublication,
  sourceDigest: string,
): Promise<string | null> {
  const actual = await bm08CheckpointDigest(
    publication,
    sourceDigest,
    tape.acceptedCheckpoint.acceptedActionIndex,
  );
  if (actual.kind !== "digest") return actual.notice;
  return actual.digest === tape.acceptedCheckpoint.digest
    ? null
    : "The camera's complete latent path, observations or estimates do not match the checkpoint exactly. This can reflect a different calculation engine. The previous accepted result has been kept; calculate a new run to use this engine.";
}
