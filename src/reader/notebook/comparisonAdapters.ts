/** Instrument-owned comparison semantics; notebook recipes never supply executable adapters. */
import { BM01_COMPARISON, verifyBm01Comparison } from "../../experiments/bm01/comparison.ts";
import { validateBm01Parameters } from "../../experiments/bm01/parameters.ts";
import type { PreparedBm01Example } from "../../experiments/bm01/session.ts";
import {
  BM08_COMPARISON,
  bm08ComparisonIdentity,
  verifyBm08Comparison,
} from "../../experiments/bm08/comparison.ts";
import { validateBm08Parameters } from "../../experiments/bm08/parameters.ts";
import type { PreparedBm08Example } from "../../experiments/bm08/session.ts";
import type {
  Baseline,
  ComparisonIdentity,
  ComparisonParameters,
  ComparisonSnapshot,
} from "../../experiments/compare/Baseline.ts";
import type { ComparisonResult } from "../../experiments/compare/compatibility.ts";
import type { ComparisonPort } from "../../experiments/compare/controlledComparison.ts";
import type { ComparisonContract } from "../../experiments/compare/singleVariationLock.ts";
import type { TapeReplayGrid } from "../../experiments/permalink/types.ts";
import {
  fixedSr03ComparisonParameters,
  SR03_COMPARISON,
  sr03ComparisonIdentity,
  verifySr03Comparison,
  verifySr03SavedComparison,
} from "../../experiments/sr03/comparison.ts";
import type { PreparedSr03Example } from "../../experiments/sr03/session.ts";
import type { WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import type { ReplayCatalogue } from "./replayCompatibility.ts";

export type ReplayInstrumentId = "bm-01" | "bm-08" | "sr-03";
export type ComparisonReplayKind = "bm01-comparison" | "bm08-comparison" | "sr03-comparison";
export type ComparisonReplayPrediction = "smaller" | "same" | "larger";
export type ComparisonReplaySession = ComparisonPort &
  Readonly<{ setSchedulingPaused(paused: boolean): void }>;
export type ComparisonReplayOwner = Readonly<{
  identity: ComparisonIdentity;
  workerFactory: () => WorkerChannel;
}> &
  (
    | Readonly<{ instrumentId?: "bm-01"; example: PreparedBm01Example }>
    | Readonly<{ instrumentId: "bm-08"; example: PreparedBm08Example }>
    | Readonly<{ instrumentId: "sr-03"; example: PreparedSr03Example }>
  );

export class ComparisonReplayAdapterError extends TypeError {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ComparisonReplayAdapterError";
    this.code = code;
  }
}

export type ComparisonReplayAdapter = Readonly<{
  instrumentId: ReplayInstrumentId;
  kind: ComparisonReplayKind;
  mode: string;
  contract: ComparisonContract;
  title: string;
  paper: string;
  anchor: string;
  saveDescription: string;
  evidenceDescription: string;
  matchingScalarsMessage: string;
  /** Only the registered owner decides whether a seed is a physical input or a wire identity. */
  seedPolicy:
    | Readonly<{ kind: "parameter"; parameterId: "seed" }>
    | Readonly<{ kind: "deterministic"; value: "0" }>;
  predictionPromptId: string;
  predictions: Readonly<Record<ComparisonReplayPrediction, string>>;
  parameters(input: unknown): ComparisonParameters;
  replayGrid(parameters: ComparisonParameters): TapeReplayGrid | undefined;
  verifyAccepted(
    baseline: ComparisonSnapshot,
    variant: ComparisonSnapshot,
    result: ComparisonResult,
  ): string | null;
  verifySaved?: (baseline: Baseline, variant: Baseline, result: ComparisonResult) => string | null;
  createSession(instanceId: string, owner: ComparisonReplayOwner): Promise<ComparisonReplaySession>;
  loadCurrentOwner(): Promise<ComparisonReplayOwner>;
  /** Paper-specific revisions and aliases; a foreign paper's anchor must not appear resolved. */
  loadCatalogue(): Promise<ReplayCatalogue>;
}>;

/** Called with the adapter's validated canonical parameters, never with an imported policy. */
export function comparisonReplaySeed(
  adapter: ComparisonReplayAdapter,
  parameters: ComparisonParameters,
): string {
  return adapter.seedPolicy.kind === "deterministic"
    ? adapter.seedPolicy.value
    : (parameters[adapter.seedPolicy.parameterId] as string);
}

const stochasticMatchingMessage =
  "Finished. The new numbers agree within relative tolerance 1e-12 of the saved ones, that is, to one part in a trillion. The particles' paths were not saved, so they were not compared.";

async function loadBrownianCatalogue(): Promise<ReplayCatalogue> {
  const { default: catalogue } = await import("../../generated/notebook-replay.json");
  return catalogue as ReplayCatalogue;
}

function cameraParameters(input: unknown) {
  const checked = validateBm08Parameters(input);
  if (checked.kind !== "accepted" || checked.data.coverageTrials !== 0)
    throw new ComparisonReplayAdapterError(
      "invalid-replay-parameters",
      "A camera comparison needs valid settings for one recording, without additional hypothetical experiments.",
    );
  return checked.data;
}

const adapters: Readonly<Record<ReplayInstrumentId, ComparisonReplayAdapter>> = Object.freeze({
  "bm-01": Object.freeze({
    instrumentId: "bm-01",
    kind: "bm01-comparison",
    mode: "bm-01:default",
    contract: BM01_COMPARISON,
    title: "My controlled Brownian comparison",
    paper: "brownian-motion",
    anchor: "arg-bm-observable",
    saveDescription:
      "Keeps the scalar readouts and the recipe to run them again. The simulated particle paths are not stored.",
    evidenceDescription:
      "These are the numbers you saw, from simulated particles. They are not recomputed, and the particles' paths were not kept.",
    matchingScalarsMessage: stochasticMatchingMessage,
    seedPolicy: Object.freeze({ kind: "parameter", parameterId: "seed" }),
    predictionPromptId: "bm-01-predict-comparison-rms",
    predictions: Object.freeze({
      smaller: "The coordinate RMS will be smaller",
      same: "The coordinate RMS will stay the same",
      larger: "The coordinate RMS will be larger",
    }),
    parameters(input: unknown) {
      const checked = validateBm01Parameters(input);
      if (checked.kind !== "accepted")
        throw new ComparisonReplayAdapterError(
          "invalid-replay-parameters",
          "Unsupported tracer replay parameters.",
        );
      return checked.data;
    },
    replayGrid: (parameters: ComparisonParameters) => ({
      baseSpacing: Number(parameters.h),
      horizon: Number(parameters.H),
    }),
    verifyAccepted: verifyBm01Comparison,
    async createSession(instanceId: string, owner: ComparisonReplayOwner) {
      if (owner.instrumentId !== undefined && owner.instrumentId !== "bm-01")
        throw new ComparisonReplayAdapterError(
          "replay-owner-mismatch",
          "This saved comparison requires the tracer instrument.",
        );
      const { createBm01Session } = await import("../../experiments/bm01/session.ts");
      return createBm01Session(instanceId, owner.example, owner.workerFactory);
    },
    async loadCurrentOwner(): Promise<ComparisonReplayOwner> {
      const [prepared, catalogue, browser] = await Promise.all([
        import("../../generated/bm01-example.json"),
        import("../../generated/notebook-replay.json"),
        import("../../experiments/bm01/browser.ts"),
      ]);
      return {
        instrumentId: "bm-01",
        example: prepared.default,
        identity: catalogue.default.identity,
        workerFactory: browser.createBm01BrowserChannel,
      };
    },
    loadCatalogue: loadBrownianCatalogue,
  }),
  "bm-08": Object.freeze({
    instrumentId: "bm-08",
    kind: "bm08-comparison",
    mode: "bm-08:default",
    contract: BM08_COMPARISON,
    title: "My controlled camera comparison",
    paper: "brownian-motion",
    anchor: "arg-bm-inference",
    saveDescription:
      "Keeps the diffusion estimates and selected scalar readouts, with all three seeds. Particle paths, camera frames and confidence-set bounds are not stored. A replay reconstructs the comparison through the camera model.",
    evidenceDescription:
      "These are the diffusion estimates and selected scalar readouts you saved from a simulated camera. They are not recomputed. Particle paths, camera frames and confidence-set bounds were not kept; running again reconstructs a new comparison from the saved settings and all three seeds.",
    matchingScalarsMessage: stochasticMatchingMessage,
    seedPolicy: Object.freeze({ kind: "parameter", parameterId: "seed" }),
    predictionPromptId: "bm-08-predict-comparison-naive-diffusion",
    predictions: Object.freeze({
      smaller: "The naive diffusion estimate will be smaller",
      same: "The naive diffusion estimate will stay the same",
      larger: "The naive diffusion estimate will be larger",
    }),
    parameters: cameraParameters,
    // The canonical BM-08 tape identity fixes its internal recording grid. Unlike BM-01,
    // it has no reader-adjustable latent spacing or horizon to carry in a recipe.
    replayGrid: () => undefined,
    verifyAccepted: verifyBm08Comparison,
    async createSession(instanceId: string, owner: ComparisonReplayOwner) {
      if (owner.instrumentId !== "bm-08")
        throw new ComparisonReplayAdapterError(
          "replay-owner-mismatch",
          "This saved comparison requires the camera instrument.",
        );
      const { createBm08Session } = await import("../../experiments/bm08/session.ts");
      return createBm08Session(instanceId, owner.example, owner.workerFactory);
    },
    async loadCurrentOwner(): Promise<ComparisonReplayOwner> {
      const [prepared, browser] = await Promise.all([
        import("../../generated/bm08-example.json"),
        import("../../experiments/bm08/browser.ts"),
      ]);
      return {
        instrumentId: "bm-08",
        example: { ...prepared.default, parameters: cameraParameters(prepared.default.parameters) },
        identity: bm08ComparisonIdentity(prepared.default),
        workerFactory: browser.createBm08BrowserChannel,
      };
    },
    loadCatalogue: loadBrownianCatalogue,
  }),
  "sr-03": Object.freeze({
    instrumentId: "sr-03",
    kind: "sr03-comparison",
    mode: "sr-03:default",
    contract: SR03_COMPARISON,
    title: "My controlled observer comparison",
    paper: "special-relativity",
    anchor: "arg-sr-rod-events",
    saveDescription:
      "Keeps both descriptions' scalar readouts, the fixed event-pair settings and the observer change. Replaying recalculates the same pair through the relativity model.",
    evidenceDescription:
      "These are the time and distance readouts you saved for one fixed event pair. They are not recomputed on opening. The settings identify the physical setup and event selection; an explicit replay uses the registered relativity model.",
    matchingScalarsMessage:
      "Finished. The saved readouts agree within relative tolerance 1e-12, that is, to one part in a trillion. Both descriptions use the same fixed event pair and physical setup.",
    // SR-03 draws no random samples. Zero is the deterministic tape identity, not a new input.
    seedPolicy: Object.freeze({ kind: "deterministic", value: "0" }),
    predictionPromptId: "sr-03-predict-comparison-time-separation",
    predictions: Object.freeze({
      smaller: "The signed time separation will be smaller",
      same: "The signed time separation will stay the same",
      larger: "The signed time separation will be larger",
    }),
    // The validator returns the complete scalar shape; Sr03Parameters retains optional custom
    // fields in its public type for the laboratory's older settings links.
    parameters: (input: unknown) =>
      fixedSr03ComparisonParameters(input) as unknown as ComparisonParameters,
    replayGrid: () => undefined,
    verifyAccepted: verifySr03Comparison,
    verifySaved: verifySr03SavedComparison,
    async createSession(instanceId: string, owner: ComparisonReplayOwner) {
      if (owner.instrumentId !== "sr-03")
        throw new ComparisonReplayAdapterError(
          "replay-owner-mismatch",
          "This saved comparison requires the rod and simultaneity instrument.",
        );
      const { createSr03Session } = await import("../../experiments/sr03/session.ts");
      return createSr03Session(instanceId, owner.example, owner.workerFactory);
    },
    async loadCurrentOwner(): Promise<ComparisonReplayOwner> {
      const [prepared, browser] = await Promise.all([
        import("../../generated/sr03-notebook-replay.json"),
        import("../../experiments/sr03/browser.ts"),
      ]);
      const example = prepared.default.example;
      return {
        instrumentId: "sr-03",
        example: { ...example, parameters: fixedSr03ComparisonParameters(example.parameters) },
        identity: sr03ComparisonIdentity(example),
        workerFactory: browser.createSr03BrowserChannel,
      };
    },
    async loadCatalogue(): Promise<ReplayCatalogue> {
      const { default: catalogue } = await import("../../generated/sr03-notebook-replay.json");
      return catalogue as ReplayCatalogue;
    },
  }),
});

/** No fallback: an unknown imported instrument stays unsupported, never runs another owner. */
export function comparisonReplayAdapter(instrumentId: unknown): ComparisonReplayAdapter {
  if (typeof instrumentId !== "string" || !Object.hasOwn(adapters, instrumentId))
    throw new ComparisonReplayAdapterError(
      "unsupported-replay-instrument",
      "This instrument has no supported notebook replay adapter. Keep the original export.",
    );
  return adapters[instrumentId as ReplayInstrumentId];
}

export function comparisonReplayAdapterForKind(kind: unknown): ComparisonReplayAdapter {
  const adapter = Object.values(adapters).find((candidate) => candidate.kind === kind);
  if (!adapter)
    throw new ComparisonReplayAdapterError(
      "unsupported-replay-kind",
      "This saved comparison recipe has no supported notebook replay adapter. Keep the original export.",
    );
  return adapter;
}
