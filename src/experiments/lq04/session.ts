/**
 * LQ-04 session: evaluates the real Wien entropy workbench owner
 * (src/physics/reference/radiation.ts, am-ref-radiation-15c) and assembles an accepted snapshot.
 * Synchronous, closed-form host physics: no worker, matching lq03/session.ts's pattern for the
 * same reason (am-lq-03-spectrum-08vz).
 *
 * A NAMED, VERIFIED OWNER DEFECT, worked around here rather than patched in radiation.ts (not
 * this bead's file; am-ref-radiation-15c owns it): `radiationEntropyVolumeChange`'s returned
 * field named `effectiveIndependentCount` is dimensionally E/(B*nu) -- i.e. kB * [E/(h*nu)],
 * in J/K -- which is exactly what THIS bead calls `entropyVolumeCoefficient`, never the
 * dimensionless E/(h*nu) this bead requires under that name ("E/(h*nu) is a coefficient... it
 * is not rounded to an integer and not called a particle count here... one output never carries
 * two dimensions"). Verified numerically: at the modern golden state the owner's field reads
 * 3.1448...e-13 (J/K, matching kB * 2.277774e10), not 2.277774e10 itself. This module maps that
 * field to `entropyVolumeCoefficient` and computes the true dimensionless `effectiveIndependentCount`
 * independently below, from E and the constant set's own Planck constant.
 */
import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";
import {
  entropyWithUnfixedConstant,
  radiationEntropyVolumeChange,
  type RadiationEntropyVolumeChangeResult,
  regimeRelativeErrors,
  wienFrequencyEnergyDensity,
  wienSpectralEntropyDensity,
} from "../../physics/reference/radiation.ts";
import type {
  AcceptedSnapshot,
  ExperimentView,
  PublishedResult,
  RequestToken,
} from "../store/instanceStore.ts";
import { LQ04_DEFAULTS, type Lq04Parameters } from "./definition.ts";
import { validateLq04Parameters } from "./parameters.ts";

const MAX_DELTA_NU_RATIO = 0.01;
const CONSTANT_SET_ID = "modern-si-2019";

export type Lq04Refusal = Readonly<{
  condition: string;
  domainKind: string;
  reason: string;
}>;

export type Lq04Evaluation =
  | Readonly<{
      status: "value";
      energy: number;
      volume: number;
      referenceVolume: number;
      initialTemperature: number;
      finalTemperature: number;
      initialX: number;
      finalX: number;
      initialPointwiseDeviation: number;
      finalPointwiseDeviation: number;
      initialDilute: boolean;
      finalDilute: boolean;
      initialSpectralEntropyDensity: number;
      finalSpectralEntropyDensity: number;
      /** The owner's closed-form Delta S = (E / (B nu)) ln(V / V0). */
      radiationEntropy: number;
      /** Delta S recomputed as V dNu s(rho_final) - V0 dNu s(rho_initial); must agree with the
       * closed form (this bead's own acceptance criterion). */
      radiationEntropyNumeric: number;
      /** The owner's `effectiveIndependentCount` field, relabeled: this is E/(B*nu), i.e. the
       * coefficient multiplying ln(V/V0), in J/K -- see the module comment above. */
      entropyVolumeCoefficient: number;
      /** The true dimensionless E/(h*nu), computed independently of the owner's mislabeled field. */
      effectiveIndependentCount: number;
      unfixedConstant: Readonly<{
        shown: boolean;
        deltaSWithC: number | null;
        extraTerm: number | null;
      }>;
    }>
  | Readonly<{ status: "outside-domain" } & Lq04Refusal>;

export function evaluateLq04(p: Lq04Parameters): Lq04Evaluation {
  const set = getConstantSet(CONSTANT_SET_ID);
  const rho0Result = wienFrequencyEnergyDensity(p.frequency, p.referenceTemperature, set);
  if (rho0Result.status !== "value" || !rho0Result.linearRepresentable) {
    return {
      status: "outside-domain",
      condition: "reference-density-not-linearly-representable",
      domainKind: "numerical",
      reason: "The reference density at this frequency and temperature is not a finite value.",
    };
  }

  const energy = p.referenceVolume * p.bandwidth * rho0Result.value;
  const volume = p.referenceVolume * p.volumeRatio;
  const epsilonW = Math.exp(-p.diluteThresholdX);

  const result: RadiationEntropyVolumeChangeResult = radiationEntropyVolumeChange(
    { E: energy, nu: p.frequency, dNu: p.bandwidth, V: volume, V0: p.referenceVolume },
    set,
    { epsilonW, maxDeltaNuRatio: MAX_DELTA_NU_RATIO },
  );

  if (result.status === "outside-domain") {
    return {
      status: "outside-domain",
      condition: result.condition,
      domainKind: result.domainKind,
      reason: result.reason,
    };
  }

  const rho1 = energy / (volume * p.bandwidth);
  const s0 = wienSpectralEntropyDensity(rho0Result.value, p.frequency, set);
  const s1 = wienSpectralEntropyDensity(rho1, p.frequency, set);
  if (s0.status !== "value" || s1.status !== "value") {
    return {
      status: "outside-domain",
      condition: "spectral-entropy-density-unavailable",
      domainKind: "numerical",
      reason: "The spectral entropy density could not be evaluated at one of the two states.",
    };
  }

  const initialRegime = regimeRelativeErrors(p.frequency, result.initialTemperature, set, {
    epsilonW,
  });
  const finalRegime = regimeRelativeErrors(p.frequency, result.finalTemperature, set, {
    epsilonW,
  });

  const h = constantValue(set, "planckConstant").value;
  const effectiveIndependentCount = energy / (h * p.frequency);

  const s0Total = p.referenceVolume * p.bandwidth * s0.value;
  const s1Total = volume * p.bandwidth * s1.value;
  const radiationEntropyNumeric = s1Total - s0Total;

  const unfixed = p.showUnfixedConstantPanel
    ? entropyWithUnfixedConstant(
        {
          E: energy,
          nu: p.frequency,
          dNu: p.bandwidth,
          V: volume,
          V0: p.referenceVolume,
          C: p.illustrativeC,
        },
        set,
      )
    : null;

  return {
    status: "value",
    energy,
    volume,
    referenceVolume: p.referenceVolume,
    initialTemperature: result.initialTemperature,
    finalTemperature: result.finalTemperature,
    initialX: result.initialX,
    finalX: result.finalX,
    initialPointwiseDeviation: initialRegime.wienRelativeError,
    finalPointwiseDeviation: finalRegime.wienRelativeError,
    initialDilute: initialRegime.wienAdmitted,
    finalDilute: finalRegime.wienAdmitted,
    initialSpectralEntropyDensity: s0.value,
    finalSpectralEntropyDensity: s1.value,
    radiationEntropy: result.deltaS,
    radiationEntropyNumeric,
    entropyVolumeCoefficient: result.effectiveIndependentCount,
    effectiveIndependentCount,
    unfixedConstant: {
      shown: p.showUnfixedConstantPanel,
      deltaSWithC: unfixed?.deltaSWithC ?? null,
      extraTerm: unfixed?.extraTerm ?? null,
    },
  };
}

function outsideDomainOutput(
  quantityId: string,
  unit: string,
  semanticKind: string,
  ownerId: string,
  refusal: Lq04Refusal,
): PublishedResult {
  return {
    quantityId,
    unit,
    semanticKind,
    ownerId,
    status: "outside-domain",
    condition: refusal.condition,
    domainKind: refusal.domainKind as "physical" | "model" | "numerical" | "input",
    reason: refusal.reason,
    boundary: { alternativeModel: "Choose a volume ratio inside the Wien-dilute domain." },
  };
}

export type PreparedLq04Example = Readonly<{
  sourceDigest: string;
  parameters: Lq04Parameters;
}>;

export function buildLq04Snapshot(
  instanceId: string,
  runId: string,
  parameters: Lq04Parameters,
  inputRevision = 1,
  actionIndex = 0,
): AcceptedSnapshot {
  const evaluation = evaluateLq04(parameters);
  let outputs: PublishedResult[];

  if (evaluation.status === "outside-domain") {
    const refusal: Lq04Refusal = evaluation;
    outputs = [
      outsideDomainOutput(
        "radiationEntropy",
        "J/K",
        "radiation-entropy-change",
        "radiation.entropy",
        refusal,
      ),
    ];
  } else {
    outputs = [
      {
        quantityId: "radiationEnergy",
        unit: "J",
        semanticKind: "radiation-energy",
        ownerId: "lq04.acceptedInputs",
        status: "value",
        value: evaluation.energy,
      },
      {
        quantityId: "initialTemperature",
        unit: "K",
        semanticKind: "wien-temperature",
        ownerId: "radiation.entropy",
        status: "value",
        value: evaluation.initialTemperature,
      },
      {
        quantityId: "finalTemperature",
        unit: "K",
        semanticKind: "wien-temperature",
        ownerId: "radiation.entropy",
        status: "value",
        value: evaluation.finalTemperature,
      },
      {
        quantityId: "initialX",
        unit: "1",
        semanticKind: "wien-dimensionless-ratio",
        ownerId: "radiation.entropy",
        status: "value",
        value: evaluation.initialX,
      },
      {
        quantityId: "finalX",
        unit: "1",
        semanticKind: "wien-dimensionless-ratio",
        ownerId: "radiation.entropy",
        status: "value",
        value: evaluation.finalX,
      },
      {
        quantityId: "initialPointwiseDeviation",
        unit: "1",
        semanticKind: "wien-pointwise-deviation",
        ownerId: "radiation.spectra",
        status: "value",
        value: evaluation.initialPointwiseDeviation,
      },
      {
        quantityId: "finalPointwiseDeviation",
        unit: "1",
        semanticKind: "wien-pointwise-deviation",
        ownerId: "radiation.spectra",
        status: "value",
        value: evaluation.finalPointwiseDeviation,
      },
      {
        quantityId: "initialSpectralEntropyDensity",
        unit: "J/(m^3 Hz K)",
        semanticKind: "spectral-entropy-density",
        ownerId: "radiation.entropy",
        status: "value",
        value: evaluation.initialSpectralEntropyDensity,
      },
      {
        quantityId: "finalSpectralEntropyDensity",
        unit: "J/(m^3 Hz K)",
        semanticKind: "spectral-entropy-density",
        ownerId: "radiation.entropy",
        status: "value",
        value: evaluation.finalSpectralEntropyDensity,
      },
      {
        quantityId: "radiationEntropy",
        unit: "J/K",
        semanticKind: "radiation-entropy-change",
        ownerId: "radiation.entropy",
        status: "value",
        value: evaluation.radiationEntropy,
      },
      {
        quantityId: "radiationEntropyNumeric",
        unit: "J/K",
        semanticKind: "radiation-entropy-change",
        ownerId: "radiation.entropy",
        status: "value",
        value: evaluation.radiationEntropyNumeric,
      },
      {
        quantityId: "entropyVolumeCoefficient",
        unit: "J/K",
        semanticKind: "entropy-volume-coefficient",
        ownerId: "radiation.entropy",
        status: "value",
        value: evaluation.entropyVolumeCoefficient,
      },
      {
        quantityId: "effectiveIndependentCount",
        unit: "1",
        semanticKind: "effective-independent-count",
        ownerId: "lq04.derivedFromEnergyAndPlanckConstant",
        status: "value",
        value: evaluation.effectiveIndependentCount,
      },
      evaluation.unfixedConstant.shown && evaluation.unfixedConstant.deltaSWithC !== null
        ? {
            quantityId: "unfixedConstantDeltaS",
            unit: "J/K",
            semanticKind: "unfixed-constant-entropy-change",
            ownerId: "radiation.entropy",
            status: "value" as const,
            value: evaluation.unfixedConstant.deltaSWithC,
          }
        : {
            quantityId: "unfixedConstantDeltaS",
            unit: "J/K",
            semanticKind: "unfixed-constant-entropy-change",
            ownerId: "radiation.entropy",
            status: "not-applicable" as const,
            reason: "The C(nu) teaching panel is off.",
          },
      evaluation.unfixedConstant.shown && evaluation.unfixedConstant.extraTerm !== null
        ? {
            quantityId: "unfixedConstantExtraTerm",
            unit: "J/K",
            semanticKind: "unfixed-constant-extra-term",
            ownerId: "radiation.entropy",
            status: "value" as const,
            value: evaluation.unfixedConstant.extraTerm,
          }
        : {
            quantityId: "unfixedConstantExtraTerm",
            unit: "J/K",
            semanticKind: "unfixed-constant-extra-term",
            ownerId: "radiation.entropy",
            status: "not-applicable" as const,
            reason: "The C(nu) teaching panel is off.",
          },
    ];
  }

  return Object.freeze({
    experimentId: "lq-04",
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

export function createLq04Session(
  instanceId = "lq04-default",
  initialParameters: Lq04Parameters = LQ04_DEFAULTS,
) {
  let currentParams = { ...initialParameters };
  let currentRunId = `run-${Date.now()}`;
  let inputRevision = 1;
  let actionIndex = 0;
  let acceptedSnapshot = buildLq04Snapshot(
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
      experimentId: "lq-04",
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
    acceptedParameters(): Lq04Parameters {
      return currentParams;
    },
    evaluate(params: Lq04Parameters) {
      return evaluateLq04(params);
    },
    apply(parameters: unknown) {
      const validated = validateLq04Parameters(parameters);
      if (validated.kind !== "accepted") {
        if (validated.kind === "refused") {
          view = { ...view, status: "refused", refusal: validated.refusal };
          notify();
        }
        return validated;
      }

      const evaluation = evaluateLq04(validated.data);

      actionIndex++;
      const isSetupChange =
        currentParams.frequency !== validated.data.frequency ||
        currentParams.bandwidth !== validated.data.bandwidth ||
        currentParams.referenceVolume !== validated.data.referenceVolume ||
        currentParams.referenceTemperature !== validated.data.referenceTemperature;
      if (isSetupChange) {
        inputRevision++;
        currentRunId = `run-${Date.now()}-${actionIndex}`;
      }
      currentParams = { ...validated.data };

      if (evaluation.status === "outside-domain") {
        // The last accepted snapshot stays visible and marked: a refusal never overwrites it.
        acceptedSnapshot = buildLq04Snapshot(
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
            experimentId: "lq-04",
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
      }

      acceptedSnapshot = buildLq04Snapshot(
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
          experimentId: "lq-04",
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
    defaults: LQ04_DEFAULTS,
  };
}
