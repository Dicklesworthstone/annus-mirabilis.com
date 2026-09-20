import {
  type ExecutionOutcome,
  executionOutcomeRegistry,
  type WorkBudget,
} from "../../../experiments/results/outcomes.ts";
import { makeRefusal, type RequestRefusal } from "../../../experiments/results/refusals.ts";

/** Uses the existing accepted/refused/execution-outcome contract, not a new output status. */
export type ZeroFluxComputation<T> = Readonly<
  | { kind: "accepted"; data: T }
  | { kind: "refused"; refusal: RequestRefusal }
  | { kind: "outcome"; outcome: ExecutionOutcome }
>;
type Failure = Exclude<ZeroFluxComputation<never>, { kind: "accepted" }>;

export const REFERENCE_ZERO_FLUX_BUDGET: WorkBudget = Object.freeze({
  workUnits: 4_000_000,
  allocationBytes: 16_000_000,
});
export type ZeroFluxOptions = Readonly<{
  /** Normalized L1 SERIES truncation target; NOT a floating-point error guarantee. */
  truncationTolerance?: number;
  budget?: WorkBudget;
}>;
export type ZeroFluxEvolution = Readonly<{
  values: Float64Array;
  dimensionlessTime: number;
  method: "identity" | "equilibrium" | "poisson-uniformization" | "neumann-cosine";
  terms: number;
  /** Exact-arithmetic bound divided by the initial total mass. */
  truncationL1Bound: number;
  /** Heuristic, explicitly not a certified enclosure of native transcendental functions. */
  roundoffL1Estimate: number;
  /** Measured normalized L1 change from positivity/mass/maximum-principle roundoff repairs. */
  roundoffL1Correction: number;
  requestedBudget: WorkBudget;
  boundary: "zero-flux";
  referenceModel: "continuous-time finite-volume grid";
  ownerId: "diffusion.zeroFluxEvolution";
}>;

function invalid(parameterIds: readonly string[], requirements: string): Failure {
  return {
    kind: "refused",
    refusal: makeRefusal("invalid-parameter", { parameterIds }, { details: { requirements } }),
  };
}
function numerical(reason: string): Failure {
  return {
    kind: "outcome",
    outcome: {
      outcome: "invariant-violation",
      ...executionOutcomeRegistry["invariant-violation"],
      details: { reason },
    },
  };
}
function budgetCheck(requested: WorkBudget, budget: WorkBudget): Failure | null {
  if (
    !budget ||
    ![requested.workUnits, requested.allocationBytes, budget.workUnits, budget.allocationBytes]
      .every((v) => Number.isSafeInteger(v) && v >= 0)
  ) return invalid(["workBudget"], "Work and allocation limits must be nonnegative safe integers.");
  const allowed = Object.freeze({
    workUnits: Math.min(budget.workUnits, REFERENCE_ZERO_FLUX_BUDGET.workUnits),
    allocationBytes: Math.min(budget.allocationBytes, REFERENCE_ZERO_FLUX_BUDGET.allocationBytes),
  });
  if (requested.workUnits <= allowed.workUnits && requested.allocationBytes <= allowed.allocationBytes)
    return null;
  return {
    kind: "outcome",
    outcome: {
      outcome: "budget-exhausted",
      ...executionOutcomeRegistry["budget-exhausted"],
      requested,
      allowed,
    },
  };
}
function sum(values: Float64Array | readonly number[]): number {
  let total = 0;
  let correction = 0;
  for (const value of values) {
    const adjusted = value - correction;
    const next = total + adjusted;
    correction = next - total - adjusted;
    total = next;
  }
  return total;
}
function accumulate(values: Float64Array, corrections: Float64Array, i: number, term: number) {
  const current = values[i]!;
  const adjusted = term - corrections[i]!;
  const next = current + adjusted;
  corrections[i] = next - current - adjusted;
  values[i] = next;
}

/**
 * Evaluate exp(tau Q) f, where Q has rows [-1,1], [1,-2,1], ..., [1,-1].
 * Thus tau = D*t/dx^2, with the SAME reflecting finite-volume operator as ftcsAdvance.
 * This is independent of Euler stepping. It measures temporal error, not continuum/spatial error.
 *
 * For short times, uniformization is a positive mixture of powers of P = I + Q/2.
 * For long times, Neumann cosine modes avoid work proportional to elapsed time.
 * Both series are truncated explicitly; roundoff is reported separately from truncation.
 * Inputs, including on refused/failed calls, are never modified.
 */
export function zeroFluxEvolution(
  input: Float64Array,
  dimensionlessTime: number,
  options: ZeroFluxOptions = {},
): ZeroFluxComputation<ZeroFluxEvolution> {
  if (
    !(input instanceof Float64Array) ||
    !(input.buffer instanceof ArrayBuffer) ||
    input.length < 3
  ) return invalid(["field"], "Provide at least three cells in a privately owned Float64Array.");
  if (!options || typeof options !== "object")
    return invalid(["options"], "Provide an options object.");
  const tolerance = options.truncationTolerance ?? 1e-12;
  const budget = options.budget ?? REFERENCE_ZERO_FLUX_BUDGET;
  if (!Number.isFinite(dimensionlessTime) || dimensionlessTime < 0)
    return invalid(["dimensionlessTime"], "Use a finite nonnegative D*t/dx^2.");
  if (!Number.isFinite(tolerance) || tolerance < 1e-15 || tolerance > 1e-3)
    return invalid(["truncationTolerance"], "Use a series truncation tolerance in [1e-15, 1e-3].");

  const n = input.length;
  // Upper bound on numerical payloads, including scratch and at most 256 Poisson weights.
  // workUnits count scalar cell/mode visits, not elapsed milliseconds or CPU instructions.
  const allocationBytes = 64 * n + 2048;
  const minimumBudget = Object.freeze({ workUnits: 12 * n, allocationBytes });
  const initialLimit = budgetCheck(minimumBudget, budget);
  if (initialLimit) return initialLimit;
  let maximum = 0;
  let minimum = Infinity;
  for (const value of input) {
    if (!Number.isFinite(value) || value < 0)
      return invalid(["field"], "Every cell must be finite and nonnegative.");
    maximum = Math.max(maximum, value);
    minimum = Math.min(minimum, value);
  }
  const accepted = (
    values: Float64Array,
    method: ZeroFluxEvolution["method"],
    terms: number,
    truncationL1Bound: number,
    roundoffL1Estimate: number,
    roundoffL1Correction: number,
    requestedBudget: WorkBudget,
  ): ZeroFluxComputation<ZeroFluxEvolution> => ({
    kind: "accepted",
    data: Object.freeze({
      values, dimensionlessTime, method, terms, truncationL1Bound,
      roundoffL1Estimate, roundoffL1Correction, requestedBudget,
      boundary: "zero-flux",
      referenceModel: "continuous-time finite-volume grid",
      ownerId: "diffusion.zeroFluxEvolution",
    }),
  });
  if (dimensionlessTime === 0 || minimum === maximum)
    return accepted(input.slice(), dimensionlessTime === 0 ? "identity" : "equilibrium",
      0, 0, 0, 0, minimumBudget);

  let modes = 0;
  let truncationBound = 0;
  const weights: number[] = [];
  const shortTime = dimensionlessTime <= 16;
  if (shortTime) {
    const mu = 2 * dimensionlessTime;
    let weight = Math.exp(-mu);
    for (let k = 0; k < 256; k++) {
      weights.push(weight);
      const nextWeight = weight * (mu / (k + 1));
      if (k + 2 > mu) {
        // Successive omitted weight ratios are <= mu/(k+2).
        const tail = nextWeight / (1 - mu / (k + 2));
        // Renormalizing the retained Poisson mixture costs at most 2*tail in L1.
        truncationBound = Math.max(Number.MIN_VALUE, 2 * tail);
        if (truncationBound <= tolerance) break;
      }
      weight = nextWeight;
    }
    if (!(truncationBound <= tolerance))
      return numerical("The Poisson series did not reach its declared truncation target.");
  } else {
    for (let k = 1; k < n; k++) {
      const sine = Math.sin((Math.PI * k) / (2 * n));
      // A normalized source has cosine coefficients with magnitude <= 2/n.
      // The omitted normalized L1 norm is <= 2*(n-k)*exp(-lambda_k*tau).
      const logTail = Math.log(2 * (n - k)) - dimensionlessTime * (4 * sine * sine);
      if (logTail <= Math.log(tolerance)) {
        truncationBound = Math.max(Number.MIN_VALUE, Math.exp(logTail));
        break;
      }
      modes = k;
    }
  }
  const terms = shortTime ? weights.length : modes;
  const requestedBudget = Object.freeze({
    workUnits: n * (12 + (shortTime ? 4 * terms : 6 * modes)),
    allocationBytes,
  });
  const limited = budgetCheck(requestedBudget, budget);
  if (limited) return limited;

  // Normalize without ever forming the possibly overflowing total sum of raw densities.
  const p = Float64Array.from(input, (v) => v / maximum);
  const scaledMass = sum(p);
  for (let i = 0; i < n; i++) p[i] = p[i]! / scaledMass;
  const q = new Float64Array(n);
  const corrections = new Float64Array(n);
  if (shortTime) {
    const retainedWeight = sum(weights);
    let current = p;
    let next = new Float64Array(n);
    for (let k = 0; k < weights.length; k++) {
      const weight = weights[k]! / retainedWeight;
      for (let i = 0; i < n; i++) accumulate(q, corrections, i, weight * current[i]!);
      if (k + 1 === weights.length) break;
      next[0] = 0.5 * current[0]! + 0.5 * current[1]!;
      for (let i = 1; i < n - 1; i++)
        next[i] = 0.5 * current[i - 1]! + 0.5 * current[i + 1]!;
      next[n - 1] = 0.5 * current[n - 2]! + 0.5 * current[n - 1]!;
      [current, next] = [next, current];
    }
  } else {
    q.fill(1 / n);
    for (let k = 1; k <= modes; k++) {
      let coefficient = 0;
      let correction = 0;
      for (let j = 0; j < n; j++) {
        const term = p[j]! * Math.cos((Math.PI * k * (j + 0.5)) / n) - correction;
        const next = coefficient + term;
        correction = next - coefficient - term;
        coefficient = next;
      }
      const sine = Math.sin((Math.PI * k) / (2 * n));
      const amplitude = (2 * coefficient / n) * Math.exp(-dimensionlessTime * (4 * sine * sine));
      for (let i = 0; i < n; i++)
        accumulate(q, corrections, i, amplitude * Math.cos((Math.PI * k * (i + 0.5)) / n));
    }
  }

  // This is deliberately labeled an estimate, not a proof of native Math.* accuracy.
  const roundoffEstimate = 32 * Number.EPSILON * n * (terms + 4);
  const repairAllowance = truncationBound + roundoffEstimate;
  let clippedMass = 0;
  for (let i = 0; i < n; i++) {
    const value = q[i]!;
    if (!Number.isFinite(value)) return numerical("A reference cell became nonfinite.");
    if (value < 0) {
      clippedMass -= value;
      q[i] = 0;
    }
  }
  const rawMass = sum(q);
  if (!(rawMass > 0) || clippedMass + Math.abs(rawMass - 1) > repairAllowance)
    return numerical("Reference positivity or mass error exceeded its numerical repair allowance.");
  let measuredCorrection = clippedMass;
  const values = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const original = q[i]!;
    const probability = original / rawMass;
    const scaledValue = probability * scaledMass;
    if (scaledValue > 1 + repairAllowance * scaledMass)
      return numerical("The reference violated the diffusion maximum principle.");
    const boundedValue = Math.min(1, scaledValue);
    measuredCorrection += Math.abs(probability - original) + (scaledValue - boundedValue) / scaledMass;
    values[i] = boundedValue * maximum;
    if (!Number.isFinite(values[i]!) || (boundedValue > 0 && values[i] === 0))
      return numerical("Reference density is outside binary64 range.");
    // Include subnormal rescaling loss rather than reporting normal-range precision for it.
    measuredCorrection += Math.abs(values[i]! / maximum - boundedValue) / scaledMass;
  }
  if (measuredCorrection > repairAllowance)
    return numerical("The measured roundoff repair exceeded its declared allowance.");
  return accepted(values, shortTime ? "poisson-uniformization" : modes === 0 ? "equilibrium" : "neumann-cosine",
    terms, truncationBound, roundoffEstimate, measuredCorrection, requestedBudget);
}
