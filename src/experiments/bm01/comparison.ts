import type { ComparisonIdentity, ComparisonSnapshot } from "../compare/Baseline.ts";
import type { ComparisonResult } from "../compare/compatibility.ts";
import type { ComparisonContract, ComparisonInput } from "../compare/singleVariationLock.ts";
import { BM01_CLASSES, BM01_MODEL, type Bm01Parameters } from "./definition.ts";
import type { PreparedBm01Example } from "./session.ts";

export type PreparedBm01Comparison = Readonly<{
  schemaVersion: number;
  baseline: PreparedBm01Example;
  doubledRadius: PreparedBm01Example;
  streamVersion: string;
  allocationId: string;
}>;
const fields: Readonly<Record<keyof Bm01Parameters, readonly [string, string, number]>> = {
  T: ["Temperature", "K", 1],
  eta: ["Viscosity", "mPa·s", 1000],
  a: ["Particle radius", "μm", 1e6],
  seed: ["Trial seed", "", 1],
  M: ["Tracer count", "", 1],
  h: ["Recording resolution", "s", 1],
  H: ["Recording length", "s", 1],
  interval: ["Observation interval", "s", 1],
  d: ["Selected dimension", "", 1],
  axis: ["Selected axis", "", 1],
  statistic: ["Statistic", "", 1],
};
export const BM01_COMPARABLE_INPUTS = ["a", "eta", "T", "interval"] as const;
export const BM01_COMPARISON: ComparisonContract = Object.freeze({
  experimentId: "bm-01",
  inputs: Object.freeze(
    Object.fromEntries(
      Object.entries(fields).map(([key, [label, unit, displayFactor]]) => {
        const parameter = key as keyof Bm01Parameters;
        const cls = BM01_CLASSES[parameter];
        const command =
          cls === "input"
            ? "setup-change"
            : cls === "measurement"
              ? "measurement-change"
              : "estimator-change";
        return [
          key,
          Object.freeze({
            label,
            unit,
            displayFactor,
            command,
            comparable: BM01_COMPARABLE_INPUTS.some((id) => id === parameter),
          } satisfies ComparisonInput),
        ];
      }),
    ),
  ),
  outputs: Object.freeze([
    {
      id: "diffusionCoefficient",
      label: "Model diffusion coefficient",
      displayUnit: "μm²/s",
      displayFactor: 1e12,
    },
    {
      id: "rmsDisplacement1d",
      label: "Model coordinate RMS displacement",
      displayUnit: "μm",
      displayFactor: 1e6,
    },
    {
      id: "sampleRms",
      label: "Sample coordinate RMS displacement",
      displayUnit: "μm",
      displayFactor: 1e6,
    },
    { id: "sampleMean", label: "Sample signed mean", displayUnit: "μm", displayFactor: 1e6 },
    {
      id: "sampleMeanSquare",
      label: "Sample coordinate mean square",
      displayUnit: "μm²",
      displayFactor: 1e12,
    },
    {
      id: "modelApparentSpeed",
      label: "Model interval-dependent apparent speed",
      displayUnit: "μm/s",
      displayFactor: 1e6,
    },
  ]),
});
export function bm01ComparisonIdentity(example: PreparedBm01Comparison): ComparisonIdentity {
  if (
    example.schemaVersion !== 1 ||
    example.baseline.sourceDigest !== example.doubledRadius.sourceDigest
  )
    throw new TypeError("The worked comparison must use one evaluator build.");
  return Object.freeze({
    modelVersion: BM01_MODEL.id,
    constantSetId: BM01_MODEL.constantSetId,
    sourceDigest: example.baseline.sourceDigest,
    artifactDigest: null,
    streamVersion: example.streamVersion,
    allocationId: example.allocationId,
    executionLabel: "host-calculation",
  });
}
/** Reuse is an owner-reported fact, not an inference from equal seed strings. */
export function verifyBm01Comparison(
  baseline: ComparisonSnapshot,
  variant: ComparisonSnapshot,
  result: ComparisonResult,
): string | null {
  if (result.kind !== "accepted" || result.variation.command !== "measurement-change") return null;
  const read = (snapshot: ComparisonSnapshot, id: string) => {
    const output = snapshot.outputs.find((value) => value.quantityId === id);
    return output?.status === "value" ? output.value : null;
  };
  if (
    read(variant, "reusedRecording") !== 1 ||
    typeof read(baseline, "recordingDraws") !== "number" ||
    read(variant, "recordingDraws") !== read(baseline, "recordingDraws")
  )
    return "The worker did not confirm reuse of the pinned recording. Rebuild the baseline before comparing observation intervals.";
  return null;
}
/** The controlled comparison's four readings, shown on the reader's detail setting. Mirrored in
 * content/editorial/readings-owners/am-reason-hold-fixed-comparison-xgxw.yaml, which the readings
 * audit reads. Numbers are the prepared baseline and doubled-radius snapshots. */
export const BM01_COMPARE_CAPTION = Object.freeze({
  r0: "Double the particles' radius and keep everything else the same, and they spread less, but not half as much. The typical distance falls to about 0.71 of what it was, because it goes as the square root of a coefficient that halves.",
  r1: "Section 3 gives the diffusion coefficient of a suspended sphere as D = (RT/N) · 1/(6πkP), where k is the liquid's viscosity and P the sphere's radius, so D is inversely proportional to the radius. Section 4 gives the typical displacement along one axis as λ_{x} = √(2Dt). The comparison pins a baseline, spheres of radius 0.5 μm in a liquid of 1.35 mPa·s at 290.15 K watched for 1 s, and changes the radius alone, to 1 μm. D falls from 0.315 to 0.157 μm²/s, exactly half. The model's RMS displacement falls from 0.794 to 0.561 μm, a ratio of 0.70711, which is 1/√2 and not 0.5. Both runs use the same seed, so the 400 sampled paths are built from the same random draws, and the sample RMS falls from 0.844 to 0.597 μm in exactly the same ratio. That isolates the effect of the one change. It is not a second, independent trial, and it says nothing about how much a fresh trial would differ. Other single changes follow the same two formulas: twice the viscosity halves D just as twice the radius does, and four times the observation interval doubles the model's RMS, because it reads the same recording at a later time. Raising the temperature raises D in proportion only if the viscosity stays fixed, which in a real liquid it does not; the lab holds it fixed and says so.",
  r2: "Start with the coefficient. Section 3 balances two effects on a sphere in a liquid: the osmotic pressure that pushes suspended particles from where they are crowded to where they are sparse, and Stokes's drag, a force 6πηa times the sphere's speed, that resists their motion. In modern notation the balance gives D = k_{B}T/(6πηa). Put in the baseline. The numerator is 1.380649 × 10^{−23} J/K × 290.15 K = 4.006 × 10^{−21} J. The denominator is 6π × 0.00135 Pa·s × 0.5 × 10^{−6} m = 1.272 × 10^{−8} kg/s. Their quotient is D = 3.148 × 10^{−13} m²/s, which is 0.315 μm²/s. The radius sits in the denominator, so twice the radius doubles the denominator and halves D, to 0.157 μm²/s. Nothing else in the formula moved. Now the displacement. With t = 1 s, 2Dt for the baseline is 6.297 × 10^{−13} m², and its square root is 7.94 × 10^{−7} m, or 0.794 μm. For the larger sphere 2Dt is half as large, 3.148 × 10^{−13} m², and its square root is 5.61 × 10^{−7} m, or 0.561 μm. Halving what is under a square root divides the root by √2, since √(x/2) = √x/√2, and 1/√2 = 0.70711. So the tempting sentence 'twice the radius, half the displacement' is false, and the true one is 'twice the radius, about 71 percent of the displacement'. To halve the displacement you would need a quarter of D, which means four times the radius. The ratio does not depend on the time either: at one minute, 0.794 μm × √60 = 6.15 μm for the small spheres and 0.561 μm × √60 = 4.35 μm for the large ones, still in the ratio 0.70711. The sampled paths keep that ratio for a different reason. Each path is a sum of steps, each step a standard normal draw multiplied by √(2Dh), where h = 0.02 s is the recording step. With the same seed both runs use the same draws, and only the multiplier changes, by √(1/2). Every position shrinks by that factor, and so does the sample RMS: 0.844 μm becomes 0.597 μm. The sample RMS sits about 6 percent above the model's 0.794 μm because 400 tracers are a finite sample. With the draws shared, that sampling error is shared too, and it cancels from the ratio. That is what makes the comparison sharp, and it is also why it cannot say how much a second, independent trial would differ.",
  r3: "Einstein printed D = (RT/N) · 1/(6πkP) in Section 3 and λ_{x} = √(2Dt) in Section 4, then put in numbers for one size of sphere in water in Section 5. He varied nothing, and had no measurement to compare. Perrin's measurements of 1908 and 1909 used grains of several radii, and he took the agreement of the values of N they gave as evidence that the formula held as the radius changed. The shared-seed method used here, called common random numbers, is a modern simulation technique for comparing two settings; it isolates one change and is not a substitute for repeated experiments.",
});
