import { getConstantSet } from "../../physics/reference/constants.ts";
import {
  configurationFactorRatio,
  configurationVolumeTerm,
  type FactorRatio,
  lockedClusterPressure,
  type RouteAEvaluation,
} from "../../physics/reference/diffusion.ts";
import type {
  AcceptedSnapshot,
  ExperimentView,
  PublishedResult,
  RequestToken,
} from "../store/instanceStore.ts";
import { BM03_DEFAULTS, BM03_OUTPUTS, type Bm03Parameters } from "./definition.ts";
import { validateBm03Parameters } from "./parameters.ts";

export type Bm03Evaluation = Readonly<{
  factorRatio: FactorRatio | RouteAEvaluation;
  deltaF: RouteAEvaluation;
  pressure: RouteAEvaluation;
  lockedClusterPressure: RouteAEvaluation;
  volumeIndependentFactor: PublishedResult;
  momentumIntegrals: PublishedResult;
  freeEnergyOffset: PublishedResult;
  log10Exponent: number;
  naturalLogExponent: number;
  exactDecimalString?: string;
}>;

/** The plot, table and source comparison share this one accepted evaluation. */
export type Bm03ExperimentView = ExperimentView &
  Readonly<{
    accepted: AcceptedSnapshot;
    evaluation: Bm03Evaluation;
  }>;

export function evaluateBm03(
  parameters: Bm03Parameters = BM03_DEFAULTS,
  constantSetId = "modern-si-2019",
): Bm03Evaluation {
  const set = getConstantSet(constantSetId);
  const V0_m3 = parameters.V0 * 1e-18;
  const V_m3 = V0_m3 * parameters.volumeRatio;
  const T = parameters.T;
  const Np = parameters.Np;
  const ratioStr = String(parameters.volumeRatio);

  const lockedRes = lockedClusterPressure(V_m3, T, set);
  const lockedEval = "locked" in lockedRes ? lockedRes.locked : (lockedRes as RouteAEvaluation);
  const independentOutside =
    "independent" in lockedRes ? lockedRes.independent : (lockedRes as RouteAEvaluation);

  if (parameters.model === "locked-cluster") {
    const factorRatio = configurationFactorRatio(1, ratioStr);
    const clusterVolume = configurationVolumeTerm({ Np: 1, V: V_m3, V0: V0_m3, T }, set);
    const clusterDifference = "deltaF" in clusterVolume ? clusterVolume.deltaF : clusterVolume;
    const deltaF: RouteAEvaluation = {
      ...clusterDifference,
      result:
        parameters.volumeRatio === 1 && clusterDifference.result.status === "value"
          ? { ...clusterDifference.result, value: 0 }
          : clusterDifference.result,
      modelIdentity: "locked-cluster",
    };

    const ln = Math.log(parameters.volumeRatio);
    const log10 = ln / Math.LN10;

    return Object.freeze({
      factorRatio,
      deltaF,
      pressure: independentOutside,
      lockedClusterPressure: lockedEval,
      volumeIndependentFactor: {
        quantityId: "freeEnergy",
        unit: "1",
        semanticKind: "volume-independent-integral",
        ownerId: "diffusion.configurationVolumeTerm",
        status: "symbolic" as const,
        expressionRef: "configuration-factor-J",
        unspecifiedSymbols: ["J"],
      },
      momentumIntegrals: {
        quantityId: "freeEnergy",
        unit: "1",
        semanticKind: "momentum-integrals-factor",
        ownerId: "diffusion.configurationVolumeTerm",
        status: "symbolic" as const,
        expressionRef: "momentum-integrals",
        unspecifiedSymbols: ["p"],
      },
      freeEnergyOffset: {
        quantityId: "freeEnergy",
        unit: "J",
        semanticKind: "constant-free-energy-offset",
        ownerId: "diffusion.configurationVolumeTerm",
        status: "symbolic" as const,
        expressionRef: "free-energy-offset",
        unspecifiedSymbols: ["F0"],
      },
      log10Exponent: log10,
      naturalLogExponent: ln,
      ...("decimal" in factorRatio && factorRatio.decimal !== undefined
        ? { exactDecimalString: factorRatio.decimal }
        : {}),
    });
  }

  // Independent particles model
  const termRes = configurationVolumeTerm({ Np, V: V_m3, V0: V0_m3, T }, set);
  const factorRatio = configurationFactorRatio(Np, ratioStr);

  const deltaF: RouteAEvaluation =
    "deltaF" in termRes
      ? parameters.volumeRatio === 1
        ? {
            ...termRes.deltaF,
            result: { ...termRes.deltaF.result, status: "value", value: 0 },
          }
        : termRes.deltaF
      : (termRes as RouteAEvaluation);

  const pressure: RouteAEvaluation =
    "pressure" in termRes ? termRes.pressure : (termRes as RouteAEvaluation);

  const volumeIndependentFactor: PublishedResult =
    "volumeIndependentFactor" in termRes
      ? (termRes.volumeIndependentFactor as PublishedResult)
      : {
          quantityId: "freeEnergy",
          unit: "1",
          semanticKind: "volume-independent-integral",
          ownerId: "diffusion.configurationVolumeTerm",
          status: "symbolic" as const,
          expressionRef: "configuration-factor-J",
          unspecifiedSymbols: ["J"],
        };

  const momentumIntegrals: PublishedResult =
    "momentumIntegrals" in termRes
      ? (termRes.momentumIntegrals as PublishedResult)
      : {
          quantityId: "freeEnergy",
          unit: "1",
          semanticKind: "momentum-integrals-factor",
          ownerId: "diffusion.configurationVolumeTerm",
          status: "symbolic" as const,
          expressionRef: "momentum-integrals",
          unspecifiedSymbols: ["p"],
        };

  const freeEnergyOffset: PublishedResult =
    "freeEnergyOffset" in termRes
      ? (termRes.freeEnergyOffset as PublishedResult)
      : {
          quantityId: "freeEnergy",
          unit: "J",
          semanticKind: "constant-free-energy-offset",
          ownerId: "diffusion.configurationVolumeTerm",
          status: "symbolic" as const,
          expressionRef: "free-energy-offset",
          unspecifiedSymbols: ["F0"],
        };

  const ln = "ln" in factorRatio ? factorRatio.ln : Np * Math.log(parameters.volumeRatio);
  const log10 = "log10" in factorRatio ? factorRatio.log10 : ln / Math.LN10;

  return Object.freeze({
    factorRatio,
    deltaF,
    pressure,
    lockedClusterPressure: lockedEval,
    volumeIndependentFactor,
    momentumIntegrals,
    freeEnergyOffset,
    log10Exponent: log10,
    naturalLogExponent: ln,
    ...("decimal" in factorRatio && factorRatio.decimal !== undefined
      ? { exactDecimalString: factorRatio.decimal }
      : {}),
  });
}

export type PreparedBm03Example = Readonly<{
  parameters: Bm03Parameters;
  evaluation: Bm03Evaluation;
  sourceDigest: string;
}>;

export function buildBm03Snapshot(
  instanceId: string,
  runId: string,
  parameters: Bm03Parameters,
  inputRevision = 1,
  actionIndex = 0,
  parentRunId: string | null = null,
): AcceptedSnapshot {
  const evaluation = evaluateBm03(parameters);
  return snapshotFromEvaluation(
    instanceId,
    runId,
    parameters,
    inputRevision,
    actionIndex,
    parentRunId,
    evaluation,
  );
}

function snapshotFromEvaluation(
  instanceId: string,
  runId: string,
  parameters: Bm03Parameters,
  inputRevision: number,
  actionIndex: number,
  parentRunId: string | null,
  evaluation: Bm03Evaluation,
): AcceptedSnapshot {
  function publish(id: keyof typeof BM03_OUTPUTS, result: PublishedResult): PublishedResult {
    const contract = BM03_OUTPUTS[id];
    return Object.freeze({
      ...result,
      quantityId: id,
      unit: contract.unit,
      semanticKind: contract.semanticKind,
      ownerId: contract.ownerId,
    });
  }
  const ratio = evaluation.factorRatio;
  const factorIdentity = {
    quantityId: "factorRatio",
    unit: "1",
    semanticKind: "volume-arrangement-ratio",
    ownerId: "diffusion.configurationFactorRatio",
  };
  const factorResult: PublishedResult =
    "representableDouble" in ratio
      ? ratio.representableDouble !== null
        ? { ...factorIdentity, status: "value", value: ratio.representableDouble }
        : {
            ...factorIdentity,
            status: "outside-domain",
            condition: "binary64-range",
            domainKind: "numerical",
            reason:
              "The arrangement ratio cannot be represented as a normal finite binary64 number; its separately labelled logarithms remain available.",
            boundary: {
              alternativeModel:
                "Use the logarithmic representation of the same configuration model.",
            },
          }
      : ratio.result;

  const outputs: PublishedResult[] = [
    publish("factorRatio", factorResult),
    publish("logFactorRatio", {
      ...factorIdentity,
      status: "value",
      value: evaluation.naturalLogExponent,
    }),
    publish("log10FactorRatio", {
      ...factorIdentity,
      status: "value",
      value: evaluation.log10Exponent,
    }),
    publish("deltaF", evaluation.deltaF.result),
    publish("pressure", evaluation.pressure.result),
    publish("lockedClusterPressure", evaluation.lockedClusterPressure.result),
    publish("volumeIndependentFactor", evaluation.volumeIndependentFactor),
    publish("momentumIntegrals", evaluation.momentumIntegrals),
    publish("freeEnergyOffset", evaluation.freeEnergyOffset),
  ];

  return Object.freeze({
    experimentId: "bm-03",
    instanceId,
    runId,
    parentRunId,
    actionIndex,
    revisions: {
      input: inputRevision,
      observer: 0,
      measurement: 0,
      estimator: 0,
    },
    parameters: Object.freeze({ ...parameters }),
    stepIndex: 0,
    simulationTime: 0,
    final: true,
    snapshotVersion: inputRevision,
    outputs: Object.freeze(outputs),
  });
}

export function createBm03Session(
  instanceId = "bm03-default",
  initialParameters: Bm03Parameters = BM03_DEFAULTS,
) {
  let currentParams = { ...initialParameters };
  let currentRunId = `${instanceId}/run/1`;
  let parentRunId: string | null = null;
  let inputRevision = 1;
  let actionIndex = 0;
  let evaluation = evaluateBm03(currentParams);
  let acceptedSnapshot = snapshotFromEvaluation(
    instanceId,
    currentRunId,
    currentParams,
    inputRevision,
    actionIndex,
    parentRunId,
    evaluation,
  );

  const listeners = new Set<() => void>();

  function notify() {
    for (const listener of listeners) listener();
  }

  let view: Bm03ExperimentView = {
    status: "accepted",
    pending: false,
    requested: {
      experimentId: "bm-03",
      instanceId,
      runId: currentRunId,
      parentRunId,
      actionIndex,
      revisions: { input: inputRevision, observer: 0, measurement: 0, estimator: 0 },
      parameters: currentParams,
    },
    accepted: acceptedSnapshot,
    evaluation,
    refusal: null,
    outcome: null,
  };

  const serverView = view;

  function apply(input: unknown, newRun = false) {
    const validated = validateBm03Parameters(input);
    if (validated.kind === "refused") {
      view = {
        ...view,
        status: "refused",
        refusal: validated.refusal,
      };
      notify();
      return validated;
    }

    if (validated.kind !== "accepted") return validated;
    const parameters = validated.data;
    actionIndex++;
    const isSetupChange =
      currentParams.Np !== parameters.Np ||
      currentParams.volumeRatio !== parameters.volumeRatio ||
      currentParams.V0 !== parameters.V0 ||
      currentParams.T !== parameters.T ||
      currentParams.model !== parameters.model;

    if (newRun || isSetupChange) {
      parentRunId = currentRunId;
      inputRevision++;
      currentRunId = `${instanceId}/run/${inputRevision}`;
    }

    // Presentation changes reuse the accepted calculation; editing a draft never evaluates it.
    if (isSetupChange) evaluation = evaluateBm03(parameters);
    currentParams = { ...parameters };
    acceptedSnapshot = snapshotFromEvaluation(
      instanceId,
      currentRunId,
      currentParams,
      inputRevision,
      actionIndex,
      parentRunId,
      evaluation,
    );

    const requestedToken: RequestToken = {
      experimentId: "bm-03",
      instanceId,
      runId: currentRunId,
      parentRunId,
      actionIndex,
      revisions: { input: inputRevision, observer: 0, measurement: 0, estimator: 0 },
      parameters: currentParams,
    };

    view = {
      status: "accepted",
      pending: false,
      requested: requestedToken,
      accepted: acceptedSnapshot,
      evaluation,
      refusal: null,
      outcome: null,
    };

    notify();
    return { kind: "accepted" as const, data: currentParams };
  }

  return {
    subscribe(callback: () => void) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    getSnapshot(): Bm03ExperimentView {
      return view;
    },
    // The view the page was built with, frozen, as React's server snapshot must be and as BM-08's
    // is. It returned the live view, so ConfigurationLab's "is this still the build's example"
    // identity test held for every accepted run, and the badge read "Static worked example" over
    // results computed from the reader's own settings (measured on live after 0ed262bc).
    getServerSnapshot(): Bm03ExperimentView {
      return serverView;
    },
    acceptedParameters(): Bm03Parameters {
      return currentParams;
    },
    evaluate(params: Bm03Parameters) {
      return evaluateBm03(params);
    },
    apply: (input: unknown) => apply(input),
    startNewRun: (input: unknown) => apply(input, true),
    stop() {
      // Synchronous calculation, no-op
    },
    disconnect() {
      listeners.clear();
    },
    defaults: BM03_DEFAULTS,
  };
}
