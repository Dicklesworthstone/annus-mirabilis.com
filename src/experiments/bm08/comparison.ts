import type { ComparisonSnapshot } from "../compare/Baseline.ts";
import type { ComparisonResult } from "../compare/compatibility.ts";
import type { ComparisonContract, ComparisonInput } from "../compare/singleVariationLock.ts";
import { ExperimentRuntimeError } from "../refusal.ts";
import { BM08_CLASSES, BM08_OUTPUTS, type Bm08Parameters, bm08Layout } from "./definition.ts";

/** Hold the world and all random identities fixed; vary how it is observed or estimated. */
export const BM08_COMPARABLE_INPUTS = [
  "sigma",
  "exposure",
  "dt",
  "stageDrift",
  "M",
  "d",
  "clicks",
  "noiseMethod",
  "coverage",
] as const;
export type Bm08ComparisonInput = (typeof BM08_COMPARABLE_INPUTS)[number];
const fields: Readonly<Record<keyof Bm08Parameters, readonly [string, string, number]>> = {
  seed: ["Physical path seed", "", 1],
  D: ["Generating diffusivity", "μm²/s", 1e12],
  flowDrift: ["Fluid drift", "μm/s", 1e6],
  noiseSeed: ["Camera noise seed", "", 1],
  clickSeed: ["Stationary-click seed", "", 1],
  M: ["Recorded displacements", "", 1],
  d: ["Observed coordinates", "", 1],
  dt: ["Frame spacing", "s", 1],
  exposure: ["Exposure duration", "s", 1],
  sigma: ["Localization standard deviation", "μm", 1e6],
  stageDrift: ["Stage drift in x", "μm/s", 1e6],
  clicks: ["Stationary-feature clicks", "", 1],
  noiseMethod: ["Noise calibration procedure", "", 1],
  coverage: ["Target interval coverage", "%", 100],
  coverageTrials: ["Additional hypothetical experiments", "", 1],
};
export const BM08_COMPARISON: ComparisonContract = Object.freeze({
  experimentId: "bm-08",
  inputs: Object.freeze(
    Object.fromEntries(
      Object.entries(fields).map(([key, [label, unit, displayFactor]]) => {
        const parameter = key as keyof Bm08Parameters;
        return [
          key,
          Object.freeze({
            label,
            unit,
            displayFactor,
            command:
              BM08_CLASSES[parameter] === "input"
                ? "setup-change"
                : BM08_CLASSES[parameter] === "measurement"
                  ? "measurement-change"
                  : "estimator-change",
            comparable: BM08_COMPARABLE_INPUTS.some((id) => id === parameter),
          } satisfies ComparisonInput),
        ];
      }),
    ),
  ),
  outputs: Object.freeze(
    [
      {
        id: "modelDiffusion",
        label: "Generating diffusivity (held fixed)",
        displayUnit: "μm²/s",
        displayFactor: 1e12,
      },
      {
        id: "naiveExpectation",
        label: "Model expectation of the naive estimate",
        displayUnit: "μm²/s",
        displayFactor: 1e12,
      },
      { id: "naiveD", label: "Sample naive estimate", displayUnit: "μm²/s", displayFactor: 1e12 },
      {
        id: "centeredD",
        label: "Sample drift-centered estimate",
        displayUnit: "μm²/s",
        displayFactor: 1e12,
      },
      {
        id: "covarianceD",
        label: "Sample covariance estimate",
        displayUnit: "μm²/s",
        displayFactor: 1e12,
      },
      {
        id: "pairD",
        label: "Sample noise-aware disjoint-pair estimate",
        displayUnit: "μm²/s",
        displayFactor: 1e12,
      },
      {
        id: "expectedVariance",
        label: "Model increment variance",
        displayUnit: "μm²",
        displayFactor: 1e12,
      },
      {
        id: "expectedCovariance",
        label: "Model neighboring-increment covariance",
        displayUnit: "μm²",
        displayFactor: 1e12,
      },
      { id: "pairCount", label: "Disjoint frame pairs", displayUnit: "1", displayFactor: 1 },
      {
        id: "pairDegrees",
        label: "Pair residual degrees of freedom",
        displayUnit: "1",
        displayFactor: 1,
      },
    ].map((output) => Object.freeze(output)),
  ),
});

function invalid(detail: string): never {
  throw new ExperimentRuntimeError("camera-comparison-evidence", detail, "bm-08");
}
/** Read only accepted results with the instrument's existing identity and output contract. */
export function cameraComparisonOutput(snapshot: ComparisonSnapshot, id: string) {
  const matches = snapshot.outputs.filter((output) => output.quantityId === id);
  const output = matches[0],
    contract = BM08_OUTPUTS[id];
  if (
    matches.length !== 1 ||
    !output ||
    !contract ||
    output.unit !== contract.unit ||
    output.semanticKind !== contract.semanticKind ||
    output.ownerId !== contract.ownerId ||
    !contract.statuses.some((status) => status === output.status)
  )
    invalid(
      `The accepted camera result does not identify ${id} with its declared owner and meaning.`,
    );
  return output;
}
function scalar(snapshot: ComparisonSnapshot, id: string): number {
  const output = cameraComparisonOutput(snapshot, id);
  if (
    output.status !== "value" ||
    typeof output.value !== "number" ||
    !Number.isFinite(output.value)
  )
    invalid(`The accepted camera result requires a finite scalar for ${id}.`);
  return output.value;
}
/** Detach a bounded published NumericView (or an owner Float64Array), without evaluating physics. */
export function cameraComparisonArray(snapshot: ComparisonSnapshot, id: string): readonly number[] {
  const output = cameraComparisonOutput(snapshot, id);
  const expected = bm08Layout(id, snapshot.parameters as Bm08Parameters);
  if (
    output.status !== "value" ||
    expected === null ||
    !Number.isSafeInteger(expected) ||
    expected < 1 ||
    expected > 4004
  )
    invalid(`The accepted camera array ${id} has no admitted layout.`);
  const value = output.value;
  let copy: Float64Array;
  if (value instanceof Float64Array) {
    if (value.length !== expected || !(value.buffer instanceof ArrayBuffer))
      invalid(`The accepted camera array ${id} is not a bounded private snapshot.`);
    copy = value.slice();
  } else if (
    typeof value === "object" &&
    value !== null &&
    "length" in value &&
    value.length === expected &&
    "copy" in value &&
    typeof value.copy === "function"
  )
    copy = value.copy();
  else invalid(`The accepted camera result is missing the array ${id}.`);
  if (
    !(copy instanceof Float64Array) ||
    !(copy.buffer instanceof ArrayBuffer) ||
    copy.length !== expected ||
    !copy.every(Number.isFinite)
  )
    invalid(`The accepted camera array ${id} has the wrong size or nonfinite entries.`);
  return Object.freeze(Array.from(copy));
}

export type CameraComparisonFrame = Readonly<{
  frame: number;
  time: number;
  coordinate: "x" | "y";
  latent: number;
  blurred: number;
  observed: number;
}>;
/** Frame rows and the nonvisual table share this projection of the completed snapshot. */
export function cameraComparisonFrames(
  snapshot: ComparisonSnapshot,
): readonly CameraComparisonFrame[] {
  const times = cameraComparisonArray(snapshot, "times");
  const latent = cameraComparisonArray(snapshot, "idealPositions");
  const blurred = cameraComparisonArray(snapshot, "blurredPositions");
  const observed = cameraComparisonArray(snapshot, "positions");
  const d = snapshot.parameters.d;
  if (d !== 1 && d !== 2) invalid("Choose one or two accepted camera coordinates.");
  const rows: CameraComparisonFrame[] = [];
  for (let i = 0; i < times.length; i++) {
    const time = times[i]!;
    if (i > 0 && time <= times[i - 1]!) invalid("Accepted camera times must increase strictly.");
    for (let axis = 0; axis < d; axis++) {
      const offset = i * d + axis;
      rows.push(
        Object.freeze({
          frame: i + 1,
          time,
          coordinate: axis === 0 ? "x" : "y",
          latent: latent[offset]!,
          blurred: blurred[offset]!,
          observed: observed[offset]!,
        }),
      );
    }
  }
  return Object.freeze(rows);
}
export type CameraComparisonInterval = Readonly<
  { status: "value"; lower: number; upper: number } | { status: "not-applicable"; reason: string }
>;
export function cameraComparisonInterval(
  snapshot: ComparisonSnapshot,
  id: "naiveInterval" | "centeredInterval" | "pairInterval",
): CameraComparisonInterval {
  const output = cameraComparisonOutput(snapshot, id);
  if (output.status === "not-applicable") {
    if (typeof output.reason !== "string" || !output.reason.trim())
      invalid(`The reason for ${id} is missing.`);
    return Object.freeze({ status: "not-applicable", reason: output.reason });
  }
  const [lower, upper] = cameraComparisonArray(snapshot, id);
  if (lower === undefined || upper === undefined || lower > upper)
    invalid(`The bounds for ${id} are reversed.`);
  return Object.freeze({ status: "value", lower, upper });
}

const sameArray = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
/**
 * The worker's reuse report is necessary, not sufficient. Compare its latent witness AND every
 * overlapping frame/coordinate. An estimator-only change must retain the complete observations.
 * Equal seeds by themselves are not evidence that the worker reused anything.
 */
export function verifyBm08Comparison(
  baseline: ComparisonSnapshot,
  variant: ComparisonSnapshot,
  result: ComparisonResult,
): string | null {
  if (result.kind !== "accepted" || result.variation.changedInput === null) return null;
  const command = result.variation.command;
  if (command !== "measurement-change" && command !== "estimator-change")
    return "This comparison changes the camera or estimator, not the physical path.";
  try {
    // These array-valued confidence sets are displayed beside the scalar comparison. Validate
    // them before accepting the pair, so a malformed interval cannot replace a valid result.
    for (const snapshot of [baseline, variant])
      for (const id of ["naiveInterval", "centeredInterval", "pairInterval"] as const)
        cameraComparisonInterval(snapshot, id);
    if (
      baseline.instanceId !== variant.instanceId ||
      baseline.runId !== variant.runId ||
      ["seed", "D", "flowDrift", "noiseSeed", "clickSeed"].some(
        (key) => !Object.is(baseline.parameters[key], variant.parameters[key]),
      )
    )
      return "Keep the same physical run and all three random seeds for this controlled comparison.";
    if (
      scalar(variant, "reusedRecording") !== 1 ||
      scalar(variant, "requestDraws") !== 0 ||
      scalar(baseline, "recordingDraws") <= 0 ||
      scalar(variant, "recordingDraws") !== scalar(baseline, "recordingDraws") ||
      scalar(variant, "modelDiffusion") !== scalar(baseline, "modelDiffusion") ||
      !sameArray(
        cameraComparisonArray(baseline, "latentWitness"),
        cameraComparisonArray(variant, "latentWitness"),
      )
    )
      return "The worker did not preserve the pinned latent recording. Rebuild the baseline before comparing cameras.";
    const a = cameraComparisonFrames(baseline),
      b = cameraComparisonFrames(variant);
    const byTime = new Map<number, Map<string, number>>();
    for (const row of a) {
      const coordinates = byTime.get(row.time) ?? new Map<string, number>();
      coordinates.set(row.coordinate, row.latent);
      byTime.set(row.time, coordinates);
    }
    let common = 0;
    for (const row of b) {
      const coordinates = byTime.get(row.time);
      if (!coordinates?.has(row.coordinate)) continue;
      common++;
      if (!Object.is(coordinates.get(row.coordinate), row.latent))
        return "The latent positions differ at a shared frame time. These are not two observations of the same path.";
    }
    if (common === 0) return "The two camera records have no shared latent frame to compare.";
    if (
      command === "estimator-change" &&
      (scalar(variant, "reusedObservation") !== 1 ||
        scalar(variant, "measurementDraws") !== 0 ||
        [
          "times",
          "positions",
          "idealPositions",
          "blurredPositions",
          "increments",
          "stationaryClicks",
        ].some(
          (id) =>
            !sameArray(cameraComparisonArray(baseline, id), cameraComparisonArray(variant, id)),
        ))
    )
      return "An estimator comparison must reuse the same camera frames and calibration clicks without new measurement draws.";
    return null;
  } catch {
    return "The camera recording evidence is incomplete or does not satisfy the instrument's output contract. The previous comparison is unchanged.";
  }
}

/** A real worked snapshot initializes both columns; no altered-camera result is invented. */
export function requireBm08ComparisonExample(
  snapshot: ComparisonSnapshot | null,
): ComparisonSnapshot {
  if (!snapshot || !snapshot.final || snapshot.parameters.coverageTrials !== 0)
    invalid("A completed camera example without additional hypothetical experiments is required.");
  cameraComparisonFrames(snapshot);
  for (const id of ["naiveInterval", "centeredInterval", "pairInterval"] as const)
    cameraComparisonInterval(snapshot, id);
  return snapshot;
}
