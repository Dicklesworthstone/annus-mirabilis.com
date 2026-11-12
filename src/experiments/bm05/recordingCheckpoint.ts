import {
  WALK_TRAJECTORY_LAYOUT,
  type WalkRecording,
} from "../../physics/reference/diffusion/walks.ts";
import { scientificDigest } from "../digest/scientificDigest.ts";
import { PINNED_ARTIFACT } from "../provenance/pinnedFrankenSim.ts";
import { BM05_ALLOCATION } from "../streams/allocation.ts";
import { BM05_FRANKENSIM_DRAW_OWNER, BM05_MODEL } from "./definition.ts";

export type Bm05RecordingCheckpoint = Readonly<{
  checkpointVersion: 1;
  sourceDigest: string;
  modelId: string;
  ownerId: string;
  normalVersion: string;
  artifactDigest: string;
  allocationId: string;
  streamKernelId: number;
  streamVersion: number;
  seed: string;
  kernel: WalkRecording["setup"]["kernel"];
  walkers: number;
  runSteps: number;
  stepRms: number;
  tau: number;
  draws: number;
  coordinateCount: number;
  trajectoryLayout: typeof WALK_TRAJECTORY_LAYOUT;
  trajectoryDigest: string;
  digest: string;
}>;

/**
 * The owner's streaming receipt covers every position, including unplotted walkers and steps.
 * Bind it to the setup and actual draw engine; observation and estimator choices do not name
 * a new recording. No selected plot, checkpoint cache, or runtime counter substitutes for it.
 */
export async function createBm05RecordingCheckpoint(
  recording: WalkRecording,
  sourceDigest: string,
): Promise<Bm05RecordingCheckpoint> {
  const identity = {
    checkpointVersion: 1 as const,
    sourceDigest,
    modelId: BM05_MODEL.id,
    ownerId: recording.drawOwner,
    normalVersion: recording.normalVersion,
    artifactDigest:
      recording.drawOwner === BM05_FRANKENSIM_DRAW_OWNER
        ? `sha256:${PINNED_ARTIFACT.wasmDigest}`
        : sourceDigest,
    allocationId: recording.allocationId,
    streamKernelId: BM05_ALLOCATION.streamKernelId,
    streamVersion: BM05_ALLOCATION.streamVersion,
    ...recording.setup,
    draws: recording.draws,
    coordinateCount: recording.setup.walkers * (recording.setup.runSteps + 1),
    trajectoryLayout: WALK_TRAJECTORY_LAYOUT,
    trajectoryDigest: recording.trajectoryDigest,
  };
  const { digest } = await scientificDigest(identity);
  return Object.freeze({ ...identity, digest });
}
