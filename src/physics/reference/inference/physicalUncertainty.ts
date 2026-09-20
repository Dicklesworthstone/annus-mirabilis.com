/** Physical-input uncertainty for the camera-disjoint-pairs procedure.
 * No new estimator or quantile implementation: interval endpoints are mapped
 * by invertToMolecularNumber. The camera variance/noise interval is homogeneous
 * of degree two in metres per pixel, including its stationary-click interval.
 *
 * Coverage uses P(A intersect B) >= P(A) + P(B) - 1, not independence.
 * A is the camera interval event; B is the externally supplied JOINT input box.
 * NIST e-Handbook, 7.4.7.3 (Bonferroni):
 * https://itl.nist.gov/div898/handbook/prc/section4/prc473.htm
 * A standard uncertainty or a set of marginal ranges does not supply P(B).
 */
import { makeRefusal } from "../../../experiments/results/refusals.ts";
import { type ConstantSet, constantValue } from "../constants.ts";
import {
  type Assessment,
  invertToMolecularNumber,
  type StatisticalInterval,
} from "../inference.ts";

export type PositiveRange = readonly [number, number];
export type RadiusCalibration = "independent-length" | "same-axis";
export type MolecularInputBox = Readonly<{
  /** Length/coordinate at the calibration used to calculate diffusion. SI m/pixel. */
  nominalScale: number;
  scale: PositiveRange;
  /** Radius bounds in SI, evaluated at nominalScale for same-axis radii. */
  radius: PositiveRange;
  temperature: PositiveRange;
  viscosity: PositiveRange;
  gasConstant: PositiveRange;
  radiusCalibration: RadiusCalibration;
}>;
export type MolecularEnvelope = Readonly<{
  lower: number;
  upper: number;
  scaleExponent: -2 | -3;
}>;
const positive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
const range = (v: unknown): v is PositiveRange =>
  Array.isArray(v) && v.length === 2 && positive(v[0]) && positive(v[1]) && v[0] <= v[1];
const invalid = (requirements: string): Assessment<never> => ({
  kind: "refused",
  refusal: makeRefusal(
    "invalid-parameter",
    { capabilityId: "diffusion.inference" },
    { details: { requirements } },
  ),
});
const unavailable = (reason: string): Assessment<never> => ({
  kind: "no-value",
  status: "not-applicable",
  reason,
});

/** Reserve error probability for the camera procedure without relabeling the
 * declared input coverage. Its own variance/noise Bonferroni split remains inside
 * disjointPairsKnownNoiseInterval. Nothing is inferred from a standard error.
 */
export function allocateJointInputCoverage(
  target: number,
  jointInputCoverage: number | null,
): Assessment<
  Readonly<{ alphaCamera: number; cameraCoverage: number; coverageLowerBound: number }>
> {
  if (!Number.isFinite(target) || target < 0.5 || target > 0.999)
    return invalid("Choose total coverage from 50% to 99.9%.");
  if (jointInputCoverage === null)
    return unavailable(
      "No joint input coverage is declared. The range envelope is a sensitivity analysis, not a combined confidence interval.",
    );
  if (!Number.isFinite(jointInputCoverage) || jointInputCoverage <= 0 || jointInputCoverage > 1)
    return invalid("Joint input coverage must be positive and no greater than one.");
  // A tiny downward safety margin avoids spending more than the available error
  // budget through cancellation in binary floating-point arithmetic.
  const alphaCamera = jointInputCoverage - target - 16 * Number.EPSILON;
  if (alphaCamera < 1e-8)
    return unavailable(
      "The declared joint input coverage must exceed the requested total coverage and leave at least 1e-8 camera error probability. Supply stronger input coverage or request lower total coverage; no range is silently relabeled.",
    );
  const cameraCoverage = 1 - alphaCamera;
  return {
    kind: "accepted",
    data: Object.freeze({
      alphaCamera,
      cameraCoverage,
      coverageLowerBound: Math.min(
        jointInputCoverage,
        1 - (alphaCamera + (1 - jointInputCoverage)),
      ),
    }),
  };
}

/** Monotone image of a supplied input box and a camera interval calculated at
 * nominalScale. This operation ALONE assigns no coverage probability.
 * N scales as s^-2 for an independent length, s^-3 when radius shares this ruler.
 * The shared ruler is represented once; its error is never treated as independent
 * twice. Temperature/viscosity dependence may make a rectangular envelope wider,
 * but cannot invalidate containment when the JOINT box is valid.
 */
export function cameraMolecularInputEnvelope(
  diffusion: StatisticalInterval,
  box: MolecularInputBox,
  constants: ConstantSet,
  synthetic: boolean,
): Assessment<MolecularEnvelope> {
  if (
    !diffusion ||
    !box ||
    !positive(box.nominalScale) ||
    ![box.scale, box.radius, box.temperature, box.viscosity, box.gasConstant].every(range) ||
    !["independent-length", "same-axis"].includes(box.radiusCalibration) ||
    box.nominalScale < box.scale[0] ||
    box.nominalScale > box.scale[1]
  )
    return invalid(
      "Provide positive, ordered input ranges and a scale range containing its nominal value; declare whether the radius shares the same ruler.",
    );
  if (diffusion.lower === 0)
    return {
      kind: "no-value",
      status: "underdetermined",
      reason:
        "The camera confidence set reaches zero diffusion. No finite upper molecular-number bound is available; input uncertainty cannot repair division by zero.",
    };
  if (!positive(diffusion.lower) || !positive(diffusion.upper) || diffusion.lower > diffusion.upper)
    return invalid(
      "Use an admitted positive camera interval. An empty or negative physical confidence set cannot become a positive molecular interval.",
    );
  const invert = (T: number, eta: number, a: number) =>
    invertToMolecularNumber(
      {
        dHat: diffusion.lower,
        interval: diffusion,
        T,
        eta,
        a,
        radiusProvenance: "independently-declared",
        synthetic,
      },
      constants,
    );
  const lower = invert(box.temperature[0], box.viscosity[1], box.radius[1]);
  if (lower.kind !== "accepted") return lower;
  const upper = invert(box.temperature[1], box.viscosity[0], box.radius[0]);
  if (upper.kind !== "accepted") return upper;
  const R = constantValue(constants, "molarGasConstant").value;
  if (!(box.gasConstant[0] <= R && R <= box.gasConstant[1]))
    return invalid(
      "The gas-constant range must contain the value from the selected constant set. Changing its provenance requires a different set, not a range edit.",
    );
  const exponent = box.radiusCalibration === "same-axis" ? -3 : -2;
  const lo =
    lower.data.interval.lower *
    (box.gasConstant[0] / R) *
    (box.scale[1] / box.nominalScale) ** exponent;
  const hi =
    upper.data.interval.upper *
    (box.gasConstant[1] / R) *
    (box.scale[0] / box.nominalScale) ** exponent;
  if (!positive(lo) || !positive(hi) || lo > hi)
    return invalid(
      "The input envelope is outside the supported numerical range. No endpoint has been clipped or replaced.",
    );
  return {
    kind: "accepted",
    data: Object.freeze({ lower: lo, upper: hi, scaleExponent: exponent }),
  };
}
