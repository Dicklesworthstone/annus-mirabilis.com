/**
 * Step enumeration experiment adapter.
 *
 * Sits behind the experiments seam to evaluate reference physics owner
 * (stepEnumeration) for missing-step verification and compiled lessons
 * without violating the architectural import boundary.
 */
import {
  enumerateSignedSteps as referenceEnumerateSignedSteps,
  type StepDependence,
} from "../../physics/reference/stepEnumeration.ts";

export type { StepDependence };

export type EnumeratedStepsResult = ReturnType<typeof referenceEnumerateSignedSteps>;

export function enumerateSignedSteps(
  count: number,
  dependence: StepDependence = "independent",
): EnumeratedStepsResult {
  return referenceEnumerateSignedSteps(count, dependence);
}
