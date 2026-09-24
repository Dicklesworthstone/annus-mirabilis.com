import {
  type BinomialDistribution,
  binomialInside,
  type EnumerationOutcome,
  enumerateConfigurations,
  type IndependentPointsProbabilityResult,
  independentPointsProbability,
  lockedPositionsProbability,
  type SeededPointSamplingResult,
  sampleIndependentPoints,
} from "../../physics/reference/radiation.ts";
import type { AcceptedSnapshot, ExperimentView, PublishedResult } from "../store/instanceStore.ts";
import { LQ05_DEFAULTS, type Lq05Parameters } from "./definition.ts";
import { validateLq05Parameters } from "./parameters.ts";

export type Lq05Evaluation = Readonly<{
  independentProbability: IndependentPointsProbabilityResult;
  binomial: BinomialDistribution;
  enumeration: EnumerationOutcome;
  locked: ReturnType<typeof lockedPositionsProbability>;
  sampling: SeededPointSamplingResult;
  outputs: readonly PublishedResult[];
}>;

export type PreparedLq05Example = Readonly<{
  sourceDigest: string;
  parameters: Lq05Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

export function evaluateLq05(parameters: Lq05Parameters): Lq05Evaluation {
  const independentProbability = independentPointsProbability(parameters.n, parameters.f);
  const binomial = binomialInside(parameters.n, parameters.f);
  const cells = parameters.f <= 0.5 ? Math.round(1 / parameters.f) : 2;
  const enumeration = enumerateConfigurations(parameters.n, cells);
  const locked = lockedPositionsProbability(parameters.n, parameters.f);
  const sampling = sampleIndependentPoints({
    n: parameters.n,
    f: parameters.f,
    trials: parameters.trials,
    seed: parameters.seed,
  });

  const effectiveProb = parameters.locked ? locked.value : independentProbability.value;
  const effectiveLnW = parameters.locked ? Math.log(locked.value) : independentProbability.lnW;
  const effectiveLog10W = parameters.locked
    ? Math.log10(locked.value)
    : independentProbability.log10W;
  const effectiveDeltaSOverKb = parameters.locked
    ? Math.log(locked.value)
    : independentProbability.deltaSOverKb;
  const expectedTrialsToOne = effectiveProb > 0 ? 1 / effectiveProb : Number.POSITIVE_INFINITY;

  const outputs: readonly PublishedResult[] = Object.freeze([
    {
      quantityId: "configurationProbability",
      unit: "1",
      semanticKind: "probability",
      ownerId: "radiation.independentPointsProbability",
      status: "value",
      value: effectiveProb,
    },
    {
      quantityId: "lnW",
      unit: "1",
      semanticKind: "log-probability",
      ownerId: "radiation.independentPointsProbability",
      status: "value",
      value: effectiveLnW,
    },
    {
      quantityId: "log10W",
      unit: "1",
      semanticKind: "log10-probability",
      ownerId: "radiation.independentPointsProbability",
      status: "value",
      value: effectiveLog10W,
    },
    {
      quantityId: "deltaSOverKb",
      unit: "1",
      semanticKind: "entropy-dimensionless",
      ownerId: "radiation.independentPointsProbability",
      status: "value",
      value: effectiveDeltaSOverKb,
    },
    {
      quantityId: "sampleFraction",
      unit: "1",
      semanticKind: "empirical-probability",
      ownerId: "radiation.sampleIndependentPoints",
      status: "value",
      value: sampling.sampleFraction,
    },
    {
      quantityId: "successCount",
      unit: "1",
      semanticKind: "success-count",
      ownerId: "radiation.sampleIndependentPoints",
      status: "value",
      value: sampling.successCount,
    },
    {
      quantityId: "drawCountAfter",
      unit: "1",
      semanticKind: "draw-count",
      ownerId: "radiation.sampleIndependentPoints",
      status: "value",
      value: sampling.drawCountAfter,
    },
    {
      quantityId: "expectedTrialsToOne",
      unit: "1",
      semanticKind: "expected-trials",
      ownerId: "radiation.independentPointsProbability",
      status: "value",
      value: expectedTrialsToOne,
    },
    {
      quantityId: "lockedProbability",
      unit: "1",
      semanticKind: "locked-probability",
      ownerId: "radiation.lockedPositionsProbability",
      status: "value",
      value: locked.value,
    },
  ]);

  return Object.freeze({
    independentProbability,
    binomial,
    enumeration,
    locked,
    sampling,
    outputs,
  });
}

export function buildLq05Snapshot(
  instanceId: string,
  runId: string,
  parentRunId: string | null,
  parameters: Lq05Parameters,
  inputRevision: number,
  actionIndex: number,
): AcceptedSnapshot {
  const evalResult = evaluateLq05(parameters);
  return Object.freeze({
    experimentId: "lq-05",
    instanceId,
    runId,
    parentRunId,
    actionIndex,
    revisions: Object.freeze({
      input: inputRevision,
      observer: 0,
      measurement: 0,
      estimator: 0,
    }),
    parameters: Object.freeze({ ...parameters }),
    stepIndex: 1,
    simulationTime: 1.0,
    final: true,
    snapshotVersion: actionIndex + 1,
    outputs: evalResult.outputs,
  });
}

export function createLq05Session(
  instanceId: string,
  initialParameters: Lq05Parameters = LQ05_DEFAULTS,
) {
  let currentParams = { ...initialParameters };
  let currentRunId = `${instanceId}/run/1`;
  let parentRunId: string | null = null;
  let inputRevision = 1;
  let actionIndex = 0;
  let acceptedSnapshot = buildLq05Snapshot(
    instanceId,
    currentRunId,
    parentRunId,
    currentParams,
    inputRevision,
    actionIndex,
  );

  const listeners = new Set<() => void>();

  function notify() {
    for (const listener of listeners) listener();
  }

  let view: ExperimentView = {
    status: "accepted",
    pending: false,
    requested: {
      experimentId: "lq-05",
      instanceId,
      runId: currentRunId,
      parentRunId,
      actionIndex,
      revisions: { input: inputRevision, observer: 0, measurement: 0, estimator: 0 },
      parameters: currentParams,
    },
    accepted: acceptedSnapshot,
    refusal: null,
    outcome: null,
  };

  return {
    instanceId,
    subscribe(callback: () => void) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    getSnapshot(): ExperimentView {
      return view;
    },
    getServerSnapshot(): ExperimentView {
      return view;
    },
    acceptedParameters(): Lq05Parameters {
      return (view.accepted?.parameters ?? currentParams) as Lq05Parameters;
    },
    apply(nextParams: unknown) {
      actionIndex++;
      const computation = validateLq05Parameters(nextParams);
      if (computation.kind !== "accepted") {
        if (computation.kind === "refused") {
          view = {
            ...view,
            status: "refused",
            pending: false,
            refusal: computation.refusal,
            outcome: null,
          };
        }
        notify();
        return computation;
      }

      const validated = computation.data;
      const isSetup =
        validated.n !== currentParams.n ||
        validated.locked !== currentParams.locked ||
        validated.seed !== currentParams.seed ||
        validated.trials !== currentParams.trials;

      if (isSetup) {
        parentRunId = currentRunId;
        inputRevision++;
        currentRunId = `${instanceId}/run/${inputRevision}`;
      }

      currentParams = { ...validated };
      acceptedSnapshot = buildLq05Snapshot(
        instanceId,
        currentRunId,
        parentRunId,
        currentParams,
        inputRevision,
        actionIndex,
      );

      view = {
        status: "accepted",
        pending: false,
        requested: {
          experimentId: "lq-05",
          instanceId,
          runId: currentRunId,
          parentRunId,
          actionIndex,
          revisions: { input: inputRevision, observer: 0, measurement: 0, estimator: 0 },
          parameters: currentParams,
        },
        accepted: acceptedSnapshot,
        refusal: null,
        outcome: null,
      };

      notify();
      return computation;
    },
  };
}
