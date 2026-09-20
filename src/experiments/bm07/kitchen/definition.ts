import type { NumberMeaning } from "../../../physics/reference/inference.ts";
import type { ScientificResult } from "../../results/types.ts";
import type { OutputContract } from "../../store/instanceStore.ts";
export type KitchenOptions = Readonly<{
  track: string;
  axis: "x" | "y";
  coverage: number;
  constantSet: "metadata" | "scenario-gas-constant-measured" | "modern-si-2019";
}>;
export const KITCHEN_OPTIONS: KitchenOptions = Object.freeze({
  track: "",
  axis: "x",
  coverage: 0.95,
  constantSet: "metadata",
});
const contract = (unit: string, semanticKind: string): OutputContract => ({
  unit,
  semanticKind,
  ownerId: "inference.kitchen",
  statuses: ["value", "underdetermined", "not-applicable"],
});
export const KITCHEN_OUTPUTS = Object.freeze({
  molecularInputRange: contract("1/mol", "input-box-sensitivity-envelope"),
  combinedMolecularInterval: contract("1/mol", "joint-input-camera-confidence-envelope"),
  combinedSamplingInterval: contract("m2/s", "allocated-camera-confidence-set-at-nominal-scale"),
  naiveD: contract("m2/s", "uncorrected-observed-diffusivity"),
  correctedD: contract("m2/s", "noise-corrected-disjoint-pair-estimate"),
  noiseVariance: contract("m2", "stationary-click-coordinate-variance"),
  diffusionInterval: contract("m2/s", "conditional-disjoint-pair-confidence-set"),
  molecularNumber: contract("1/mol", "declared-provenance-molecular-number"),
  molecularInterval: contract("1/mol", "conditional-molecular-number-confidence-set"),
  radiusNumberProduct: contract("m/mol", "radius-number-identifiability-product"),
  consistencyRatio: contract("1", "ratio-to-defined-avogadro-constant"),
  estimatedBoltzmannConstant: contract("J/K", "observational-boltzmann-consistency-estimate"),
  drift: contract("m/s", "fitted-coordinate-drift"),
  pairCount: contract("1", "retained-disjoint-pair-count"),
  pairDegrees: contract("1", "retained-pair-degrees-of-freedom"),
  pairs: contract("m", "pair-start-and-end-coordinate-positions"),
  pairTimes: contract("s", "pair-start-and-end-times"),
});
export type KitchenTrack = Readonly<{ key: string; label: string; indices: readonly number[] }>;
export type KitchenUncertainty = Readonly<{
  state: "unavailable" | "sensitivity" | "combined";
  scaleExponent: -2 | -3 | null;
  inputCoverage: number | null;
  cameraCoverage: number | null;
  combinedCoverage: number | null;
}>;
export type KitchenAnalysis = Readonly<{
  uncertainty: KitchenUncertainty;
  options: KitchenOptions;
  tracks: readonly KitchenTrack[];
  selectedTrack: string;
  outputs: readonly ScientificResult[];
  warnings: readonly string[];
  intervalReasons: readonly string[];
  counts: Readonly<{
    measured: number;
    interpolated: number;
    excluded: number;
    lost: number;
    attemptedPairs: number;
    retainedPairs: number;
    stationary: number;
  }>;
  lostPairs: Readonly<Record<string, number>>;
  scale: number | null;
  scaleSource: "measured" | "derived" | "unknown";
  constantSetId: string;
  gasConstantProvenance: string;
  numberMeaning: NumberMeaning | "unavailable";
  combinedIntervalReason: string;
}>;

/** Editorial acquisition budgets, not statements about Brownian physics.
 * Browsers do not expose how many frames an internal decoder visits on a seek.
 * frameReads bounds our requested acquisitions; internal decoding is not claimed bounded.
 */
export const KITCHEN_VIDEO_LIMITS = Object.freeze({
  fileBytes: 256 * 1024 * 1024,
  durationSeconds: 600,
  sourceEdge: 4096,
  canvasEdge: 1920,
  frameReads: 2000,
  warningFraction: 0.8,
  stepMilliseconds: 2000,
});
export type KitchenVideoLimits = typeof KITCHEN_VIDEO_LIMITS;
