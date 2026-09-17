import type { TrajectoryAssumptions } from "./trajectoryAnalysis.ts";
import type { TrajectoryUnits } from "./trajectoryCsv.ts";

export type TrajectoryDraft = Readonly<{
  timeUnit: "" | TrajectoryUnits["time"];
  positionUnit: "" | TrajectoryUnits["position"];
  micrometresPerPixel: string;
  estimator: TrajectoryAssumptions["estimator"];
  coveragePercent: string;
  independentIsotropic: boolean;
  commonDriftAndDiffusion: boolean;
  localizationNanometres: string;
  exposureMilliseconds: string;
  censored: "unknown" | "yes" | "no";
  radiusIndependent: boolean;
  temperatureKelvin: string;
  viscosityMillipascalSeconds: string;
  radiusMicrometres: string;
}>;
export const EMPTY_TRAJECTORY_DRAFT: TrajectoryDraft = Object.freeze({
  timeUnit: "",
  positionUnit: "",
  micrometresPerPixel: "",
  estimator: "drift-centered",
  coveragePercent: "95",
  independentIsotropic: false,
  commonDriftAndDiffusion: false,
  localizationNanometres: "",
  exposureMilliseconds: "",
  censored: "unknown",
  radiusIndependent: false,
  temperatureKelvin: "",
  viscosityMillipascalSeconds: "",
  radiusMicrometres: "",
});

function numeric(text: string, label: string, scale: number, allowZero = false): number {
  if (!/^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text.trim())) {
    throw new Error(
      `${label} needs an explicit ${allowZero ? "nonnegative" : "positive"} decimal value.`,
    );
  }
  const raw = Number(text),
    value = raw * scale;
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    (!allowZero && value === 0) ||
    (value === 0 && /[1-9]/.test(text.split(/[eE]/)[0]!))
  ) {
    throw new Error(`${label} is outside the supported numeric range.`);
  }
  return value;
}

export function readTrajectoryDraft(draft: TrajectoryDraft): Readonly<{
  units: TrajectoryUnits;
  assumptions: TrajectoryAssumptions;
}> {
  if (
    !["s", "ms"].includes(draft.timeUnit) ||
    !["m", "um", "nm", "px"].includes(draft.positionUnit)
  ) {
    throw new Error(
      "Choose both time and position units; they are never inferred from magnitudes.",
    );
  }
  if (
    ![
      "independent-increment-known-zero-drift",
      "drift-centered",
      "maximum-likelihood-centered",
    ].includes(draft.estimator)
  ) {
    throw new Error("Choose a registered estimator.");
  }
  if (!["unknown", "yes", "no"].includes(draft.censored))
    throw new Error("Declare the observation selection status.");
  const percent = numeric(draft.coveragePercent, "Coverage", 1);
  if (percent < 50 || percent > 99.9)
    throw new Error("Choose interval coverage from 50% through 99.9%.");
  // 99.9 / 100 rounds just above 0.999 in binary64. Validate in the declared
  // unit, then clamp that final rounding error at the documented boundary.
  const coverage = Math.min(0.999, percent / 100);
  const units: TrajectoryUnits = Object.freeze({
    time: draft.timeUnit as TrajectoryUnits["time"],
    position: draft.positionUnit as TrajectoryUnits["position"],
    ...(draft.positionUnit === "px"
      ? {
          micrometresPerPixel: numeric(draft.micrometresPerPixel, "Pixel calibration", 1),
        }
      : {}),
  });
  return Object.freeze({
    units,
    assumptions: Object.freeze({
      estimator: draft.estimator,
      coverage,
      independentIsotropic: draft.independentIsotropic === true,
      commonDriftAndDiffusion: draft.commonDriftAndDiffusion === true,
      localizationStd:
        draft.localizationNanometres.trim() === ""
          ? null
          : numeric(draft.localizationNanometres, "Localization error", 1e-9, true),
      exposureTime:
        draft.exposureMilliseconds.trim() === ""
          ? null
          : numeric(draft.exposureMilliseconds, "Exposure time", 1e-3, true),
      censored: draft.censored === "unknown" ? null : draft.censored === "yes",
      independentRadius: draft.radiusIndependent
        ? Object.freeze({
            T: numeric(draft.temperatureKelvin, "Temperature", 1),
            eta: numeric(draft.viscosityMillipascalSeconds, "Dynamic viscosity", 1e-3),
            a: numeric(draft.radiusMicrometres, "Independent radius", 1e-6),
          })
        : null,
    }),
  });
}
