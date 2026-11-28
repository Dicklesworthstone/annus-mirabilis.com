import type { ConstantSet } from "../../physics/reference/constants.ts";
import type { allocateJointInputCoverage } from "../../physics/reference/inference/physicalUncertainty.ts";
import type {
  Assessment,
  DeclaredInterval,
  invertToMolecularNumber,
  StatisticalInterval,
} from "../../physics/reference/inference.ts";

export type TrajectoryRadius = Readonly<{
  T: number;
  eta: number;
  a: number;
  calibration?: DeclaredInterval & Readonly<{ source: string }>;
}>;

export function freezeTrajectoryRadius(radius: TrajectoryRadius | null): TrajectoryRadius | null {
  if (!radius) return null;
  return Object.freeze({
    ...radius,
    ...(radius.calibration ? { calibration: Object.freeze({ ...radius.calibration }) } : {}),
  });
}

export type RadiusComparison =
  | Readonly<{ kind: "unavailable"; reason: string }>
  | Readonly<{
      kind: "combined";
      method: "bonferroni-radius-and-diffusion";
      coverageLowerBound: number;
      diffusionInterval: StatisticalInterval;
      lower: number;
      upper: number;
    }>;

export type RadiusReference = Readonly<{
  allocateJointInputCoverage: typeof allocateJointInputCoverage;
  invertToMolecularNumber: typeof invertToMolecularNumber;
}>;

export function radiusComparison(
  radius: TrajectoryRadius,
  target: number,
  estimate: number,
  diffusionAt: (alpha: number) => Assessment<StatisticalInterval>,
  reference: RadiusReference,
  constants: ConstantSet,
): RadiusComparison | null {
  const calibration = radius.calibration;
  if (!calibration) return null;
  const unavailable = (reason: string) => Object.freeze({ kind: "unavailable" as const, reason });
  const ownerReason = (answer: Exclude<Assessment<unknown>, { kind: "accepted" }>) =>
    answer.kind === "outcome"
      ? answer.outcome.message
      : answer.kind === "refused"
        ? answer.refusal.message
        : answer.reason;
  if (
    !calibration.source.trim() ||
    calibration.source.length > 512 ||
    !Number.isFinite(calibration.lower) ||
    !Number.isFinite(calibration.upper) ||
    calibration.lower <= 0 ||
    calibration.lower > radius.a ||
    calibration.upper < radius.a
  )
    return unavailable(
      "Supply positive radius bounds containing the measured radius and identify the independent calibration.",
    );
  const budget = reference.allocateJointInputCoverage(target, calibration.coverage);
  if (budget.kind !== "accepted")
    return unavailable(
      "The radius interval needs stronger coverage than the requested joint interval, leaving error probability for diffusion. Supply a higher-coverage calibration or lower the requested coverage.",
    );
  // With one uncertain physical input, its marginal interval is the entire input box.
  // Re-evaluate the *same* observations under their own model at the allocated coverage.
  const diffusion = diffusionAt(budget.data.alphaCamera);
  if (diffusion.kind !== "accepted") return unavailable(ownerReason(diffusion));
  if (diffusion.data.lower <= 0)
    return unavailable(
      "At the coverage needed to include radius uncertainty, the diffusion confidence set reaches zero. Its inverse has no finite upper endpoint.",
    );
  const inverseAt = (a: number) =>
    reference.invertToMolecularNumber(
      {
        T: radius.T,
        eta: radius.eta,
        a,
        dHat: estimate,
        interval: diffusion.data,
        synthetic: false,
        radiusProvenance: "independently-declared",
      },
      constants,
    );
  // The reference inverse decreases in both radius and diffusivity.
  const atLargeRadius = inverseAt(calibration.upper);
  if (atLargeRadius.kind !== "accepted") return unavailable(ownerReason(atLargeRadius));
  const atSmallRadius = inverseAt(calibration.lower);
  if (atSmallRadius.kind !== "accepted") return unavailable(ownerReason(atSmallRadius));
  return Object.freeze({
    kind: "combined",
    method: "bonferroni-radius-and-diffusion",
    coverageLowerBound: budget.data.coverageLowerBound,
    diffusionInterval: diffusion.data,
    lower: atLargeRadius.data.interval.lower,
    upper: atSmallRadius.data.interval.upper,
  });
}
