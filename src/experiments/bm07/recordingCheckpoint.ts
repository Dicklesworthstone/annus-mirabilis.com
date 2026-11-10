import {
  INFERENCE_GRID_DT,
  type InferenceRecording,
} from "../../physics/reference/inference/synthetic.ts";
import { HOST_NORMAL_VERSION } from "../../physics/reference/philox.ts";
import { scientificDigest } from "../digest/scientificDigest.ts";

export type Bm07RecordingCheckpoint = Readonly<{
  checkpointVersion: 1;
  sourceDigest: string;
  ownerId: "inference.bm07";
  normalVersion: string;
  allocationId: "bm-07.synthetic-latent.v1";
  seed: string;
  generatorT: number;
  generatorEta: number;
  generatorRadius: number;
  hiddenNumber: number;
  diffusionCoefficient: number;
  replicate: number;
  steps: number;
  baseSpacing: number;
  draws: number;
  digest: string;
}>;

/** Hash every latent coordinate once, before an observation or estimator can select a subset. */
export async function createBm07RecordingCheckpoint(
  recording: InferenceRecording,
  sourceDigest: string,
): Promise<Bm07RecordingCheckpoint> {
  const identity = {
    checkpointVersion: 1 as const,
    sourceDigest,
    ownerId: "inference.bm07" as const,
    normalVersion: HOST_NORMAL_VERSION,
    allocationId: "bm-07.synthetic-latent.v1" as const,
    seed: recording.setup.seed,
    generatorT: recording.setup.generatorT,
    generatorEta: recording.setup.generatorEta,
    generatorRadius: recording.setup.generatorRadius,
    hiddenNumber: recording.hiddenNumber,
    diffusionCoefficient: recording.D,
    replicate: recording.replicate,
    steps: recording.steps,
    baseSpacing: INFERENCE_GRID_DT,
    draws: recording.draws,
  };
  const { digest } = await scientificDigest({
    ...identity,
    layout: "bm07-step-coordinate-f64-le-v1",
    shape: [recording.steps + 1, 2],
    coordinates: recording.positions,
  });
  return Object.freeze({ ...identity, digest });
}
