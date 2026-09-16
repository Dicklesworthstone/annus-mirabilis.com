/**
 * Per-parameter quantization for tape events and checkpoints (am-rt-control-tapes-0gc
 * requirement 4). The donor's blanket 6-decimal-place quantization destroys SI values below
 * 1e-6 (a Brownian radius of 5e-7 m, a diffusivity of 4.3e-13 m^2/s) and truncates small
 * viscosities to a few significant figures. Quantization here always follows the parameter's
 * own declared policy: a fixed step, or a fixed number of significant figures.
 */

export type QuantizationPolicy =
  | Readonly<{ kind: "step"; step: number }>
  | Readonly<{ kind: "significant-figures"; digits: number }>;

export class InvalidQuantizationPolicyError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidQuantizationPolicyError";
  }
}

function validatePolicy(policy: QuantizationPolicy): void {
  if (policy.kind === "step") {
    if (!Number.isFinite(policy.step) || policy.step <= 0) {
      throw new InvalidQuantizationPolicyError(
        `A step policy needs a finite positive step, got ${policy.step}.`,
      );
    }
    return;
  }
  if (!Number.isInteger(policy.digits) || policy.digits < 1 || policy.digits > 100) {
    throw new InvalidQuantizationPolicyError(
      `A significant-figures policy needs an integer digit count in [1, 100], got ${policy.digits}.`,
    );
  }
}

/** Rounds to a fixed number of significant figures via decimal text (`toPrecision`), never by
 * multiplying and dividing by a power of ten, which loses digits at extreme magnitudes exactly
 * where this policy exists to preserve them. */
export function quantizeBySignificantFigures(value: number, digits: number): number {
  if (!Number.isFinite(value)) return value;
  if (value === 0) return 0;
  return Number(value.toPrecision(digits));
}

export function quantizeByStep(value: number, step: number): number {
  if (!Number.isFinite(value)) return value;
  if (value === 0) return 0;
  return Math.round(value / step) * step;
}

/** Quantizes one canonical SI value by its parameter's declared policy. `NaN` and infinities
 * pass through unchanged: quantizing a nonfinite value is not this module's job, and a caller
 * that reaches here with one already has a different, prior problem. */
export function quantizeValue(value: number, policy: QuantizationPolicy): number {
  validatePolicy(policy);
  return policy.kind === "step"
    ? quantizeByStep(value, policy.step)
    : quantizeBySignificantFigures(value, policy.digits);
}

export type ParameterQuantizationPolicies = Readonly<Record<string, QuantizationPolicy>>;

export class UnregisteredQuantizationPolicyError extends Error {
  readonly parameterId: string;
  constructor(parameterId: string) {
    super(`No quantization policy is declared for parameter "${parameterId}".`);
    this.name = "UnregisteredQuantizationPolicyError";
    this.parameterId = parameterId;
  }
}

/** Quantizes a named parameter value by the policy registered for it. Throws for a parameter
 * with no declared policy rather than silently falling back to a blanket precision that could
 * destroy a small value -- exactly the donor defect this module exists to fix. */
export function quantizeParameter(
  parameterId: string,
  value: number,
  policies: ParameterQuantizationPolicies,
): number {
  const policy = policies[parameterId];
  if (!policy) throw new UnregisteredQuantizationPolicyError(parameterId);
  return quantizeValue(value, policy);
}
