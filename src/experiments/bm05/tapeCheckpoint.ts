import { WALK_KERNELS } from "../../physics/reference/diffusion/walkLaws.ts";
import { HOST_WALK_DRAW_OWNER } from "../../physics/reference/diffusion/walks.ts";
import type { VerifiablePublication } from "../../workers/scheduler/verifiedChannel.ts";
import { type DigestFields, scientificDigest } from "../digest/scientificDigest.ts";
import { parseU64 } from "../identity/u64.ts";
import type { TapeScientificCheckpoint, TapeV2 } from "../permalink/types.ts";
import { FRANKENSIM_NORMAL_VERSION, PINNED_ARTIFACT } from "../provenance/pinnedFrankenSim.ts";
import { BM05_ALLOCATION } from "../streams/allocation.ts";
import {
  BM05_CLASSES,
  BM05_DEFAULTS,
  BM05_FRANKENSIM_DRAW_OWNER,
  BM05_MODEL,
  type Bm05Parameters,
} from "./definition.ts";

/** Changing the observed step does not rewind the complete, already recorded walker streams. */
export function bm05ScientificState(p: Bm05Parameters): TapeScientificCheckpoint {
  return {
    checkpointVersion: 1,
    streamSemanticsVersion: BM05_ALLOCATION.streamVersion,
    stepIndex: p.runSteps,
    simulatedTime: p.runSteps * p.tau,
    seed: parseU64(p.seed),
    streamPositions: Array.from({ length: p.walkers }, (_, tile) => ({
      allocationId: BM05_ALLOCATION.allocationId,
      streamKernelId: `0x${BM05_ALLOCATION.streamKernelId.toString(16)}`,
      tile: parseU64(String(tile)),
      index: parseU64(String(p.runSteps * WALK_KERNELS[p.kernel].drawsPerStep)),
    })),
  };
}

/** A historical checkpoint supplies its full setup and exact Philox positions, without defaults. */
export function validateBm05ScientificTape(
  tape: TapeV2,
  states: readonly Readonly<Record<string, unknown>>[],
  sourceDigest: string,
): string | null {
  if (tape.modelIdentity.artifactDigest !== sourceDigest.replace(/^source:/, "host:"))
    return "This walk checkpoint was recorded with another evaluator source. Calculate a new run to use this edition.";
  const keys = Object.keys(BM05_DEFAULTS);
  if (
    Object.keys(tape.initialConditions).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(tape.initialConditions, key))
  )
    return "This walk checkpoint needs its complete original setup, including its seed and recording grid.";
  if (tape.constantSetId !== BM05_MODEL.constantSetId)
    return "This ideal walk model has no physical constant set.";
  for (const state of states) {
    if (state.seed !== tape.seed)
      return "The checkpoint's full seed differs from its recorded settings.";
    if (
      state.tau !== tape.replayGrid?.baseSpacing ||
      Number(state.runSteps) * Number(state.tau) !== tape.replayGrid?.horizon
    )
      return "The checkpoint's fixed recording grid differs from its recorded settings.";
  }
  for (const event of tape.events) {
    const cls = BM05_CLASSES[event.paramId as keyof Bm05Parameters];
    const command =
      cls === "input"
        ? "setup-change"
        : cls === "measurement"
          ? "measurement-change"
          : "estimator-change";
    if (!cls || event.commandClass !== command)
      return "A recorded walk control has the wrong scientific command class.";
  }
  const last = states.at(-1) as Bm05Parameters | undefined;
  const recorded = tape.acceptedCheckpoint.scientificState;
  if (!last || !recorded)
    return "This walk checkpoint is missing its scientific recording and stream positions.";
  const expected = bm05ScientificState(last);
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
    return "The checkpoint's recording position or random-stream allocation does not match this complete walk trial.";
  if (!/^host:sha256:[a-f0-9]{64}$/.test(tape.acceptedCheckpoint.digest))
    return "This walk checkpoint needs a scientific SHA-256 digest of the accepted trial.";
  return null;
}

const executionDiagnostics = new Set([
  "requestDraws",
  "replayedDraws",
  "reusedRecording",
  "retainedBytes",
]);

/** Bind every walker at the observed step, traces, distributions and scientific results to the run. */
export async function bm05CheckpointDigest(
  publication: VerifiablePublication,
  sourceDigest: string,
  actionIndex: number,
): Promise<
  Readonly<{ kind: "digest"; digest: string } | { kind: "not-restored"; notice: string }>
> {
  const p = publication.parameters as Bm05Parameters;
  const position = bm05ScientificState(p);
  if (
    !publication.final ||
    publication.stepIndex !== position.stepIndex ||
    publication.simulationTime !== position.simulatedTime
  )
    return {
      kind: "not-restored",
      notice: "The worker has not completed the checkpoint's full recording grid.",
    };
  const drawOwner = p.kernel === "gaussian" ? BM05_FRANKENSIM_DRAW_OWNER : HOST_WALK_DRAW_OWNER;
  if (
    ["walkPositions", "traceDisplacements", "recordingDraws"].some(
      (id) => publication.outputs.find((output) => output.quantityId === id)?.ownerId !== drawOwner,
    )
  )
    return {
      kind: "not-restored",
      notice:
        p.kernel === "gaussian"
          ? "This recorded Gaussian trial requires the pinned FrankenSim normal engine. The host fallback uses a different normal transform; calculate a new run to use it."
          : "The worker's walk results were produced by another random-step engine.",
    };
  const outputs = publication.outputs
    .filter((output) => !executionDiagnostics.has(output.quantityId))
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
    format: "bm05-scientific-checkpoint-v1",
    experimentId: "bm-05",
    modelId: BM05_MODEL.id,
    modelVersion: 1,
    sourceDigest,
    actionIndex,
    parameters: p,
    scientificState: position,
    drawEngine: {
      ownerId: drawOwner,
      ...(p.kernel === "gaussian"
        ? {
            normalVersion: FRANKENSIM_NORMAL_VERSION,
            artifactDigest: `sha256:${PINNED_ARTIFACT.wasmDigest}`,
          }
        : {}),
    },
    outputs,
  });
  return { kind: "digest", digest };
}

export async function verifyBm05ScientificCheckpoint(
  tape: TapeV2,
  publication: VerifiablePublication,
  sourceDigest: string,
): Promise<string | null> {
  const calculated = await bm05CheckpointDigest(
    publication,
    sourceDigest,
    tape.acceptedCheckpoint.acceptedActionIndex,
  );
  if (calculated.kind !== "digest") return calculated.notice;
  return calculated.digest === tape.acceptedCheckpoint.digest
    ? null
    : "The worker's walks and scientific results do not match the recorded checkpoint exactly. This can reflect a different calculation engine. The previous accepted result has been kept; calculate a new run to use this engine.";
}
