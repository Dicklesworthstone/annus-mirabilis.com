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
import { ME03_CLASSES, ME03_MODEL, ME03_OUTPUTS, type Me03Parameters } from "./definition.ts";
import { validateMe03Parameters } from "./parameters.ts";

const fields: Readonly<Record<keyof Me03Parameters, readonly [string, string]>> = {
  boundary: ["System boundary", ""],
  disposition: ["Radiation disposition", ""],
  emittedEnergy: ["Energy emitted by the body", "J"],
  inputEnergy: ["External energy input", "J"],
  cardId: ["Context card", ""],
  mode: ["Model", ""],
  pulseSystem: ["Pulse arrangement", ""],
  notation: ["Notation", ""],
  boxMass: ["Box mass (1906 extension, held fixed)", "kg"],
  boxLength: ["Box length (1906 extension, held fixed)", "m"],
  pulseEnergy: ["Pulse energy (1906 extension, held fixed)", "J"],
  assignLightMass: ["Light-mass assignment (1906 extension, held fixed)", ""],
  magnification: ["Drawing magnification", ""],
};

/** Redraw the accounting boundary around one emission; no physical input changes. */
export const ME03_COMPARISON: ComparisonContract = Object.freeze({
  experimentId: "me-03",
  inputs: Object.freeze(
    Object.fromEntries(
      Object.entries(fields).map(([key, [label, unit]]) => [
        key,
        Object.freeze({
          label,
          unit,
          displayFactor: 1,
          command:
            ME03_CLASSES[key as keyof Me03Parameters] === "measurement"
              ? "measurement-change"
              : ME03_CLASSES[key as keyof Me03Parameters] === "presentation"
                ? "presentation-change"
                : "setup-change",
          comparable: key === "boundary",
        } satisfies ComparisonInput),
      ]),
    ),
  ),
  outputs: Object.freeze([
    Object.freeze({
      id: "energyChange",
      label: "Energy change inside the selected boundary",
      displayUnit: "J",
      displayFactor: 1,
    }),
    Object.freeze({
      id: "massChange",
      label: "Mass change for the selected system, when applicable",
      displayUnit: "kg",
      displayFactor: 1,
    }),
    Object.freeze({
      id: "radiationEnergyChange",
      label: "Energy transferred to the emitted radiation",
      displayUnit: "J",
      displayFactor: 1,
    }),
    Object.freeze({
      id: "radiationMassChange",
      label: "Radiation rest-mass change in the 1905 ledger",
      displayUnit: "kg",
      displayFactor: 1,
    }),
    Object.freeze({
      id: "systemEnergyChange",
      label: "Energy change of the body and all emitted radiation",
      displayUnit: "J",
      displayFactor: 1,
    }),
    Object.freeze({
      id: "systemMassChange",
      label: "Mass change of the complete isolated system",
      displayUnit: "kg",
      displayFactor: 1,
    }),
  ]),
});

export function refuseMe03Comparison(message: string): never {
  throw new ExperimentRuntimeError("boundary-comparison-evidence", message, "me-03");
}

export function me03ComparisonIdentity(
  source: Readonly<{ sourceDigest: string }>,
): ComparisonIdentity {
  if (!/^source:sha256:[a-f0-9]{64}$/u.test(source.sourceDigest))
    refuseMe03Comparison("The comparison needs the boundary ledger's identified evaluator.");
  return Object.freeze({
    modelVersion: ME03_MODEL.id,
    constantSetId: ME03_MODEL.constantSetId,
    streamVersion: "deterministic",
    allocationId: "deterministic",
    sourceDigest: source.sourceDigest,
    artifactDigest: null,
    executionLabel: "host-calculation",
  });
}

/** The comparison never repairs a partial record or silently changes the accepted experiment. */
export function me03ComparisonParameters(input: unknown): Me03Parameters {
  const checked = validateMe03Parameters(input);
  if (checked.kind !== "accepted")
    refuseMe03Comparison("Use valid, complete energy-ledger settings for a comparison.");
  if (
    input === null ||
    typeof input !== "object" ||
    Object.keys(input).length !== Object.keys(fields).length ||
    Object.keys(fields).some(
      (key) =>
        !Object.hasOwn(input, key) ||
        !Object.is(
          (input as Record<string, unknown>)[key],
          checked.data[key as keyof Me03Parameters],
        ),
    )
  ) {
    refuseMe03Comparison("Pin the complete accepted settings without replacing any field.");
  }
  if (checked.data.mode !== "1905")
    refuseMe03Comparison("Choose the 1905 energy ledger before comparing system boundaries.");
  if (checked.data.inputEnergy !== 0)
    refuseMe03Comparison(
      "Set external energy input to zero and calculate it first. This comparison follows an isolated emission; external heating is a different experiment.",
    );
  return checked.data;
}

function acceptedEvidence(
  id: string,
  value: unknown,
  parameters: Me03Parameters,
): ScientificResult {
  const output = decodeResult(value);
  const contract = ME03_OUTPUTS[id];
  const expectedStatus =
    id === "radiationMassChange" || (id === "massChange" && parameters.boundary === "radiation")
      ? "not-applicable"
      : "value";
  if (
    !contract ||
    output.quantityId !== id ||
    output.unit !== contract.unit ||
    output.semanticKind !== contract.semanticKind ||
    output.ownerId !== contract.ownerId ||
    output.status !== expectedStatus ||
    (output.status === "value" &&
      (typeof output.value !== "number" || !Number.isFinite(output.value)))
  ) {
    refuseMe03Comparison(`The boundary-ledger result is missing or misidentifies ${id}.`);
  }
  return output;
}

function acceptedSnapshot(snapshot: ComparisonSnapshot): void {
  if (snapshot.experimentId !== "me-03" || !snapshot.final)
    refuseMe03Comparison("Use a completed result from the system-boundary ledger.");
  const parameters = me03ComparisonParameters(snapshot.parameters);
  for (const { id } of ME03_COMPARISON.outputs) {
    const matches = snapshot.outputs.filter((output) => output.quantityId === id);
    if (matches.length !== 1) refuseMe03Comparison(`The accepted ledger needs exactly one ${id}.`);
    acceptedEvidence(id, matches[0], parameters);
  }
}

/** The boundary is a measurement choice; the emission, observer and physical run remain fixed. */
function verifyContinuity(
  baseline: Pick<
    ComparisonSnapshot,
    "instanceId" | "runId" | "snapshotVersion" | "actionIndex" | "revisions"
  >,
  variant: Pick<
    ComparisonSnapshot,
    "instanceId" | "runId" | "snapshotVersion" | "actionIndex" | "revisions"
  >,
  changedInput: string | null,
): string | null {
  if (
    baseline.instanceId !== variant.instanceId ||
    baseline.runId !== variant.runId ||
    ["input", "observer", "estimator"].some(
      (key) =>
        baseline.revisions[key as "input" | "observer" | "estimator"] !==
        variant.revisions[key as "input" | "observer" | "estimator"],
    ) ||
    variant.snapshotVersion < baseline.snapshotVersion ||
    variant.actionIndex < baseline.actionIndex ||
    variant.revisions.measurement < baseline.revisions.measurement ||
    (changedInput !== null && variant.revisions.measurement <= baseline.revisions.measurement)
  ) {
    return "Redrawing the boundary must preserve the same emission and physical run, with a new accepted measurement revision for the changed boundary.";
  }
  return null;
}

const FIXED_READOUTS = [
  "radiationEnergyChange",
  "radiationMassChange",
  "systemEnergyChange",
  "systemMassChange",
] as const;

export function verifyMe03SavedComparison(
  baseline: Baseline,
  variant: Baseline,
  result: ComparisonResult,
): string | null {
  if (result.kind !== "accepted") return result.message;
  try {
    const a = me03ComparisonParameters(baseline.parameters);
    const b = me03ComparisonParameters(variant.parameters);
    const variation = singleVariationLock(baseline.parameters, variant.parameters, ME03_COMPARISON);
    if (variation.kind !== "accepted") return variation.message;
    const continuity = verifyContinuity(baseline, variant, variation.changedInput);
    if (continuity) return continuity;
    for (const { id } of ME03_COMPARISON.outputs) {
      for (const [entry, parameters] of [
        [baseline, a],
        [variant, b],
      ] as const) {
        const output = entry.outputs[id];
        if (!output?.evidence) return "The saved ledger must retain the owner's full evidence.";
        const evidence = acceptedEvidence(id, output.evidence, parameters);
        if (
          output.status !== evidence.status ||
          output.unit !== evidence.unit ||
          output.semanticKind !== evidence.semanticKind ||
          (evidence.status === "value"
            ? !Object.is(output.value, evidence.value) || output.reason !== ""
            : output.value !== null || output.reason !== comparisonReason(evidence, evidence))
        ) {
          return "The saved ledger readout does not match its scientific evidence.";
        }
      }
    }
    for (const id of FIXED_READOUTS) {
      if (
        !Object.is(baseline.outputs[id]?.value, variant.outputs[id]?.value) ||
        baseline.outputs[id]?.reason !== variant.outputs[id]?.reason
      ) {
        return "The radiation and complete-system readouts must still describe the same emission.";
      }
    }
    return null;
  } catch {
    return "The saved boundary-ledger evidence is incomplete or belongs to another scientific owner.";
  }
}

/** Verify identity and conservation of the fixed readouts; the existing owner supplies all values. */
export function verifyMe03Comparison(
  baseline: ComparisonSnapshot,
  variant: ComparisonSnapshot,
  result: ComparisonResult,
): string | null {
  if (result.kind !== "accepted") return result.message;
  try {
    acceptedSnapshot(baseline);
    acceptedSnapshot(variant);
    const variation = singleVariationLock(baseline.parameters, variant.parameters, ME03_COMPARISON);
    if (variation.kind !== "accepted") return variation.message;
    const continuity = verifyContinuity(baseline, variant, variation.changedInput);
    if (continuity) return continuity;
    for (const id of FIXED_READOUTS) {
      const a = baseline.outputs.find((output) => output.quantityId === id);
      const b = variant.outputs.find((output) => output.quantityId === id);
      if (!Object.is(a?.value, b?.value) || a?.reason !== b?.reason)
        return "The radiation and complete-system readouts changed. These are not two boundaries around the same emission.";
    }
    return null;
  } catch {
    return "The accepted boundary-ledger evidence is incomplete or misidentified. The previous comparison is unchanged.";
  }
}
