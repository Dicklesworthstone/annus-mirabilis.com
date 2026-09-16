/**
 * LQ-03 session: evaluates the real radiation owner (src/physics/reference/radiation.ts,
 * am-ref-radiation-15c) and assembles an accepted snapshot. Synchronous, closed-form host
 * physics: no worker, matching src/experiments/bm03/session.ts's pattern for the same reason.
 */
import { getConstantSet } from "../../physics/reference/constants.ts";
import {
  planckBandEnergyDensity,
  planckFrequencyEnergyDensity,
  planckPeakFrequency,
  planckPeakLogInterval,
  planckPeakWavelength,
  planckWavelengthBandEnergyDensity,
  planckWavelengthEnergyDensity,
  type RadiationResult,
  type RegimeReport,
  rayleighJeansFrequencyEnergyDensity,
  rayleighJeansWavelengthEnergyDensity,
  regimeRelativeErrors,
  spectralDensityCoordinateTransform,
  wienFrequencyEnergyDensity,
  wienWavelengthEnergyDensity,
} from "../../physics/reference/radiation.ts";
import type {
  AcceptedSnapshot,
  ExperimentView,
  PublishedResult,
  RequestToken,
} from "../store/instanceStore.ts";
import { LQ03_DEFAULTS, type Lq03Parameters } from "./definition.ts";
import { validateLq03Parameters } from "./parameters.ts";

export type Lq03LawDensity = Readonly<{
  frequency: RadiationResult<number>;
  wavelength: RadiationResult<number>;
}>;

export type Lq03Evaluation = Readonly<{
  probeX: number;
  planck: Lq03LawDensity;
  wien: Lq03LawDensity;
  classical: Lq03LawDensity;
  /** The correct Jacobian-transformed wavelength density from the frequency density at the
   * probe point, and the naive substitution that omits the Jacobian -- the adversarial fixture
   * this bead names: relabeling the axis does not preserve density. */
  coordinateTransform: Readonly<{
    lambdaAtProbe: number;
    jacobian: number;
    correctWavelengthDensity: number;
    naiveWavelengthDensity: number;
  }>;
  bandEnergyFromFrequency: RadiationResult<number>;
  bandEnergyFromWavelength: RadiationResult<number>;
  peakFrequency: RadiationResult<number>;
  peakWavelength: RadiationResult<number>;
  peakLogInterval: Readonly<{ x: number; peakFrequency: number; peakWavelength: number }>;
  /** c / lambda_peak, shown beside peakFrequency so the mismatch is visible rather than implied. */
  frequencyFromPeakWavelength: number | null;
  regime: RegimeReport;
}>;

export function evaluateLq03(p: Lq03Parameters): Lq03Evaluation {
  // modern-si-2019 only, per this pass's scope: historical evaluation under
  // einstein-1905-light-quanta-printed is not implemented here (see BATCH_PENDING).
  const set = getConstantSet("modern-si-2019");
  const c = 299792458;
  const lambdaAtProbe = c / p.probeNu;

  const planckAtProbe = planckFrequencyEnergyDensity(p.probeNu, p.T, set);
  const naiveWavelengthDensity =
    planckAtProbe.status === "value" && planckAtProbe.linearRepresentable
      ? planckAtProbe.value
      : Number.NaN;
  const transform =
    planckAtProbe.status === "value" && planckAtProbe.linearRepresentable
      ? spectralDensityCoordinateTransform(planckAtProbe.value, p.probeNu, set)
      : { wavelength: lambdaAtProbe, jacobian: (p.probeNu * p.probeNu) / c, uLambda: Number.NaN };

  const peakFrequency = planckPeakFrequency(p.T, set);
  const peakWavelength = planckPeakWavelength(p.T, set);
  const peakLogInterval = planckPeakLogInterval(p.T, set);

  return Object.freeze({
    probeX: (6.62607015e-34 * p.probeNu) / (1.380649e-23 * p.T),
    planck: Object.freeze({
      frequency: planckFrequencyEnergyDensity(p.probeNu, p.T, set),
      wavelength: planckWavelengthEnergyDensity(lambdaAtProbe, p.T, set),
    }),
    wien: Object.freeze({
      frequency: wienFrequencyEnergyDensity(p.probeNu, p.T, set),
      wavelength: wienWavelengthEnergyDensity(lambdaAtProbe, p.T, set),
    }),
    classical: Object.freeze({
      frequency: rayleighJeansFrequencyEnergyDensity(p.probeNu, p.T, set),
      wavelength: rayleighJeansWavelengthEnergyDensity(lambdaAtProbe, p.T, set),
    }),
    coordinateTransform: Object.freeze({
      lambdaAtProbe,
      jacobian: transform.jacobian,
      correctWavelengthDensity: transform.uLambda,
      naiveWavelengthDensity,
    }),
    bandEnergyFromFrequency: planckBandEnergyDensity(p.nu1, p.nu2, p.T, set),
    bandEnergyFromWavelength: planckWavelengthBandEnergyDensity(c / p.nu2, c / p.nu1, p.T, set),
    peakFrequency,
    peakWavelength,
    peakLogInterval,
    frequencyFromPeakWavelength:
      peakWavelength.status === "value" ? c / peakWavelength.value : null,
    regime: regimeRelativeErrors(p.probeNu, p.T, set, {
      epsilonW: p.epsilon,
      epsilonRJ: p.epsilon,
    }),
  });
}

export type PreparedLq03Example = Readonly<{
  parameters: Lq03Parameters;
  evaluation: Lq03Evaluation;
  sourceDigest: string;
}>;

function toPublished(
  id: string,
  unit: string,
  semanticKind: string,
  ownerId: string,
  result: RadiationResult<number>,
): PublishedResult {
  if (result.status === "value") {
    return {
      quantityId: id,
      unit,
      semanticKind,
      ownerId,
      status: "value",
      value: result.linearRepresentable
        ? result.value
        : (result.logFrequencyEnergyDensity ?? result.logWavelengthEnergyDensity ?? 0),
    };
  }
  return {
    quantityId: id,
    unit,
    semanticKind,
    ownerId,
    status: "outside-domain",
    condition: result.status === "outside-domain" ? result.condition : "unavailable",
    domainKind: result.status === "outside-domain" ? result.domainKind : "numerical",
    reason:
      result.status === "outside-domain" ? result.reason : "This result is not a finite value.",
    boundary: { alternativeModel: "Choose inputs within the stated domain." },
  };
}

export function buildLq03Snapshot(
  instanceId: string,
  runId: string,
  parameters: Lq03Parameters,
  inputRevision = 1,
  actionIndex = 0,
): AcceptedSnapshot {
  const evaluation = evaluateLq03(parameters);
  const outputs: PublishedResult[] = [
    toPublished(
      "frequencyEnergyDensity",
      "J/(m^3 Hz)",
      "spectral-energy-density-frequency",
      "radiation.spectra",
      evaluation.planck.frequency,
    ),
    toPublished(
      "bandEnergy",
      "J/m^3",
      "band-radiant-energy-density",
      "radiation.bandIntegration",
      evaluation.bandEnergyFromFrequency,
    ),
    toPublished(
      "peakFrequency",
      "Hz",
      "spectral-peak-frequency",
      "radiation.spectra",
      evaluation.peakFrequency,
    ),
    toPublished(
      "peakWavelength",
      "m",
      "spectral-peak-wavelength",
      "radiation.spectra",
      evaluation.peakWavelength,
    ),
  ];
  return Object.freeze({
    experimentId: "lq-03",
    instanceId,
    runId,
    parentRunId: null,
    actionIndex,
    revisions: { input: inputRevision, observer: 0, measurement: 0, estimator: 0 },
    parameters: Object.freeze({ ...parameters }),
    stepIndex: 0,
    simulationTime: 0,
    final: true,
    snapshotVersion: inputRevision,
    outputs: Object.freeze(outputs),
  });
}

export function createLq03Session(
  instanceId = "lq03-default",
  initialParameters: Lq03Parameters = LQ03_DEFAULTS,
) {
  let currentParams = { ...initialParameters };
  let currentRunId = `run-${Date.now()}`;
  let inputRevision = 1;
  let actionIndex = 0;
  let acceptedSnapshot = buildLq03Snapshot(
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
      experimentId: "lq-03",
      instanceId,
      runId: currentRunId,
      parentRunId: null,
      actionIndex,
      revisions: { input: inputRevision, observer: 0, measurement: 0, estimator: 0 },
      parameters: currentParams,
    } as RequestToken,
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
    acceptedParameters(): Lq03Parameters {
      return currentParams;
    },
    evaluate(params: Lq03Parameters) {
      return evaluateLq03(params);
    },
    apply(parameters: unknown) {
      const validated = validateLq03Parameters(parameters);
      if (validated.kind !== "accepted") {
        if (validated.kind === "refused") {
          view = { ...view, status: "refused", refusal: validated.refusal };
          notify();
        }
        return validated;
      }
      actionIndex++;
      const isSetupChange = currentParams.T !== validated.data.T;
      if (isSetupChange) {
        inputRevision++;
        currentRunId = `run-${Date.now()}-${actionIndex}`;
      }
      currentParams = { ...validated.data };
      acceptedSnapshot = buildLq03Snapshot(
        instanceId,
        currentRunId,
        currentParams,
        inputRevision,
        actionIndex,
      );
      view = {
        status: "accepted",
        pending: false,
        requested: {
          experimentId: "lq-03",
          instanceId,
          runId: currentRunId,
          parentRunId: null,
          actionIndex,
          revisions: { input: inputRevision, observer: 0, measurement: 0, estimator: 0 },
          parameters: currentParams,
        } as RequestToken,
        accepted: acceptedSnapshot,
        refusal: null,
        outcome: null,
      };
      notify();
      return { kind: "accepted" as const, data: currentParams };
    },
    stop() {
      // Synchronous calculation, no-op.
    },
    disconnect() {
      listeners.clear();
    },
    defaults: LQ03_DEFAULTS,
  };
}
