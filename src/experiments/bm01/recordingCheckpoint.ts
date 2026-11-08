import type { TracerRecording } from "../../physics/reference/diffusion/tracers.ts";
import { scientificDigest } from "../digest/scientificDigest.ts";
import { PINNED_ARTIFACT } from "../provenance/pinnedFrankenSim.ts";
import { BM01_FRANKENSIM_RECORDER_OWNER } from "./definition.ts";

export type Bm01RecordingCheckpoint = Readonly<{
  checkpointVersion: 1;
  sourceDigest: string;
  ownerId: string;
  normalVersion: string;
  artifactDigest: string;
  allocationId: string;
  seed: string;
  tracers: number;
  steps: number;
  baseSpacing: number;
  diffusionCoefficient: number;
  draws: number;
  digest: string;
}>;

/** Computed once per recording, including every latent coordinate, not just plotted samples. */
export async function createBm01RecordingCheckpoint(
  recording: TracerRecording,
  ownerId: string,
  sourceDigest: string,
): Promise<Bm01RecordingCheckpoint> {
  const identity = {
    checkpointVersion: 1 as const,
    sourceDigest,
    ownerId,
    normalVersion: recording.normalVersion,
    artifactDigest:
      ownerId === BM01_FRANKENSIM_RECORDER_OWNER
        ? `sha256:${PINNED_ARTIFACT.wasmDigest}`
        : sourceDigest,
    allocationId: recording.allocationId,
    seed: recording.setup.seed,
    tracers: recording.setup.M,
    steps: recording.setup.steps,
    baseSpacing: recording.setup.h,
    diffusionCoefficient: recording.setup.D,
    draws: recording.draws,
  };
  const { digest } = await scientificDigest({
    ...identity,
    layout: "bm01-series-step-f64-le-v1",
    shape: [recording.setup.M * 3, recording.setup.steps + 1],
    coordinates: recording.values,
  });
  return Object.freeze({ ...identity, digest });
}
