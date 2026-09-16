/**
 * Test Fixture for Permalinks and Control Tapes.
 * Specification: am-inst-permalink-tape-s677
 */

import type { U64String } from "../identity/u64.ts";
import { quantizeFloat } from "../tape/controlTape.ts";
import type { ReplayRunner } from "./replay.ts";
import type {
  ExperimentEnvironment,
  TapeAcceptedCheckpoint,
  TapeControlEvent,
  TapeV2,
} from "./types.ts";

export const FIXTURE_ENVIRONMENT: ExperimentEnvironment = Object.freeze({
  experimentId: "bm-01",
  mode: "bm-01:default",
  modelId: "fixtureDiffusionKernel",
  modelVersion: 1,
  artifactDigest: "blake3:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  constantSetId: "1905-annalen-constants",
  streamVersion: 1,
  allocationId: "bm01-tracers-stream",
  replayGrid: {
    baseSpacing: 0.01,
    horizon: 10.0,
  },
});

export const FIXTURE_TEACHING_TAPE_EINSTEIN_08: TapeV2 = Object.freeze({
  tapeVersion: 2,
  experimentId: "bm-01",
  mode: "bm-01:default",
  modelIdentity: {
    modelId: "fixtureDiffusionKernel",
    modelVersion: 1,
    artifactDigest: "blake3:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  },
  constantSetId: "1905-annalen-constants",
  seed: "1905" as U64String,
  streamVersion: 1,
  allocationId: "bm01-tracers-stream",
  replayGrid: {
    baseSpacing: 0.01,
    horizon: 10.0,
  },
  initialConditions: Object.freeze({
    temperatureK: 293.15,
    viscosityPaS: 0.001,
    particleRadiusM: 0.5e-6,
    tracerCount: 100,
  }),
  events: Object.freeze([
    {
      actionIndex: 1,
      commandClass: "physical-intervention" as const,
      paramId: "temperatureK",
      value: 300,
    },
    {
      actionIndex: 2,
      commandClass: "physical-intervention" as const,
      paramId: "viscosityPaS",
      value: 0.0012,
    },
    {
      actionIndex: 3,
      commandClass: "measurement-change" as const,
      paramId: "tracerCount",
      value: 200,
    },
  ]),
  acceptedCheckpoint: Object.freeze({
    acceptedActionIndex: 3,
    acceptedInputRevision: 3,
    digest: computeFixtureDigest(
      {
        temperatureK: 300,
        viscosityPaS: 0.0012,
        particleRadiusM: 0.5e-6,
        tracerCount: 200,
      },
      3,
      "1905",
    ),
  }),
  title: "Einstein's 0.8 micron sequence",
  description: "Reference teaching sequence illustrating Brownian displacement at 0.8 microns.",
});

export function computeFixtureDigest(
  state: Record<string, number | string>,
  actionIndex: number,
  seed: string,
): string {
  const sortedKeys = Object.keys(state).sort();
  let h = (2166136261 ^ (actionIndex & 0xffffffff)) >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  for (const k of sortedKeys) {
    for (let i = 0; i < k.length; i++) {
      h ^= k.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    const val = state[k];
    const num = typeof val === "number" ? quantizeFloat(val) : 0;
    const bits = Math.round(num * 1000000);
    h ^= bits;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `host:sha256:${(h >>> 0).toString(16).padStart(64, "0")}`;
}

export class FixtureRunner implements ReplayRunner {
  readonly environment: ExperimentEnvironment;
  private state: Record<string, number | string> = {};
  private currentActionIndex = 0;
  private inputRevision = 0;
  private seed: string;
  private plantedDigestMismatch: string | null = null;

  constructor(environment: ExperimentEnvironment = FIXTURE_ENVIRONMENT, seed = "1905") {
    this.environment = environment;
    this.seed = seed;
  }

  plantDigestMismatch(fakeDigest: string): void {
    this.plantedDigestMismatch = fakeDigest;
  }

  setSeed(seed: string): void {
    this.seed = seed;
  }

  applyInitialConditions(conditions: Record<string, number | string>): void {
    this.state = { ...conditions };
    this.currentActionIndex = 0;
    this.inputRevision = 0;
  }

  applyEvent(event: TapeControlEvent): void {
    this.state[event.paramId] = event.value;
    this.currentActionIndex = event.actionIndex;
    this.inputRevision++;
  }

  getAcceptedCheckpoint(): TapeAcceptedCheckpoint {
    const digest =
      this.plantedDigestMismatch ??
      computeFixtureDigest(this.state, this.currentActionIndex, this.seed);

    return {
      acceptedActionIndex: this.currentActionIndex,
      acceptedInputRevision: this.inputRevision,
      digest,
    };
  }

  getCurrentState(): Record<string, number | string> {
    return { ...this.state };
  }

  resolveTeachingTape(tapeId: string): TapeV2 | null {
    if (
      tapeId === "bm-01-einstein-08" ||
      tapeId === FIXTURE_TEACHING_TAPE_EINSTEIN_08.experimentId
    ) {
      return FIXTURE_TEACHING_TAPE_EINSTEIN_08;
    }
    return null;
  }
}
