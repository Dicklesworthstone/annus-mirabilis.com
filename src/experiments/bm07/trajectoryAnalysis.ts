/** Orchestration for imported observations. All numerical estimation, interval
 * construction, model admission and constant interpretation stay with the
 * existing reference owner. Dependency injection makes refusal paths testable. */

import type { ConstantSet } from "../../physics/reference/constants.ts";
import type * as Inference from "../../physics/reference/inference.ts";
import type { ImportedTrajectory } from "./trajectoryCsv.ts";

export type TrajectoryReference = Pick<
  typeof Inference,
  | "independentModelAdmission"
  | "estimateIncrements"
  | "estimatorInterval"
  | "invertToMolecularNumber"
>;
export type TrajectoryAssumptions = Readonly<{
  estimator: Inference.EstimatorId;
  coverage: number;
  independentIsotropic: boolean;
  commonDriftAndDiffusion: boolean;
  /** null means unknown, never zero. All noise/exposure inputs use SI units. */
  localizationStd: number | null;
  exposureTime: number | null;
  censored: boolean | null;
  independentRadius: Readonly<{ T: number; eta: number; a: number }> | null;
}>;
export type MolecularComparison = Extract<
  ReturnType<TrajectoryReference["invertToMolecularNumber"]>,
  { kind: "accepted" }
>["data"];
export type TrajectoryAnalysis = Readonly<{
  kind: "analyzed" | "unavailable";
  trajectory: ImportedTrajectory;
  assumptions: TrajectoryAssumptions;
  estimate: Inference.Estimate | null;
  interval: Inference.StatisticalInterval | null;
  molecular: MolecularComparison | null;
  message: string;
  molecularMessage: string;
  calculation: "reference-host";
  sourceKind: "user-supplied-not-independently-verified";
}>;

function reason(value: { kind: string; reason?: string; refusal?: { message: string } }): string {
  return value.reason ?? value.refusal?.message ?? "The reference calculation supplied no value.";
}

export function analyzeTrajectory(
  trajectory: ImportedTrajectory,
  input: TrajectoryAssumptions,
  reference: TrajectoryReference,
  modernConstants: () => ConstantSet,
): TrajectoryAnalysis {
  const assumptions = Object.freeze({
    ...input,
    independentRadius: input.independentRadius
      ? Object.freeze({ ...input.independentRadius })
      : null,
  });
  const base = {
    trajectory,
    assumptions,
    calculation: "reference-host" as const,
    sourceKind: "user-supplied-not-independently-verified" as const,
  };
  const unavailable = (message: string): TrajectoryAnalysis =>
    Object.freeze({
      ...base,
      kind: "unavailable",
      estimate: null,
      interval: null,
      molecular: null,
      message,
      molecularMessage:
        "A molecular-number comparison requires an admitted diffusion estimate and interval.",
    });
  if (
    !Number.isFinite(assumptions.coverage) ||
    assumptions.coverage < 0.5 ||
    assumptions.coverage > 0.999
  ) {
    throw new Error("Choose interval coverage from 50% through 99.9%.");
  }
  if (!assumptions.independentIsotropic) {
    return unavailable(
      "Declare independent, isotropic Gaussian increments before using this ideal-model inference. A CSV cannot establish those assumptions.",
    );
  }
  if (trajectory.trackCount > 1 && !assumptions.commonDriftAndDiffusion) {
    return unavailable(
      "Pooling tracks requires an explicit common drift and diffusion model. Different particles are not automatically interchangeable.",
    );
  }
  if (
    assumptions.localizationStd === null ||
    assumptions.exposureTime === null ||
    assumptions.censored === null
  ) {
    return unavailable(
      "Noise, exposure and selection/censoring must be declared. Unknown is not treated as zero, and no exact-model interval is supplied.",
    );
  }
  if (trajectory.dt === null)
    return unavailable(trajectory.timingIssue ?? "No common sampling interval is available.");
  const admitted = reference.independentModelAdmission({
    equalSpacing: true,
    nonOverlapping: true,
    localizationStd: assumptions.localizationStd,
    exposureTime: assumptions.exposureTime,
    censored: assumptions.censored,
  });
  if (admitted.kind !== "accepted") return unavailable(reason(admitted));
  const estimated = reference.estimateIncrements(
    Float64Array.from(trajectory.increments),
    trajectory.dt,
    trajectory.dimension,
    assumptions.estimator,
  );
  if (estimated.kind !== "accepted") return unavailable(reason(estimated));
  const estimate = estimated.data;
  // A digitized stationary path cannot warrant a zero-width experimental interval.
  if (estimate.unbiasedDHat <= 0)
    return Object.freeze({
      ...base,
      kind: "analyzed",
      estimate,
      interval: null,
      molecular: null,
      message:
        "No positive diffusion scale is resolved. No zero-width confidence interval or infinite molecular number is reported; check resolution, motion and the observation model.",
      molecularMessage: "A positive diffusion scale and interval are required.",
    });
  const bounded = reference.estimatorInterval(estimate, 1 - assumptions.coverage);
  if (bounded.kind !== "accepted")
    return Object.freeze({
      ...base,
      kind: "analyzed",
      estimate,
      interval: null,
      molecular: null,
      message: reason(bounded),
      molecularMessage: "The diffusion interval is unavailable.",
    });
  const interval = bounded.data;
  const message =
    "Conditional interval under the declared ideal model. Timing, spatial calibration and inference inputs are held exact; this does not include camera noise, model mismatch or calibration uncertainty.";
  if (!assumptions.independentRadius)
    return Object.freeze({
      ...base,
      kind: "analyzed",
      estimate,
      interval,
      molecular: null,
      message,
      molecularMessage:
        "Diffusion alone does not separate particle radius from molecular number. Declare an independently measured radius, temperature and viscosity for a modern-SI consistency comparison.",
    });
  const inverted = reference.invertToMolecularNumber(
    {
      ...assumptions.independentRadius,
      radiusProvenance: "independently-declared",
      dHat: estimate.dHat,
      interval,
      synthetic: false,
    },
    modernConstants(),
  );
  if (inverted.kind !== "accepted")
    return Object.freeze({
      ...base,
      kind: "analyzed",
      estimate,
      interval,
      molecular: null,
      message,
      molecularMessage: reason(inverted),
    });
  if (inverted.data.semanticKind !== "consistency-check") {
    // A change in a constant-set registry must not silently change the meaning
    // of an observational result on this explicitly modern-SI route.
    return Object.freeze({
      ...base,
      kind: "analyzed",
      estimate,
      interval,
      molecular: null,
      message,
      molecularMessage:
        "The constant owner did not return a modern-SI consistency comparison; no molecular result is displayed.",
    });
  }
  return Object.freeze({
    ...base,
    kind: "analyzed",
    estimate,
    interval,
    molecular: inverted.data,
    message,
    molecularMessage:
      "Modern SI defines the Avogadro constant. This is a consistency comparison, equivalently an estimate of Boltzmann's constant; it is not an independent count of molecules. The interval holds radius, temperature, viscosity and calibration exact.",
  });
}

/** Explicit user-triggered export only. Not a permalink, not localStorage, not
 * an upload: raw observations and provenance remain in this browser session. */
export function trajectoryAnalysisJson(analysis: TrajectoryAnalysis): string {
  return (
    JSON.stringify(
      {
        schema: "annus-mirabilis-trajectory-analysis/v1",
        sourceKind: analysis.sourceKind,
        sourceVerification:
          "Not independently verified. Import does not establish an observation's authenticity or a physical model.",
        calculation: analysis.calculation,
        siUnits: {
          time: "s",
          positions: "m",
          increments: "m",
          diffusion: "m2/s",
          drift: "m/s",
          molecular: "1/mol",
        },
        trajectory: analysis.trajectory,
        assumptions: analysis.assumptions,
        result: {
          kind: analysis.kind,
          estimate: analysis.estimate
            ? { ...analysis.estimate, drift: Array.from(analysis.estimate.drift) }
            : null,
          interval: analysis.interval,
          molecular: analysis.molecular,
          message: analysis.message,
          molecularMessage: analysis.molecularMessage,
        },
      },
      null,
      2,
    ) + "\n"
  );
}
