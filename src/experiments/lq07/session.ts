import {
  type FluorescenceBudgetResult,
  type FluorescenceRatesResult,
  fluorescenceBudget,
  fluorescenceRates,
} from "../../physics/reference/photoelectric.ts";
import type { AcceptedSnapshot, ExperimentView, PublishedResult } from "../store/instanceStore.ts";
import { LQ07_DEFAULTS, type Lq07Parameters } from "./definition.ts";
import { validateLq07Parameters } from "./parameters.ts";

export type Lq07Evaluation = Readonly<{
  budget: FluorescenceBudgetResult;
  rates: FluorescenceRatesResult;
  outputs: readonly PublishedResult[];
}>;

export type PreparedLq07Example = Readonly<{
  sourceDigest: string;
  parameters: Lq07Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

export function evaluateLq07(parameters: Lq07Parameters): Lq07Evaluation {
  const nu1Hz = parameters.nu1 * 1e12;
  const nu2Hz = parameters.nu2 * 1e12;
  const absorbedPowerWatts = parameters.absorbedPowerMicrowatts * 1e-6;

  const budget = fluorescenceBudget({
    nu1: nu1Hz,
    nu2: nu2Hz,
    regime: parameters.regime,
    multiQuantumK: parameters.multiQuantumK,
    sourceTemperatureK: parameters.sourceTemperatureK,
    bodyTemperatureK: parameters.bodyTemperatureK,
    channels: parameters.channels,
  });

  const rates = fluorescenceRates({
    nu1: nu1Hz,
    nu2: nu2Hz,
    absorbedPowerWatts,
    quantumYield: parameters.quantumYield,
    regime: parameters.regime,
  });

  const outputs: readonly PublishedResult[] = Object.freeze([
    budget.status === "outside-domain"
      ? {
          quantityId: "allowed",
          unit: "",
          semanticKind: "boolean-verdict",
          ownerId: "photoelectric.fluorescenceBudget",
          status: "outside-domain",
          condition: "outside-wien-domain",
          domainKind: "physical",
          reason: budget.verdictReason,
          boundary: { alternativeModel: "planck-radiation-law" },
        }
      : {
          quantityId: "allowed",
          unit: "",
          semanticKind: "boolean-verdict",
          ownerId: "photoelectric.fluorescenceBudget",
          status: "value",
          value: budget.allowed ? 1 : 0,
        },
    budget.status === "outside-domain"
      ? {
          quantityId: "nu2Max",
          unit: "THz",
          semanticKind: "cyclic-frequency",
          ownerId: "photoelectric.fluorescenceBudget",
          status: "outside-domain",
          condition: "outside-wien-domain",
          domainKind: "physical",
          reason: budget.verdictReason,
          boundary: { alternativeModel: "planck-radiation-law" },
        }
      : {
          quantityId: "nu2Max",
          unit: "THz",
          semanticKind: "cyclic-frequency",
          ownerId: "photoelectric.fluorescenceBudget",
          status: "value",
          value: budget.nu2MaxHz / 1e12,
        },
    {
      quantityId: "e1Ev",
      unit: "eV",
      semanticKind: "energy",
      ownerId: "photoelectric.fluorescenceBudget",
      status: "value",
      value: budget.e1Ev,
    },
    {
      quantityId: "e2Ev",
      unit: "eV",
      semanticKind: "energy",
      ownerId: "photoelectric.fluorescenceBudget",
      status: "value",
      value: budget.e2Ev,
    },
    !budget.allowed
      ? {
          quantityId: "eOtherEv",
          unit: "eV",
          semanticKind: "energy",
          ownerId: "photoelectric.fluorescenceBudget",
          status: "not-applicable",
          reason: "No non-optical channel energy available when transition is disallowed.",
        }
      : {
          quantityId: "eOtherEv",
          unit: "eV",
          semanticKind: "energy",
          ownerId: "photoelectric.fluorescenceBudget",
          status: "value",
          value: budget.eOtherEv,
        },
    {
      quantityId: "energyDeficitEv",
      unit: "eV",
      semanticKind: "energy",
      ownerId: "photoelectric.fluorescenceBudget",
      status: "value",
      value: budget.energyDeficitEv,
    },
    rates.status === "not-applicable"
      ? {
          quantityId: "absorbedRate",
          unit: "s^-1",
          semanticKind: "event-rate",
          ownerId: "photoelectric.fluorescenceRates",
          status: "not-applicable",
          reason: rates.reason ?? "Multi-quantum absorption rate is non-linear.",
        }
      : rates.status === "outside-domain"
        ? {
            quantityId: "absorbedRate",
            unit: "s^-1",
            semanticKind: "event-rate",
            ownerId: "photoelectric.fluorescenceRates",
            status: "outside-domain",
            condition: "invalid-rates-input",
            domainKind: "input",
            reason: rates.reason ?? "Invalid rates input",
            boundary: {
              parameterId: "absorbedPowerMicrowatts",
              value: parameters.absorbedPowerMicrowatts,
            },
          }
        : {
            quantityId: "absorbedRate",
            unit: "s^-1",
            semanticKind: "event-rate",
            ownerId: "photoelectric.fluorescenceRates",
            status: "value",
            value: rates.absorbedRatePerSecond,
          },
    rates.status === "not-applicable"
      ? {
          quantityId: "emittedRate",
          unit: "s^-1",
          semanticKind: "event-rate",
          ownerId: "photoelectric.fluorescenceRates",
          status: "not-applicable",
          reason: rates.reason ?? "Multi-quantum emission rate is non-linear.",
        }
      : rates.status === "outside-domain"
        ? {
            quantityId: "emittedRate",
            unit: "s^-1",
            semanticKind: "event-rate",
            ownerId: "photoelectric.fluorescenceRates",
            status: "outside-domain",
            condition: "invalid-rates-input",
            domainKind: "input",
            reason: rates.reason ?? "Invalid rates input",
            boundary: {
              parameterId: "absorbedPowerMicrowatts",
              value: parameters.absorbedPowerMicrowatts,
            },
          }
        : {
            quantityId: "emittedRate",
            unit: "s^-1",
            semanticKind: "event-rate",
            ownerId: "photoelectric.fluorescenceRates",
            status: "value",
            value: rates.emittedRatePerSecond,
          },
    rates.status === "not-applicable"
      ? {
          quantityId: "emittedPowerWatts",
          unit: "W",
          semanticKind: "power",
          ownerId: "photoelectric.fluorescenceRates",
          status: "not-applicable",
          reason: rates.reason ?? "Multi-quantum emitted power is non-linear.",
        }
      : rates.status === "outside-domain"
        ? {
            quantityId: "emittedPowerWatts",
            unit: "W",
            semanticKind: "power",
            ownerId: "photoelectric.fluorescenceRates",
            status: "outside-domain",
            condition: "invalid-rates-input",
            domainKind: "input",
            reason: rates.reason ?? "Invalid rates input",
            boundary: {
              parameterId: "absorbedPowerMicrowatts",
              value: parameters.absorbedPowerMicrowatts,
            },
          }
        : {
            quantityId: "emittedPowerWatts",
            unit: "W",
            semanticKind: "power",
            ownerId: "photoelectric.fluorescenceRates",
            status: "value",
            value: rates.emittedPowerWatts,
          },
    rates.status === "not-applicable"
      ? {
          quantityId: "dissipatedHeatWatts",
          unit: "W",
          semanticKind: "power",
          ownerId: "photoelectric.fluorescenceRates",
          status: "not-applicable",
          reason: rates.reason ?? "Multi-quantum dissipated heat is non-linear.",
        }
      : rates.status === "outside-domain"
        ? {
            quantityId: "dissipatedHeatWatts",
            unit: "W",
            semanticKind: "power",
            ownerId: "photoelectric.fluorescenceRates",
            status: "outside-domain",
            condition: "invalid-rates-input",
            domainKind: "input",
            reason: rates.reason ?? "Invalid rates input",
            boundary: {
              parameterId: "absorbedPowerMicrowatts",
              value: parameters.absorbedPowerMicrowatts,
            },
          }
        : {
            quantityId: "dissipatedHeatWatts",
            unit: "W",
            semanticKind: "power",
            ownerId: "photoelectric.fluorescenceRates",
            status: "value",
            value: rates.dissipatedHeatWatts,
          },
  ]);

  return Object.freeze({
    budget,
    rates,
    outputs,
  });
}

export function buildLq07Snapshot(
  instanceId: string,
  runId: string,
  parentRunId: string | null,
  parameters: Lq07Parameters,
  inputRevision: number,
  actionIndex: number,
): AcceptedSnapshot {
  const evalResult = evaluateLq07(parameters);
  return Object.freeze({
    experimentId: "lq-07",
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

export function createLq07Session(
  instanceId: string,
  initialParameters: Lq07Parameters = LQ07_DEFAULTS,
) {
  let currentParams = { ...initialParameters };
  let currentRunId = `${instanceId}/run/1`;
  let parentRunId: string | null = null;
  let inputRevision = 1;
  let actionIndex = 0;
  let acceptedSnapshot = buildLq07Snapshot(
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
      experimentId: "lq-07",
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
    acceptedParameters(): Lq07Parameters {
      return (view.accepted?.parameters ?? currentParams) as Lq07Parameters;
    },
    apply(nextParams: unknown) {
      actionIndex++;
      const computation = validateLq07Parameters(nextParams);
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
        validated.nu1 !== currentParams.nu1 ||
        validated.nu2 !== currentParams.nu2 ||
        validated.regime !== currentParams.regime ||
        validated.multiQuantumK !== currentParams.multiQuantumK ||
        validated.sourceTemperatureK !== currentParams.sourceTemperatureK ||
        validated.bodyTemperatureK !== currentParams.bodyTemperatureK ||
        validated.absorbedPowerMicrowatts !== currentParams.absorbedPowerMicrowatts ||
        validated.quantumYield !== currentParams.quantumYield ||
        validated.channels !== currentParams.channels;

      if (isSetup) {
        parentRunId = currentRunId;
        inputRevision++;
        currentRunId = `${instanceId}/run/${inputRevision}`;
      }

      currentParams = { ...validated };
      acceptedSnapshot = buildLq07Snapshot(
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
          experimentId: "lq-07",
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
