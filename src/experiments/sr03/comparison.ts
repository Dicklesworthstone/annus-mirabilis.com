import type { ComparisonIdentity, ComparisonSnapshot } from "../compare/Baseline.ts";
import type { ComparisonResult } from "../compare/compatibility.ts";
import {
  type ComparisonContract,
  type ComparisonInput,
  singleVariationLock,
} from "../compare/singleVariationLock.ts";
import { ExperimentRuntimeError } from "../refusal.ts";
import {
  SR03_MODEL,
  SR03_OUTPUTS,
  SR03_PARAMETER_CLASSES,
  type Sr03Parameters,
} from "./definition.ts";
import { validateSr03Parameters } from "./parameters.ts";
import { sr03ReadingsView } from "./readings.ts";

const fields: Readonly<Record<keyof Sr03Parameters, readonly [string, string]>> = {
  rodRestFrame: ["Rod's rest frame", ""],
  v: ["Relative frame speed", "c"],
  L0: ["Proper rod length", "ls"],
  measuringFrame: ["Observer reading the same events", ""],
  endpointPairId: ["Selected event pair", ""],
  R: ["Sphere radius", "ls"],
  customT1: ["First custom event time in K", "s"],
  customX1: ["First custom event position in K", "ls"],
  customT2: ["Second custom event time in K", "s"],
  customX2: ["Second custom event position in K", "ls"],
};

/** Changing v changes this laboratory's physical setup. Only measuringFrame is an observer change. */
export const SR03_COMPARISON: ComparisonContract = Object.freeze({
  experimentId: "sr-03",
  inputs: Object.freeze(
    Object.fromEntries(
      Object.entries(fields).map(([key, [label, unit]]) => [
        key,
        Object.freeze({
          label,
          unit,
          displayFactor: 1,
          command:
            SR03_PARAMETER_CLASSES[key] === "input"
              ? "setup-change"
              : SR03_PARAMETER_CLASSES[key] === "observer"
                ? "observer-change"
                : "measurement-change",
          comparable: key === "measuringFrame",
        } satisfies ComparisonInput),
      ]),
    ),
  ),
  outputs: Object.freeze([
    Object.freeze({
      id: "spatialSeparationK",
      label: "Fixed pair's spatial separation in K",
      displayUnit: "ls",
      displayFactor: 1,
    }),
    Object.freeze({
      id: "temporalSeparationK",
      label: "Fixed pair's time separation in K",
      displayUnit: "s",
      displayFactor: 1,
    }),
    Object.freeze({
      id: "spatialSeparationKPrime",
      label: "Fixed pair's spatial separation in k",
      displayUnit: "ls",
      displayFactor: 1,
    }),
    Object.freeze({
      id: "temporalSeparationKPrime",
      label: "Fixed pair's time separation in k",
      displayUnit: "s",
      displayFactor: 1,
    }),
    Object.freeze({
      id: "measuredLength",
      label: "Distance from these readings at one observer time, when applicable",
      displayUnit: "ls",
      displayFactor: 1,
    }),
    Object.freeze({
      id: "rodLengthK",
      label: "Rod's length using simultaneous readings in K",
      displayUnit: "ls",
      displayFactor: 1,
    }),
    Object.freeze({
      id: "rodLengthKPrime",
      label: "Rod's length using simultaneous readings in k",
      displayUnit: "ls",
      displayFactor: 1,
    }),
    Object.freeze({
      id: "spacetimeIntervalSquared",
      label: "Squared interval (later, Minkowski description)",
      displayUnit: "ls²",
      displayFactor: 1,
    }),
  ]),
});

export function sr03ComparisonIdentity(
  example: Readonly<{ sourceDigest: string }>,
): ComparisonIdentity {
  return Object.freeze({
    modelVersion: SR03_MODEL.id,
    constantSetId: SR03_MODEL.constantSetId,
    streamVersion: "deterministic",
    allocationId: "deterministic",
    sourceDigest: example.sourceDigest,
    artifactDigest: null,
    executionLabel: "host-calculation",
  });
}

function invalid(message: string): never {
  throw new ExperimentRuntimeError("observer-comparison-evidence", message, "sr-03");
}

/** Admit the complete canonical shape and only event selections independent of the observer. */
export function fixedSr03ComparisonParameters(input: unknown): Sr03Parameters {
  const checked = validateSr03Parameters(input);
  if (checked.kind !== "accepted") invalid("Use valid, complete rod and event settings.");
  if (checked.data.endpointPairId === "frame-simultaneous") {
    invalid(
      "The frame-simultaneous choice selects different events for each observer. Choose a fixed event pair to compare descriptions of the same events.",
    );
  }
  return checked.data;
}

function acceptedOutput(snapshot: ComparisonSnapshot, id: string) {
  const output = snapshot.outputs.filter((candidate) => candidate.quantityId === id);
  const item = output[0],
    contract = SR03_OUTPUTS[id];
  if (
    output.length !== 1 ||
    !item ||
    !contract ||
    item.unit !== contract.unit ||
    item.semanticKind !== contract.semanticKind ||
    item.ownerId !== contract.ownerId ||
    (item.status !== "value" && !(id === "measuredLength" && item.status === "not-applicable"))
  ) {
    invalid(`The accepted observer result is missing or misidentifies ${id}.`);
  }
  if (item.status === "value" && (typeof item.value !== "number" || !Number.isFinite(item.value)))
    invalid(`The accepted observer result ${id} is not a finite scalar.`);
  if (item.status === "not-applicable" && (typeof item.reason !== "string" || !item.reason.trim()))
    invalid("An inapplicable distance must retain the owner's explanation.");
  return item;
}

/** Selection and wording only: all distances and times come from the existing accepted owner. */
export function sr03ComparisonReadings(snapshot: ComparisonSnapshot) {
  if (snapshot.experimentId !== "sr-03" || !snapshot.final)
    invalid("Use a completed result from the rod and simultaneity laboratory.");
  const parameters = fixedSr03ComparisonParameters(snapshot.parameters);
  for (const id of Object.keys(SR03_OUTPUTS)) acceptedOutput(snapshot, id);
  return sr03ReadingsView(parameters, snapshot.outputs);
}

/**
 * The owner has no per-event ids. Its fixed pair parameters, physical run and both sets of
 * accepted coordinate differences are the witness here. A frame-simultaneous recipe cannot
 * provide that witness because changing observer reselects its events, so it is refused above.
 */
export function verifySr03Comparison(
  baseline: ComparisonSnapshot,
  variant: ComparisonSnapshot,
  result: ComparisonResult,
): string | null {
  if (result.kind !== "accepted") return result.message;
  try {
    sr03ComparisonReadings(baseline);
    sr03ComparisonReadings(variant);
    const variation = singleVariationLock(baseline.parameters, variant.parameters, SR03_COMPARISON);
    if (variation.kind !== "accepted") return variation.message;
    if (
      baseline.instanceId !== variant.instanceId ||
      baseline.runId !== variant.runId ||
      ["input", "measurement", "estimator"].some(
        (key) =>
          baseline.revisions[key as "input" | "measurement" | "estimator"] !==
          variant.revisions[key as "input" | "measurement" | "estimator"],
      )
    ) {
      return "Changing observer must preserve the physical run, selected event pair and measurement revision.";
    }
    if (
      variation.changedInput !== null &&
      variant.revisions.observer <= baseline.revisions.observer
    )
      return "The changed observer needs its own accepted observer revision.";
    for (const id of Object.keys(SR03_OUTPUTS)) {
      // Only the applicability of a same-time distance is observer-dependent. The owner always
      // publishes BOTH coordinate descriptions, so every other output must remain identical.
      if (id === "measuredLength") continue;
      if (!Object.is(acceptedOutput(baseline, id).value, acceptedOutput(variant, id).value))
        return "The accepted events or physical setup changed. These are not two descriptions of the same fixed pair.";
    }
    return null;
  } catch {
    return "The accepted event evidence is incomplete or the selection changes with the observer. The previous comparison is unchanged.";
  }
}
