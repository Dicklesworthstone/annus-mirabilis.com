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
import { BM03_DEFAULTS, type Bm03Parameters } from "./definition.ts";
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
    const kT =
      (set.id === "modern-si-2019" ? 1.380649e-23 : 8.31446261815324e7 / 6.02214076e23) * T;
    const deltaFVal = -kT * Math.log(parameters.volumeRatio);
    const deltaF: RouteAEvaluation = {
      result: {
        quantityId: "freeEnergy",
        unit: "J",
        semanticKind: "configurational-free-energy",
        ownerId: "diffusion.configurationVolumeTerm",
        status: "value",
        value: parameters.volumeRatio === 1 ? 0 : deltaFVal,
      },
      constantSetId: set.id,
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
): AcceptedSnapshot {
  const evaluation = evaluateBm03(parameters);

  const outputs: PublishedResult[] = [
    {
      quantityId: "volumeRatio",
      unit: "1",
      semanticKind: "volume-arrangement-ratio",
      ownerId: "diffusion.configurationFactorRatio",
      status: "value",
      value:
        "representableDouble" in evaluation.factorRatio &&
        evaluation.factorRatio.representableDouble !== null
          ? evaluation.factorRatio.representableDouble
          : evaluation.exactDecimalString !== undefined
            ? Number(evaluation.exactDecimalString)
            : evaluation.log10Exponent,
    },
    evaluation.deltaF.result as PublishedResult,
    evaluation.pressure.result as PublishedResult,
    evaluation.lockedClusterPressure.result as PublishedResult,
    evaluation.volumeIndependentFactor,
    evaluation.momentumIntegrals,
    evaluation.freeEnergyOffset,
  ];

  return Object.freeze({
    experimentId: "bm-03",
    instanceId,
    runId,
    parentRunId: null,
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
  let currentRunId = `run-${Date.now()}`;
  let inputRevision = 1;
  let actionIndex = 0;
  let acceptedSnapshot = buildBm03Snapshot(
    instanceId,
    currentRunId,
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
      experimentId: "bm-03",
      instanceId,
      runId: currentRunId,
      parentRunId: null,
      actionIndex,
      revisions: { input: inputRevision, observer: 0, measurement: 0, estimator: 0 },
      parameters: currentParams,
    },
    accepted: acceptedSnapshot,
    refusal: null,
    outcome: null,
  };

  return {
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
    acceptedParameters(): Bm03Parameters {
      return currentParams;
    },
    evaluate(params: Bm03Parameters) {
      return evaluateBm03(params);
    },
    apply(parameters: Bm03Parameters) {
      const validated = validateBm03Parameters(parameters);
      if (validated.kind === "refused") {
        view = {
          ...view,
          status: "refused",
          refusal: validated.refusal,
        };
        notify();
        return validated;
      }

      actionIndex++;
      const isSetupChange =
        currentParams.Np !== parameters.Np ||
        currentParams.volumeRatio !== parameters.volumeRatio ||
        currentParams.V0 !== parameters.V0 ||
        currentParams.T !== parameters.T ||
        currentParams.model !== parameters.model;

      if (isSetupChange) {
        inputRevision++;
        currentRunId = `run-${Date.now()}-${actionIndex}`;
      }

      currentParams = { ...parameters };
      acceptedSnapshot = buildBm03Snapshot(
        instanceId,
        currentRunId,
        currentParams,
        inputRevision,
        actionIndex,
      );

      const requestedToken: RequestToken = {
        experimentId: "bm-03",
        instanceId,
        runId: currentRunId,
        parentRunId: null,
        actionIndex,
        revisions: { input: inputRevision, observer: 0, measurement: 0, estimator: 0 },
        parameters: currentParams,
      };

      view = {
        status: "accepted",
        pending: false,
        requested: requestedToken,
        accepted: acceptedSnapshot,
        refusal: null,
        outcome: null,
      };

      notify();
      return { kind: "accepted" as const, data: currentParams };
    },
    stop() {
      // Synchronous calculation, no-op
    },
    disconnect() {
      listeners.clear();
    },
    defaults: BM03_DEFAULTS,
  };
}
