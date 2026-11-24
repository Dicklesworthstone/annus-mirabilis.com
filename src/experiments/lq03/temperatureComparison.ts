import type { ComparisonIdentity, ComparisonSnapshot } from "../compare/Baseline.ts";
import type { ComparisonResult } from "../compare/compatibility.ts";
import { createControlledComparison } from "../compare/controlledComparison.ts";
import {
  type ComparisonContract,
  type ComparisonInput,
  singleVariationLock,
} from "../compare/singleVariationLock.ts";
import { ExperimentRuntimeError } from "../refusal.ts";
import { decodeResult } from "../results/codec.ts";
import {
  LQ03_CLASSES,
  LQ03_MODEL,
  LQ03_OUTPUTS,
  type Lq03Coordinate,
  type Lq03Parameters,
} from "./definition.ts";
import { validateLq03Parameters } from "./parameters.ts";
import { createLq03Session, evaluateLq03Spectrum, type Lq03Spectrum } from "./session.ts";

type Parameters = Lq03Parameters & Required<Pick<Lq03Parameters, "constantSetId">>;

const fields: Readonly<Record<keyof Parameters, readonly [string, string, number]>> = {
  constantSetId: ["Spectral calibration", "", 1],
  T: ["Temperature", "K", 1],
  nu1: ["Lower frequency of the fixed band", "THz", 1e-12],
  nu2: ["Upper frequency of the fixed band", "THz", 1e-12],
  probeNu: ["Probe frequency", "THz", 1e-12],
  epsilon: ["Relative-error tolerance", "%", 100],
  coordinate: ["Pinned horizontal coordinate", "", 1],
  axisScale: ["Pinned axis scale", "", 1],
  convention: ["Pinned density convention", "", 1],
  showPlanck: ["Planck curve in the pinned apparatus", "", 1],
  showWien: ["Wien curve in the pinned apparatus", "", 1],
  showClassical: ["Classical curve in the pinned apparatus", "", 1],
};

/** The complete parameter record is locked; only temperature can create a new physical setup. */
export const LQ03_TEMPERATURE_COMPARISON: ComparisonContract = Object.freeze({
  experimentId: "lq-03",
  inputs: Object.freeze(
    Object.fromEntries(
      Object.entries(fields).map(([key, [label, unit, displayFactor]]) => {
        const kind = LQ03_CLASSES[key as keyof Parameters];
        return [
          key,
          Object.freeze({
            label,
            unit,
            displayFactor,
            command:
              kind === "presentation"
                ? "presentation-change"
                : kind === "measurement"
                  ? "measurement-change"
                  : kind === "estimator"
                    ? "estimator-change"
                    : "setup-change",
            comparable: key === "T",
          } satisfies ComparisonInput),
        ];
      }),
    ),
  ),
  outputs: Object.freeze([
    Object.freeze({
      id: "bandEnergy",
      label: "Planck energy density in the fixed frequency band",
      displayUnit: "J/m³",
      displayFactor: 1,
    }),
    Object.freeze({
      id: "frequencyEnergyDensity",
      label: "Planck density at the fixed probe frequency",
      displayUnit: "J/(m³ Hz)",
      displayFactor: 1,
    }),
    Object.freeze({
      id: "peakFrequency",
      label: "Peak of density per unit frequency, uν",
      displayUnit: "THz",
      displayFactor: 1e-12,
    }),
    Object.freeze({
      id: "peakWavelength",
      label: "Peak of density per unit wavelength, uλ",
      displayUnit: "nm",
      displayFactor: 1e9,
    }),
  ]),
});

function refuse(message: string): never {
  throw new ExperimentRuntimeError("spectrum-comparison-evidence", message, "lq-03");
}

/** Old tapes omit the default constant set; the comparison records its explicit identity. */
export function temperatureComparisonParameters(input: unknown): Parameters {
  const result = validateLq03Parameters(input);
  if (result.kind !== "accepted") refuse("Pin a complete, accepted radiation spectrum.");
  return Object.freeze({
    ...result.data,
    constantSetId: result.data.constantSetId ?? "modern-si-2019",
  });
}

const evidenceIds = [
  ...LQ03_TEMPERATURE_COMPARISON.outputs.map(({ id }) => id),
  "wienRegimeAdmitted",
  "classicalRegimeAdmitted",
];

function acceptedParameters(snapshot: ComparisonSnapshot): Parameters {
  if (snapshot.experimentId !== "lq-03" || !snapshot.final)
    refuse("Pin a completed result from the radiation spectrum laboratory.");
  const parameters = temperatureComparisonParameters(snapshot.parameters);
  for (const id of evidenceIds) {
    const matches = snapshot.outputs.filter((output) => output.quantityId === id);
    if (matches.length !== 1) refuse("The accepted spectrum needs exactly one " + id + ".");
    const output = decodeResult(matches[0]);
    const contract = LQ03_OUTPUTS[id];
    if (
      !contract ||
      output.unit !== contract.unit ||
      output.semanticKind !== contract.semanticKind ||
      output.ownerId !== contract.ownerId ||
      !contract.statuses.includes(output.status) ||
      (output.status === "value" &&
        (typeof output.value !== "number" ||
          !Number.isFinite(output.value) ||
          output.value < 0 ||
          (id.endsWith("RegimeAdmitted") && output.value !== 0 && output.value !== 1)))
    ) {
      refuse("The accepted spectrum misidentifies " + id + ".");
    }
  }
  return parameters;
}

function verify(
  baseline: ComparisonSnapshot,
  variant: ComparisonSnapshot,
  result: ComparisonResult,
): string | null {
  if (result.kind !== "accepted") return result.message;
  try {
    acceptedParameters(baseline);
    acceptedParameters(variant);
    const variation = singleVariationLock(
      baseline.parameters,
      variant.parameters,
      LQ03_TEMPERATURE_COMPARISON,
    );
    if (variation.kind !== "accepted") return variation.message;
    if (
      baseline.instanceId !== variant.instanceId ||
      variant.actionIndex < baseline.actionIndex ||
      variant.snapshotVersion < baseline.snapshotVersion ||
      ["observer", "measurement", "estimator"].some(
        (key) =>
          baseline.revisions[key as "observer" | "measurement" | "estimator"] !==
          variant.revisions[key as "observer" | "measurement" | "estimator"],
      ) ||
      (variation.changedInput === "T" && variant.revisions.input <= baseline.revisions.input)
    ) {
      return "Keep the same spectrum owner and fixed observations, with a new accepted temperature.";
    }
    return null;
  } catch {
    return "The accepted spectrum evidence is incomplete. The previous comparison is unchanged.";
  }
}

/** An independent host owner, opened only by pinning a completed main-laboratory result. */
export function createTemperatureComparison(
  instanceId: string,
  source: ComparisonSnapshot,
  sourceDigest: string,
) {
  const parameters = acceptedParameters(source);
  if (!/^source:sha256:[a-f0-9]{64}$/u.test(sourceDigest))
    refuse("The comparison needs the radiation evaluator's identified source.");
  const identity: ComparisonIdentity = Object.freeze({
    modelVersion: LQ03_MODEL.id,
    constantSetId: parameters.constantSetId,
    sourceDigest,
    artifactDigest: null,
    executionLabel: "host-calculation",
    streamVersion: "deterministic",
    allocationId: "deterministic",
  });
  const owner = createLq03Session(instanceId, parameters);
  const baseline = owner.getSnapshot().accepted;
  if (!baseline) refuse("The spectrum owner could not reconstruct the pinned settings.");
  acceptedParameters(baseline);
  return createControlledComparison(
    {
      getSnapshot: owner.getSnapshot,
      subscribe: owner.subscribe,
      stop: owner.stop,
      disconnect: owner.disconnect,
      apply(input) {
        const outcome = owner.apply(input);
        if (outcome.kind !== "accepted") return outcome;
        const requested = owner.getSnapshot().requested;
        if (!requested) refuse("The spectrum owner did not identify the accepted request.");
        return { kind: "accepted", data: { actionIndex: requested.actionIndex } };
      },
    },
    {
      contract: LQ03_TEMPERATURE_COMPARISON,
      identity,
      baseline,
      variant: baseline,
      initialMessage: "Pinned accepted spectrum; no temperature change yet.",
      verifyAccepted: verify,
    },
  );
}

/**
 * A common display of the two accepted spectra. The radiation owner supplies every density and
 * peak; only the coordinate, density convention and drawing bounds change here. Band integrals,
 * probe settings and accepted calculation identities are not recomputed by a view switch.
 */
export function temperatureComparisonSpectra(
  baseline: Lq03Parameters,
  variant: Lq03Parameters,
  coordinate: Lq03Coordinate,
  axisScale: Lq03Parameters["axisScale"],
): Readonly<{ baseline: Lq03Spectrum; variant: Lq03Spectrum }> {
  const display = {
    coordinate,
    convention: coordinate === "frequency" ? ("per-hz" as const) : ("per-m" as const),
    axisScale,
  };
  const a = evaluateLq03Spectrum({ ...baseline, ...display });
  const b = evaluateLq03Spectrum({ ...variant, ...display });
  const xRange: readonly [number, number] = Object.freeze([
    Math.min(a.xRange[0], b.xRange[0]),
    Math.max(a.xRange[1], b.xRange[1]),
  ]);
  const yRange: readonly [number, number] = Object.freeze([
    Math.min(a.yRange[0], b.yRange[0]),
    Math.max(a.yRange[1], b.yRange[1]),
  ]);
  const yDecades: number[] = [];
  if (axisScale === "logarithmic") {
    const stride = Math.max(1, Math.ceil((yRange[1] - yRange[0]) / 6));
    for (let e = Math.ceil(yRange[0]); e <= Math.floor(yRange[1]); e += stride)
      yDecades.push(e);
  }
  const axes = {
    xRange,
    yRange,
    xLinearTicks:
      axisScale === "linear"
        ? Object.freeze([1, 2, 3].map((k) => (k * xRange[1]) / 4))
        : Object.freeze([]),
    yDecades: Object.freeze(yDecades),
  };
  return Object.freeze({
    baseline: Object.freeze({ ...a, ...axes }),
    variant: Object.freeze({ ...b, ...axes }),
  });
}
