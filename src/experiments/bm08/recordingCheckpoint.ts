import type { CameraRecording } from "../../physics/reference/inference/camera.ts";
import { CAMERA_GRID_DT } from "../../physics/reference/inference/camera.ts";
import { scientificDigest } from "../digest/scientificDigest.ts";

export type Bm08RecordingCheckpoint = Readonly<{
  checkpointVersion: 1;
  sourceDigest: string;
  ownerId: "inference.bm08";
  seed: string;
  diffusion: number;
  flowDrift: number;
  steps: number;
  baseSpacing: number;
  draws: number;
  digest: string;
}>;

/** Both complete latent coordinates and exposure integrals belong to the recorded world. */
export async function createBm08RecordingCheckpoint(
  recording: CameraRecording,
  sourceDigest: string,
): Promise<Bm08RecordingCheckpoint> {
  const identity = {
    checkpointVersion: 1 as const,
    sourceDigest,
    ownerId: "inference.bm08" as const,
    seed: recording.setup.seed,
    diffusion: recording.setup.D,
    flowDrift: recording.setup.flowDrift,
    steps: recording.steps,
    baseSpacing: CAMERA_GRID_DT,
    draws: recording.draws,
  };
  const { digest } = await scientificDigest({
    ...identity,
    layout: "bm08-position-and-integrated-bridge-f64-v1",
    replicate: recording.replicate,
    coordinates: recording.positions,
    exposureAverages: recording.averages,
  });
  return Object.freeze({ ...identity, digest });
}
