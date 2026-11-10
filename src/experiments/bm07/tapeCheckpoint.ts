import {
  INFERENCE_CONSTANTS,
  INFERENCE_GRID_DT,
  INFERENCE_GRID_STEPS,
} from "../../physics/reference/inference/synthetic.ts";
import { HOST_NORMAL_VERSION } from "../../physics/reference/philox.ts";
import type { VerifiablePublication } from "../../workers/scheduler/verifiedChannel.ts";
import { type DigestFields, scientificDigest } from "../digest/scientificDigest.ts";
import { parseU64 } from "../identity/u64.ts";
import { tapeStateOf } from "../permalink/sessionTape.ts";
import type { TapeScientificCheckpoint, TapeV2 } from "../permalink/types.ts";
import { streamAllocationRegistry } from "../streams/allocation.ts";
import { BM07_CLASSES, BM07_DEFAULTS, type Bm07Parameters } from "./definition.ts";
import type { Bm07RecordingCheckpoint } from "./recordingCheckpoint.ts";

const LATENT = streamAllocationRegistry.getAllocation("bm-07.synthetic-latent.v1");
const PARAMETER = streamAllocationRegistry.getAllocation("bm-07.generator-parameter.v1");

/**
 * The fixed recording uses a different counter-addressed tile at each substep, with two normal
 * draws (four uniforms) per tile. Keep every tile, plus the hidden parameter's single draw; this
 * is not one continuous stream. The permalink wire codec compresses equal contiguous positions.
 */
export function bm07ScientificState(p: Bm07Parameters): TapeScientificCheckpoint {
  return {
    checkpointVersion: 1,
    streamSemanticsVersion: LATENT.streamVersion,
    stepIndex: INFERENCE_GRID_STEPS,
    simulatedTime: INFERENCE_GRID_STEPS * INFERENCE_GRID_DT,
    seed: parseU64(p.seed),
    streamPositions: [
      {
        allocationId: PARAMETER.allocationId,
        streamKernelId: `0x${PARAMETER.streamKernelId.toString(16)}`,
        tile: parseU64("0"),
        index: parseU64("1"),
      },
      ...Array.from({ length: INFERENCE_GRID_STEPS }, (_, step) => ({
        allocationId: LATENT.allocationId,
        streamKernelId: `0x${LATENT.streamKernelId.toString(16)}`,
        tile: parseU64(String(step)),
        index: parseU64("4"),
      })),
    ],
  };
}

export function validateBm07ScientificTape(
  tape: TapeV2,
  states: readonly Readonly<Record<string, unknown>>[],
  sourceDigest: string,
): string | null {
  if (tape.modelIdentity.artifactDigest !== sourceDigest.replace(/^source:/, "host:"))
    return "This inference checkpoint was recorded with another evaluator source. Calculate a new run to use this edition.";
  const keys = Object.keys(BM07_DEFAULTS);
  if (
    Object.keys(tape.initialConditions).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(tape.initialConditions, key))
  )
    return "This inference checkpoint needs its complete original generator, observation and estimator settings.";
  if (
    tape.replayGrid?.baseSpacing !== INFERENCE_GRID_DT ||
    tape.replayGrid.horizon !== INFERENCE_GRID_STEPS * INFERENCE_GRID_DT
  )
    return "The checkpoint's fixed recording grid differs from this inference model.";
  for (const state of states) {
    if (state.seed !== tape.seed)
      return "The checkpoint's full seed differs from its recorded settings.";
    if (
      state.constantSetId !== tape.constantSetId ||
      state.constantSetId !== INFERENCE_CONSTANTS.id
    )
      return "This synthetic inference checkpoint requires its original instructional gas constant; it is not a historical measurement.";
    if (state.observationSet !== "synthetic" || state.coverageTrials !== 0)
      return "This checkpoint records one synthetic trajectory without hypothetical coverage trials. Calculate a new run for other experiments.";
  }
  for (const event of tape.events) {
    const cls = BM07_CLASSES[event.paramId as keyof Bm07Parameters];
    const command =
      cls === "input"
        ? "setup-change"
        : cls === "measurement"
          ? "measurement-change"
          : "estimator-change";
    if (!cls || event.commandClass !== command)
      return "A recorded inference control has the wrong scientific command class.";
  }
  const last = states.at(-1) as Bm07Parameters | undefined;
  const recorded = tape.acceptedCheckpoint.scientificState;
  if (!last || !recorded)
    return "This inference checkpoint is missing its recording and random-stream positions.";
  const expected = bm07ScientificState(last);
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
    return "The checkpoint's recording position or random-stream allocation does not match this complete synthetic trial.";
  if (!/^host:sha256:[a-f0-9]{64}$/.test(tape.acceptedCheckpoint.digest))
    return "This inference checkpoint needs a scientific SHA-256 digest of the accepted trial.";
  return null;
}

/**
 * Bind the complete latent path, selected observations, statistical intervals and declared
 * assumptions. Cache reuse, this request's draw cost and retained bytes describe execution,
 * not the science. The recording's logical draws and every counter position remain included.
 */
export async function bm07CheckpointDigest(
  publication: VerifiablePublication,
  sourceDigest: string,
  actionIndex: number,
): Promise<
  Readonly<{ kind: "digest"; digest: string } | { kind: "not-restored"; notice: string }>
> {
  const recording = publication.recordingCheckpoint as Bm07RecordingCheckpoint | undefined;
  if (!recording)
    return {
      kind: "not-restored",
      notice: "The inference worker did not supply a complete-trajectory checkpoint.",
    };
  if (
    recording.sourceDigest !== sourceDigest ||
    recording.ownerId !== "inference.bm07" ||
    recording.normalVersion !== HOST_NORMAL_VERSION
  )
    return {
      kind: "not-restored",
      notice:
        "The recording checkpoint belongs to another inference evaluator or normal transform.",
    };
  const p = publication.parameters as Bm07Parameters;
  const parameters = tapeStateOf(p);
  const position = bm07ScientificState(p);
  if (
    !parameters ||
    !publication.final ||
    publication.stepIndex !== position.stepIndex ||
    publication.simulationTime !== position.simulatedTime
  )
    return {
      kind: "not-restored",
      notice: "The worker has not completed the checkpoint's full inference recording.",
    };
  const outputs = publication.outputs
    .filter(
      (output) => !["reusedRecording", "requestDraws", "retainedBytes"].includes(output.quantityId),
    )
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
    format: "bm07-scientific-checkpoint-v1",
    experimentId: "bm-07",
    modelId: "inference-bm07-host",
    modelVersion: 1,
    sourceDigest,
    actionIndex,
    parameters,
    scientificState: position,
    recording,
    outputs,
  });
  return { kind: "digest", digest };
}

export async function verifyBm07ScientificCheckpoint(
  tape: TapeV2,
  publication: VerifiablePublication,
  sourceDigest: string,
): Promise<string | null> {
  const calculated = await bm07CheckpointDigest(
    publication,
    sourceDigest,
    tape.acceptedCheckpoint.acceptedActionIndex,
  );
  if (calculated.kind !== "digest") return calculated.notice;
  return calculated.digest === tape.acceptedCheckpoint.digest
    ? null
    : "The complete synthetic path and scientific results do not match this checkpoint. Host mathematical functions can differ between browsers; calculate a new run to use this browser. The previous accepted result has been kept.";
}
