import { BM01_CLASSES, BM01_MODEL, type Bm01Parameters } from "./definition.ts";
import type { PreparedBm01Example } from "./session.ts";
import type { ComparisonContract, ComparisonInput } from "../compare/singleVariationLock.ts";
import type { ComparisonIdentity, ComparisonSnapshot } from "../compare/Baseline.ts";
import type { ComparisonResult } from "../compare/compatibility.ts";

export type PreparedBm01Comparison = Readonly<{
  schemaVersion: number;
  baseline: PreparedBm01Example;
  doubledRadius: PreparedBm01Example;
  streamVersion: string;
  allocationId: string;
}>;
const fields: Readonly<Record<keyof Bm01Parameters, readonly [string, string, number]>> = {
  T: ["Temperature", "K", 1], eta: ["Viscosity", "mPa·s", 1000], a: ["Particle radius", "μm", 1e6],
  seed: ["Trial seed", "", 1], M: ["Tracer count", "", 1], h: ["Recording resolution", "s", 1],
  H: ["Recording length", "s", 1], interval: ["Observation interval", "s", 1],
  d: ["Selected dimension", "", 1], axis: ["Selected axis", "", 1], statistic: ["Statistic", "", 1],
};
export const BM01_COMPARABLE_INPUTS = ["a", "eta", "T", "interval"] as const;
export const BM01_COMPARISON: ComparisonContract = Object.freeze({
  experimentId: "bm-01",
  inputs: Object.freeze(Object.fromEntries(Object.entries(fields).map(([key, [label, unit, displayFactor]]) => {
    const parameter = key as keyof Bm01Parameters;
    const cls = BM01_CLASSES[parameter];
    const command = cls === "input" ? "setup-change" : cls === "measurement" ? "measurement-change" : "estimator-change";
    return [key, Object.freeze({ label, unit, displayFactor, command,
      comparable: BM01_COMPARABLE_INPUTS.some((id) => id === parameter) } satisfies ComparisonInput)];
  }))),
  outputs: Object.freeze([
    { id: "diffusionCoefficient", label: "Model diffusion coefficient", displayUnit: "μm²/s", displayFactor: 1e12 },
    { id: "rmsDisplacement1d", label: "Model coordinate RMS displacement", displayUnit: "μm", displayFactor: 1e6 },
    { id: "sampleRms", label: "Sample coordinate RMS displacement", displayUnit: "μm", displayFactor: 1e6 },
    { id: "sampleMean", label: "Sample signed mean", displayUnit: "μm", displayFactor: 1e6 },
    { id: "sampleMeanSquare", label: "Sample coordinate mean square", displayUnit: "μm²", displayFactor: 1e12 },
    { id: "modelApparentSpeed", label: "Model interval-dependent apparent speed", displayUnit: "μm/s", displayFactor: 1e6 },
  ]),
});
export function bm01ComparisonIdentity(example: PreparedBm01Comparison): ComparisonIdentity {
  if (example.schemaVersion !== 1 || example.baseline.sourceDigest !== example.doubledRadius.sourceDigest)
    throw new TypeError("The worked comparison must use one evaluator build.");
  return Object.freeze({ modelVersion: BM01_MODEL.id, constantSetId: BM01_MODEL.constantSetId,
    sourceDigest: example.baseline.sourceDigest, artifactDigest: null,
    streamVersion: example.streamVersion, allocationId: example.allocationId, executionLabel: "host-calculation" });
}
/** Reuse is an owner-reported fact, not an inference from equal seed strings. */
export function verifyBm01Comparison(baseline: ComparisonSnapshot, variant: ComparisonSnapshot,
  result: ComparisonResult): string | null {
  if (result.kind !== "accepted" || result.variation.command !== "measurement-change") return null;
  const read = (snapshot: ComparisonSnapshot, id: string) => {
    const output = snapshot.outputs.find((value) => value.quantityId === id);
    return output?.status === "value" ? output.value : null;
  };
  if (read(variant, "reusedRecording") !== 1 || typeof read(baseline, "recordingDraws") !== "number" ||
      read(variant, "recordingDraws") !== read(baseline, "recordingDraws"))
    return "The worker did not confirm reuse of the pinned recording. Rebuild the baseline before comparing observation intervals.";
  return null;
}
