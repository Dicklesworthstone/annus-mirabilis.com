import {
  type BinomialDistribution,
  binomialInside,
  type EnumerationOutcome,
  enumerateFractionConfigurations,
  type IndependentPointsProbabilityResult,
  independentPointsProbability,
  lockedPointsInside,
  lockedPositionsProbability,
  type SeededPointSamplingResult,
  sampleIndependentPoints,
  sampleLockedPoints,
} from "../../physics/reference/radiation.ts";
import type { AcceptedSnapshot, ExperimentView, PublishedResult } from "../store/instanceStore.ts";
import { LQ05_DEFAULTS, type Lq05Parameters } from "./definition.ts";
import { validateLq05Parameters } from "./parameters.ts";

export type Lq05Evaluation = Readonly<{
  independentProbability: IndependentPointsProbabilityResult;
  /** The selected dependence model, used by every displayed probability and logarithm. */
  probability: IndependentPointsProbabilityResult;
  distribution: BinomialDistribution;
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
  const locked = lockedPositionsProbability(parameters.n, parameters.f);
  const probability = parameters.locked ? locked : independentProbability;
  const distribution = parameters.locked
    ? lockedPointsInside(parameters.n, parameters.f)
    : binomial;
  const enumeration = enumerateFractionConfigurations(
    parameters.n,
    parameters.f,
    parameters.locked,
  );
  const samplingOwner = parameters.locked ? sampleLockedPoints : sampleIndependentPoints;
  const sampling = samplingOwner({
    n: parameters.n,
    f: parameters.f,
    trials: parameters.trials,
    seed: parameters.seed,
  });

  const expectedTrialsToOne = 1 / probability.value;
  const probabilityOwner = parameters.locked
    ? "radiation.lockedPositionsProbability"
    : "radiation.independentPointsProbability";
  const sampleOwner = parameters.locked
    ? "radiation.sampleLockedPoints"
    : "radiation.sampleIndependentPoints";

  const outputs: readonly PublishedResult[] = Object.freeze([
    {
      quantityId: "configurationProbability",
      unit: "1",
      semanticKind: "probability",
      ownerId: probabilityOwner,
      status: "value",
      value: probability.value,
    },
    {
      quantityId: "lnW",
      unit: "1",
      semanticKind: "log-probability",
      ownerId: probabilityOwner,
      status: "value",
      value: probability.lnW,
    },
    {
      quantityId: "log10W",
      unit: "1",
      semanticKind: "log10-probability",
      ownerId: probabilityOwner,
      status: "value",
      value: probability.log10W,
    },
    {
      quantityId: "deltaSOverKb",
      unit: "1",
      semanticKind: "entropy-dimensionless",
      ownerId: probabilityOwner,
      status: "value",
      value: probability.deltaSOverKb,
    },
    {
      quantityId: "sampleFraction",
      unit: "1",
      semanticKind: "empirical-probability",
      ownerId: sampleOwner,
      status: "value",
      value: sampling.sampleFraction,
    },
    {
      quantityId: "successCount",
      unit: "1",
      semanticKind: "success-count",
      ownerId: sampleOwner,
      status: "value",
      value: sampling.successCount,
    },
    {
      quantityId: "drawCountAfter",
      unit: "1",
      semanticKind: "draw-count",
      ownerId: sampleOwner,
      status: "value",
      value: sampling.drawCountAfter,
    },
    {
      quantityId: "expectedTrialsToOne",
      unit: "1",
      semanticKind: "expected-trials",
      ownerId: probabilityOwner,
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
    probability,
    distribution,
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

  const serverView = view;
  function apply(nextParams: unknown, newRun = false) {
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

    if (newRun || isSetup) {
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
  }

  return {
    instanceId,
    subscribe(callback: () => void) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    getSnapshot(): ExperimentView {
      return view;
    },
    // The view the page was built with, frozen, as React's server snapshot must be. It returned
    // the live view, so the lab's "is this still the build's example" identity test held for every
    // accepted run and the label stayed "Static worked example" over the reader's own results
    // (BM-03's session had the same fault, measured on live).
    getServerSnapshot(): ExperimentView {
      return serverView;
    },
    acceptedParameters(): Lq05Parameters {
      return (view.accepted?.parameters ?? currentParams) as Lq05Parameters;
    },
    apply: (input: unknown) => apply(input),
    startNewRun: (input: unknown) => apply(input, true),
  };
}
