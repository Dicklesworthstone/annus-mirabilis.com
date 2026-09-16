/**
 * Types and interfaces for Tape Schema Version 2 and Permalink serialization.
 * Specification: am-inst-permalink-tape-s677, am-rt-control-tapes-0gc
 */

import type { CommandClass } from "../../content/schemas/experiment.ts";
import type { U64String } from "../identity/u64.ts";
import type { RefusalCode } from "../results/refusalCodes.ts";

export type TapeCompatibilityRefusalCode =
  | "tape-version-unsupported"
  | "tape-model-mismatch"
  | "tape-artifact-mismatch"
  | "tape-constant-set-mismatch"
  | "tape-stream-version-mismatch"
  | "tape-allocation-mismatch"
  | "tape-grid-mismatch";

export type TapeModelIdentity = Readonly<{
  modelId: string;
  modelVersion: number;
  artifactDigest?: string | undefined;
  evaluatorSourceHash?: string | undefined;
}>;

export type TapeControlEvent = Readonly<{
  actionIndex: number;
  commandClass: CommandClass;
  paramId: string;
  value: number | string;
  previousValue?: number | string | undefined;
}>;

export type PredictionForm = "candidate" | "sketch" | "verbal" | "values";

export type PredictionCandidatePayload = Readonly<{
  candidateId: string;
}>;

export type PredictionSketchPayload = Readonly<{
  points: readonly (readonly [number, number])[];
}>;

export type PredictionVerbalPayload = Readonly<{
  choiceIndex: number;
  choiceText?: string | undefined;
}>;

export type PredictionValuesPayload = Readonly<{
  values: readonly (readonly [number, number])[];
}>;

export type TapePredictionPayload =
  | PredictionCandidatePayload
  | PredictionSketchPayload
  | PredictionVerbalPayload
  | PredictionValuesPayload;

export type TapePredictionEvent = Readonly<{
  promptId: string;
  form: PredictionForm;
  payload: TapePredictionPayload;
}>;

export type TapeReplayGrid = Readonly<{
  baseSpacing: number;
  horizon: number;
}>;

export type TapeTeachingRef = Readonly<{
  tapeId: string;
  stepIndex: number;
}>;

export type TapeAcceptedCheckpoint = Readonly<{
  acceptedActionIndex: number;
  acceptedInputRevision: number;
  digest: string;
}>;

export type TapeV2 = Readonly<{
  tapeVersion: 2;
  experimentId: string;
  mode: string;
  modelIdentity: TapeModelIdentity;
  constantSetId: string;
  seed: U64String;
  streamVersion: number | string;
  allocationId: string;
  replayGrid?: TapeReplayGrid | undefined;
  initialConditions: Readonly<Record<string, number | string>>;
  presetId?: string | undefined;
  events: readonly TapeControlEvent[];
  predictions?: readonly TapePredictionEvent[] | undefined;
  teachingTapeRef?: TapeTeachingRef | undefined;
  acceptedCheckpoint: TapeAcceptedCheckpoint;
  title?: string | undefined;
  description?: string | undefined;
}>;

export type ExperimentEnvironment = Readonly<{
  experimentId: string;
  mode: string;
  modelId: string;
  modelVersion: number;
  artifactDigest?: string | undefined;
  evaluatorSourceHash?: string | undefined;
  constantSetId: string;
  streamVersion: number | string;
  allocationId: string;
  replayGrid?: TapeReplayGrid | undefined;
}>;

export type TapeDecodeResult =
  | Readonly<{ kind: "absent" }>
  | Readonly<{ kind: "success"; tape: TapeV2 }>
  | Readonly<{
      kind: "invalid";
      notice: string;
      reason: string;
      refusalCode?: RefusalCode | undefined;
      details?: unknown | undefined;
    }>;

export type TapeReplayResult =
  | Readonly<{
      kind: "success";
      runId: string;
      acceptedCheckpoint: TapeAcceptedCheckpoint;
      state: Readonly<Record<string, number | string>>;
      isNewRun: boolean;
      executedEventCount: number;
    }>
  | Readonly<{
      kind: "refusal";
      refusalCode: TapeCompatibilityRefusalCode;
      notice: string;
      repair: string;
      tapeIdentity: unknown;
      currentIdentity: unknown;
      offerNewRun: true;
    }>
  | Readonly<{
      kind: "invariant-violation";
      notice: string;
      storedDigest: string;
      replayedDigest: string;
    }>
  | Readonly<{
      kind: "invalid";
      notice: string;
      reason: string;
    }>;
