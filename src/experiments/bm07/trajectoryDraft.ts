import type { TrajectoryAssumptions } from "./trajectoryAnalysis.ts";
import type { TrajectoryUnits } from "./trajectoryCsv.ts";
import type { MomentRequest } from "./trajectoryMoments.ts";

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
  momentAxis: MomentRequest["axis"];
  momentDriftUmPerS: string;
  radiusIndependent: boolean;
  temperatureKelvin: string;
  viscosityMillipascalSeconds: string;
  radiusMicrometres: string;
  radiusIntervalDeclared: boolean;
  radiusLowerUm: string;
  radiusUpperUm: string;
  radiusCoveragePercent: string;
  radiusSource: string;
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
  momentAxis: "x",
  momentDriftUmPerS: "",
  radiusIndependent: false,
  temperatureKelvin: "",
  viscosityMillipascalSeconds: "",
  radiusMicrometres: "",
  radiusIntervalDeclared: false,
  radiusLowerUm: "",
  radiusUpperUm: "",
  radiusCoveragePercent: "",
  radiusSource: "",
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

function radiusCalibration(draft: TrajectoryDraft) {
  const lower = numeric(draft.radiusLowerUm, "Lower radius bound", 1e-6);
  const upper = numeric(draft.radiusUpperUm, "Upper radius bound", 1e-6);
  const a = numeric(draft.radiusMicrometres, "Independent radius", 1e-6);
  if (lower > a || upper < a)
    throw new Error("The radius bounds must contain the measured particle radius.");
  const percent = numeric(draft.radiusCoveragePercent, "Radius interval coverage", 1);
  if (percent > 100) throw new Error("Radius coverage must be positive and at most 100%.");
  const source = draft.radiusSource.trim();
  if (!source || source.length > 512)
    throw new Error("Identify the independent radius measurement in 1–512 characters.");
  return Object.freeze({ lower, upper, coverage: percent / 100, source });
}

export function readTrajectoryUnits(draft: TrajectoryDraft): TrajectoryUnits {
  if (
    !["s", "ms"].includes(draft.timeUnit) ||
    !["m", "um", "nm", "px"].includes(draft.positionUnit)
  ) {
    throw new Error(
      "Choose both time and position units; they are never inferred from magnitudes.",
    );
  }
  return Object.freeze({
    time: draft.timeUnit as TrajectoryUnits["time"],
    position: draft.positionUnit as TrajectoryUnits["position"],
    ...(draft.positionUnit === "px"
      ? {
          micrometresPerPixel: numeric(draft.micrometresPerPixel, "Pixel calibration", 1),
        }
      : {}),
  });
}

export function readTrajectoryDraft(draft: TrajectoryDraft): Readonly<{
  units: TrajectoryUnits;
  assumptions: TrajectoryAssumptions;
}> {
  const units = readTrajectoryUnits(draft);
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
            ...(draft.radiusIntervalDeclared ? { calibration: radiusCalibration(draft) } : {}),
          })
        : null,
    }),
  });
}

export function readMomentRequest(draft: TrajectoryDraft, modelDeclared: boolean): MomentRequest {
  const drift = draft.momentDriftUmPerS.trim();
  if (!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(drift))
    throw new Error(
      "Enter the independently known drift along the chosen axis, including zero when known.",
    );
  const speed = numeric(drift.replace(/^[-+]/, ""), "Known drift", 1e-6, true);
  return Object.freeze({
    axis: draft.momentAxis,
    knownDriftMPerS: drift.startsWith("-") ? -speed : speed,
    exposureSeconds: numeric(draft.exposureMilliseconds, "Uniform exposure time", 1e-3, true),
    selection: draft.censored,
    modelDeclared,
  });
}
