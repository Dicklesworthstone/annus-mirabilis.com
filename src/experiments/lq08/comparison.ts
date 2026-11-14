import type { Baseline, ComparisonIdentity, ComparisonSnapshot } from "../compare/Baseline.ts";
import type { ComparisonResult } from "../compare/compatibility.ts";
import { comparisonReason } from "../compare/resultEvidence.ts";
import {
  type ComparisonContract,
  type ComparisonInput,
  singleVariationLock,
} from "../compare/singleVariationLock.ts";
import { ExperimentRuntimeError } from "../refusal.ts";
import { decodeResult } from "../results/codec.ts";
import type { ScientificResult } from "../results/types.ts";
import { LQ08_CLASSES, LQ08_MODEL, LQ08_OUTPUTS, type Lq08Parameters } from "./definition.ts";
import { validateLq08Parameters } from "./parameters.ts";

const fields: Readonly<Record<keyof Lq08Parameters, readonly [string, string, number]>> = {
  incidentPower: ["Lamp power", "mW", 1e3],
  frequency: ["Frequency ν", "THz", 1e-12],
  workFunction: ["Hypothetical work function Φ", "eV", 1],
  quantumEfficiency: ["Quantum efficiency", "", 1],
  collectorPotential: ["Collector potential", "V", 1],
};

/** One physical input may vary; collection and conversion efficiency stay fixed. */
export const LQ08_COMPARISON: ComparisonContract = Object.freeze({
  experimentId: "lq-08",
  inputs: Object.freeze(
    Object.fromEntries(
      Object.entries(fields).map(([key, [label, unit, displayFactor]]) => [
        key,
        Object.freeze({
          label,
          unit,
          displayFactor,
          command:
            LQ08_CLASSES[key as keyof Lq08Parameters] === "measurement"
              ? "measurement-change"
              : "setup-change",
          comparable: ["incidentPower", "frequency", "workFunction"].includes(key),
        } satisfies ComparisonInput),
      ]),
    ),
  ),
  outputs: Object.freeze([
    Object.freeze({
      id: "quantumEnergy",
      label: "Energy per quantum at the selected frequency",
      displayUnit: "eV",
      displayFactor: 1 / 1.602176634e-19,
    }),
    Object.freeze({
      id: "thresholdFrequency",
      label: "Threshold frequency",
      displayUnit: "THz",
      displayFactor: 1e-12,
    }),
    Object.freeze({
      id: "maxKineticEnergy",
      label: "Largest electron energy, when emission is allowed",
      displayUnit: "eV",
      displayFactor: 1 / 1.602176634e-19,
    }),
    Object.freeze({
      id: "stoppingPotentialMagnitude",
      label: "Stopping potential, when emission is allowed",
      displayUnit: "V",
      displayFactor: 1,
    }),
    Object.freeze({
      id: "quantumRate",
      label: "Quanta arriving each second",
      displayUnit: "s⁻¹",
      displayFactor: 1,
    }),
    Object.freeze({
      id: "emissionRate",
      label: "Electrons freed each second",
      displayUnit: "s⁻¹",
      displayFactor: 1,
    }),
    Object.freeze({
      id: "photocurrent",
      label: "Current at the fixed collector potential",
      displayUnit: "μA",
      displayFactor: 1e6,
    }),
  ]),
});

export function refuseLq08Comparison(message: string): never {
  throw new ExperimentRuntimeError("photoelectric-comparison-evidence", message, "lq-08");
}

/** A deterministic host calculation, identified by the existing generated evaluator digest. */
export function lq08ComparisonIdentity(
  source: Readonly<{ sourceDigest: string }>,
): ComparisonIdentity {
  if (!/^source:sha256:[a-f0-9]{64}$/u.test(source.sourceDigest))
    refuseLq08Comparison("The comparison needs the photoelectric evaluator's identified source.");
  return Object.freeze({
    modelVersion: LQ08_MODEL.id,
    constantSetId: LQ08_MODEL.constantSetId,
    streamVersion: "deterministic",
    allocationId: "deterministic",
    sourceDigest: source.sourceDigest,
    artifactDigest: null,
    executionLabel: "host-calculation",
  });
}

export function lq08ComparisonParameters(input: unknown): Lq08Parameters {
  const checked = validateLq08Parameters(input);
  if (checked.kind !== "accepted")
    refuseLq08Comparison("Use valid, complete photoelectric settings for a comparison.");
  return checked.data;
}

function acceptedEvidence(id: string, value: unknown): ScientificResult {
  const output = decodeResult(value);
  const contract = LQ08_OUTPUTS[id];
  if (
    !contract ||
    output.quantityId !== id ||
    output.unit !== contract.unit ||
    output.semanticKind !== contract.semanticKind ||
    output.ownerId !== contract.ownerId ||
    !contract.statuses.includes(output.status) ||
    (output.status === "value" &&
      (typeof output.value !== "number" || !Number.isFinite(output.value)))
  ) {
    refuseLq08Comparison("The photoelectric result is missing or misidentifies " + id + ".");
  }
  return output;
}

function acceptedSnapshot(snapshot: ComparisonSnapshot): void {
  if (snapshot.experimentId !== "lq-08" || !snapshot.final)
    refuseLq08Comparison("Use a completed result from the photoelectric apparatus.");
  const parameters = lq08ComparisonParameters(snapshot.parameters);
  for (const id of Object.keys(LQ08_OUTPUTS)) {
    const matches = snapshot.outputs.filter((output) => output.quantityId === id);
    if (matches.length !== 1)
      refuseLq08Comparison("The accepted photoelectric result needs exactly one " + id + ".");
    const output = acceptedEvidence(id, matches[0]);
    if (
      Object.hasOwn(parameters, id) &&
      (output.status !== "value" ||
        !Object.is(output.value, parameters[id as keyof Lq08Parameters]))
    ) {
      refuseLq08Comparison(
        "The accepted photoelectric inputs do not identify the displayed calculation.",
      );
    }
  }
}

/** Setup changes may branch the run; the fixed measurement and observer cannot change. */
function verifyContinuity(
  baseline: Pick<
    ComparisonSnapshot,
    "instanceId" | "snapshotVersion" | "actionIndex" | "revisions"
  >,
  variant: Pick<ComparisonSnapshot, "instanceId" | "snapshotVersion" | "actionIndex" | "revisions">,
  changedInput: string | null,
): string | null {
  if (
    baseline.instanceId !== variant.instanceId ||
    ["observer", "measurement", "estimator"].some(
      (key) =>
        baseline.revisions[key as "observer" | "measurement" | "estimator"] !==
        variant.revisions[key as "observer" | "measurement" | "estimator"],
    ) ||
    variant.snapshotVersion < baseline.snapshotVersion ||
    variant.actionIndex < baseline.actionIndex ||
    variant.revisions.input < baseline.revisions.input ||
    (changedInput !== null && variant.revisions.input <= baseline.revisions.input)
  ) {
    return "Keep the same apparatus owner, collector setting and efficiency, with a new accepted input revision for the changed setup.";
  }
  return null;
}

/** Validate the bounded saved projection, including its complete nonnumeric owner evidence. */
export function verifyLq08SavedComparison(
  baseline: Baseline,
  variant: Baseline,
  result: ComparisonResult,
): string | null {
  if (result.kind !== "accepted") return result.message;
  try {
    lq08ComparisonParameters(baseline.parameters);
    lq08ComparisonParameters(variant.parameters);
    const variation = singleVariationLock(baseline.parameters, variant.parameters, LQ08_COMPARISON);
    if (variation.kind !== "accepted") return variation.message;
    const continuity = verifyContinuity(baseline, variant, variation.changedInput);
    if (continuity) return continuity;
    for (const { id } of LQ08_COMPARISON.outputs) {
      for (const entry of [baseline, variant]) {
        const output = entry.outputs[id];
        if (!output?.evidence) return "The saved comparison must retain the owner's full evidence.";
        const evidence = acceptedEvidence(id, output.evidence);
        if (
          output.status !== evidence.status ||
          output.unit !== evidence.unit ||
          output.semanticKind !== evidence.semanticKind ||
          (evidence.status === "value"
            ? !Object.is(output.value, evidence.value) || output.reason !== ""
            : output.value !== null || output.reason !== comparisonReason(evidence, evidence))
        ) {
          return "The saved photoelectric readout does not match its scientific evidence.";
        }
      }
    }
    return null;
  } catch {
    return "The saved photoelectric evidence is incomplete or belongs to another scientific owner.";
  }
}

/** Contract and identity checks only; every scientific result comes from evaluateLq08. */
export function verifyLq08Comparison(
  baseline: ComparisonSnapshot,
  variant: ComparisonSnapshot,
  result: ComparisonResult,
): string | null {
  if (result.kind !== "accepted") return result.message;
  try {
    acceptedSnapshot(baseline);
    acceptedSnapshot(variant);
    const variation = singleVariationLock(baseline.parameters, variant.parameters, LQ08_COMPARISON);
    if (variation.kind !== "accepted") return variation.message;
    return verifyContinuity(baseline, variant, variation.changedInput);
  } catch {
    return "The accepted photoelectric evidence is incomplete or misidentified. The previous comparison is unchanged.";
  }
}
