import {
  type ExecutionOutcome,
  executionOutcomeRegistry,
  type WorkBudget,
} from "../../../experiments/results/outcomes.ts";
import { makeRefusal, type RequestRefusal } from "../../../experiments/results/refusals.ts";
import type { ScientificResult } from "../../../experiments/results/types.ts";
import { intervalProbability } from "./distributions.ts";

export type Computation<T> = Readonly<
  | { kind: "accepted"; data: T }
  | { kind: "refused"; refusal: RequestRefusal }
  | { kind: "outcome"; outcome: ExecutionOutcome }
>;
/** Host-only deterministic safety ceiling. Upstream budget/bitwise conformance is not yet certified. */
export const REFERENCE_FTCS_BUDGET: WorkBudget = Object.freeze({
  workUnits: 4_000_000,
  allocationBytes: 16_000_000,
});
export type FtcsParameters = Readonly<{
  n: number;
  frames: number;
  stepsPerFrame: number;
  D: number;
  dx: number;
  dt: number;
  profile: 0 | 1 | 2;
}>;
export type FtcsFrames = Readonly<{
  values: Float64Array;
  shape: readonly [number, number];
  stepCount: number;
  elapsedTime: number;
  stabilityRatio: number;
  boundary: "zero-flux";
  ownerId: "diffusion.ftcs1d";
}>;
const integer = (v: number, min = 0) => Number.isSafeInteger(v) && v >= min;
function invalid(parameterIds: readonly string[], details: string): Computation<never> {
  return {
    kind: "refused",
    refusal: makeRefusal(
      "invalid-parameter",
      { parameterIds },
      { details: { requirements: details } },
    ),
  };
}
function numerical(reason: string): Computation<never> {
  return {
    kind: "outcome",
    outcome: {
      outcome: "invariant-violation",
      ...executionOutcomeRegistry["invariant-violation"],
      details: { reason },
    },
  };
}
function budgetCheck(
  workUnits: number,
  allocationBytes: number,
  allowed: WorkBudget,
): Computation<never> | null {
  if (
    ![workUnits, allocationBytes, allowed.workUnits, allowed.allocationBytes].every((v) =>
      integer(v),
    )
  )
    return invalid(
      ["workBudget"],
      "Work and allocation counts must be representable nonnegative safe integers.",
    );
  if (workUnits > allowed.workUnits || allocationBytes > allowed.allocationBytes)
    return {
      kind: "outcome",
      outcome: {
        outcome: "budget-exhausted",
        ...executionOutcomeRegistry["budget-exhausted"],
        requested: { workUnits, allocationBytes },
        allowed: { ...allowed },
      },
    };
  // A caller may lower, but cannot bypass, the host safety ceiling.
  if (
    workUnits > REFERENCE_FTCS_BUDGET.workUnits ||
    allocationBytes > REFERENCE_FTCS_BUDGET.allocationBytes
  )
    return {
      kind: "outcome",
      outcome: {
        outcome: "budget-exhausted",
        ...executionOutcomeRegistry["budget-exhausted"],
        requested: { workUnits, allocationBytes },
        allowed: REFERENCE_FTCS_BUDGET,
      },
    };
  return null;
}
/** Move a positive finite number by one binary64 ULP; never relax the r <= 0.5 test. */
function adjacentPositive(value: number, upward: boolean): number {
  const bits = new DataView(new ArrayBuffer(8));
  bits.setFloat64(0, value, false);
  bits.setBigUint64(0, bits.getBigUint64(0, false) + (upward ? 1n : -1n), false);
  return bits.getFloat64(0, false);
}
function stableRepair(value: number, upward: boolean, ratio: (v: number) => number): number | null {
  for (let i = 0; i < 4; i++) {
    if (!(value > 0) || !Number.isFinite(value)) return null;
    const r = ratio(value);
    if (r > 0 && r <= 0.5) return value;
    value = adjacentPositive(value, upward);
  }
  return null;
}
/** Ascending-column sparse multiplication followed by a separate, unfused Euler update. */
function advanceInPlace(
  field: Float64Array,
  derivative: Float64Array,
  r: number,
  steps: number,
): boolean {
  if (r === 0) return true;
  const n = field.length;
  for (let step = 0; step < steps; step++) {
    const f0 = field[0];
    const f1 = field[1];
    if (f0 === undefined || f1 === undefined) return false;
    derivative[0] = -f0 + f1;
    for (let i = 1; i < n - 1; i++) {
      const prev = field[i - 1];
      const curr = field[i];
      const next = field[i + 1];
      if (prev === undefined || curr === undefined || next === undefined) return false;
      let sum = prev;
      sum += -2 * curr;
      sum += next;
      derivative[i] = sum;
    }
    const fn2 = field[n - 2];
    const fn1 = field[n - 1];
    if (fn2 === undefined || fn1 === undefined) return false;
    derivative[n - 1] = fn2 - fn1;
    for (let i = 0; i < n; i++) {
      const deriv = derivative[i];
      const current = field[i];
      if (deriv === undefined || current === undefined) return false;
      const increment = r * deriv;
      const next = current + increment;
      if (!Number.isFinite(next) || next < 0) return false;
      field[i] = next;
    }
  }
  return true;
}
/** Pure continuation: input is never modified, even if computation refuses or fails. */
export function ftcsAdvance(
  input: Float64Array,
  r: number,
  steps: number,
  budget = REFERENCE_FTCS_BUDGET,
): Computation<Float64Array> {
  if (
    !(input instanceof Float64Array) ||
    !(input.buffer instanceof ArrayBuffer) ||
    input.length < 3
  )
    return invalid(["field"], "Provide at least three cells in a privately owned Float64Array.");
  if (!Number.isFinite(r) || r < 0 || r > 0.5 || !integer(steps))
    return invalid(
      ["stabilityRatio", "steps"],
      "The continuation ratio must lie in [0, 0.5] and steps must be a nonnegative safe integer. Use ftcs1d for dimensional repairs.",
    );
  const limited = budgetCheck(input.length * steps, input.length * 16, budget);
  if (limited) return limited;
  if (!input.every((v) => Number.isFinite(v) && v >= 0))
    return invalid(["field"], "Every cell must be finite and nonnegative.");
  const field = input.slice();
  if (!advanceInPlace(field, new Float64Array(input.length), r, steps))
    return numerical("A cell became nonfinite or negative; no partial field is returned.");
  return { kind: "accepted", data: field };
}
export function ftcs1d(p: FtcsParameters, budget = REFERENCE_FTCS_BUDGET): Computation<FtcsFrames> {
  const { n, frames, stepsPerFrame, D, dx, dt, profile } = p;
  if (!integer(n, 3) || !integer(frames, 1) || !integer(stepsPerFrame, 1))
    return invalid(
      ["n", "frames", "stepsPerFrame"],
      "Use at least three cells and positive whole-number frame and step counts.",
    );
  if (![D, dx, dt].every(Number.isFinite))
    return {
      kind: "refused",
      refusal: makeRefusal("nonfinite-input", { parameterIds: ["D", "dx", "dt"] }),
    };
  if (D < 0 || dx <= 0 || dt <= 0 || ![0, 1, 2].includes(profile))
    return invalid(
      ["D", "dx", "dt", "profile"],
      "Use nonnegative D, positive dx and dt, and profile 0, 1, or 2.",
    );
  // This exact operation order is part of the planned upstream conformance contract.
  const r = D === 0 ? 0 : (D * dt) / (dx * dx);
  if (!Number.isFinite(r) || (D > 0 && r === 0))
    return numerical("The stability ratio is outside binary64 range; the grid was not advanced.");
  if (r > 0.5) {
    const dtMax = (dx * dx) / (2 * D);
    const dxMin = Math.sqrt(2 * D * dt);
    const dMax = (dx * dx) / (2 * dt);
    if (![dtMax, dxMin, dMax].every((v) => Number.isFinite(v) && v > 0))
      return numerical("The dimensional stability repairs are outside binary64 range.");
    // Mathematical bounds can round to a value with r=0.5000000000000001.
    // Preserve dtMax in the explanation; make each offered action executable.
    const dtRepair = stableRepair(dtMax, false, (v) => (D * v) / (dx * dx));
    const dxRepair = stableRepair(dxMin, true, (v) => (D * dt) / (v * v));
    const dRepair = stableRepair(dMax, false, (v) => (v * dt) / (dx * dx));
    if (dtRepair === null || dxRepair === null || dRepair === null)
      return numerical(
        "No representable repair was found near the dimensional stability boundary.",
      );
    return {
      kind: "refused",
      refusal: makeRefusal(
        "ftcs-unstable",
        { parameterIds: ["dt", "dx", "D"] },
        {
          details: { ratio: r, limit: 0.5, dtMax },
          rankedRepairs: [
            {
              label: "Reduce the time step to the explicit scheme's limit.",
              action: { parameterId: "dt", value: dtRepair },
            },
            {
              label: "Use a coarser spatial grid.",
              action: { parameterId: "dx", value: dxRepair },
            },
            {
              label: "Choose a smaller diffusivity; this changes the physical setup.",
              action: { parameterId: "D", value: dRepair },
            },
          ],
        },
      ),
    };
  }
  const stepCount = (frames - 1) * stepsPerFrame;
  const limited = budgetCheck(n * stepCount, 8 * n * (frames + 2), budget);
  if (limited) return limited;
  const elapsedTime = stepCount * dt;
  if (!Number.isFinite(elapsedTime) || (stepCount > 0 && elapsedTime === 0))
    return numerical("Elapsed model time is outside binary64 range.");
  const field = new Float64Array(n);
  if (profile === 0) field[Math.floor(n / 2)] = 1 / dx;
  else if (profile === 1) field.fill(1, 0, Math.floor(n / 2));
  else {
    field[Math.floor(n / 4)] = 0.5 / dx;
    field[Math.floor((3 * n) / 4)] = 0.5 / dx;
  }
  if (!field.every(Number.isFinite))
    return numerical("The initial cell density is outside binary64 range.");
  const derivative = new Float64Array(n);
  const values = new Float64Array(n * frames);
  values.set(field);
  for (let frame = 1; frame < frames; frame++) {
    if (!advanceInPlace(field, derivative, r, stepsPerFrame))
      return numerical("A cell became nonfinite or negative; no partial frames are returned.");
    values.set(field, frame * n);
  }
  return {
    kind: "accepted",
    data: Object.freeze({
      values,
      shape: Object.freeze([frames, n] as const),
      stepCount,
      elapsedTime,
      stabilityRatio: r,
      boundary: "zero-flux",
      ownerId: "diffusion.ftcs1d",
    }),
  };
}
export type FtcsComparison = Readonly<{
  cellProbabilities: Float64Array;
  cellMasses: Float64Array;
  maxCellMassDifference: ScientificResult;
  analyticMassInsideBox: number;
  wallContact: boolean;
  gridModel: "zero-flux finite box";
  analyticModel: "unbounded point-source Gaussian";
}>;
/** 2^-1022, the smallest normal binary64 number. */
const SMALLEST_NORMAL = 2.2250738585072014e-308;
/**
 * An upper bound on the unbounded Gaussian's probability for a cell that does not contain the
 * start: with z the nearer edge's distance in units of 2 sqrt(D t), the probability is at most
 * erfc(z) / 2, and erfc(z) <= exp(-z^2) for z >= 0. A cell containing the start, or a run at
 * t = 0 or D = 0, has no such bound here (Infinity).
 */
function farTailBound(lowerEdge: number, upperEdge: number, t: number, D: number): number {
  const nearer = lowerEdge > 0 ? lowerEdge : upperEdge < 0 ? -upperEdge : 0;
  if (!(nearer > 0) || !(t > 0) || !(D > 0)) return Number.POSITIVE_INFINITY;
  const z = nearer / (2 * Math.sqrt(D) * Math.sqrt(t));
  return 0.5 * Math.exp(-z * z);
}
/**
 * Cell probability, not density at the center, is the quantity comparable with field[i]*dx.
 *
 * A cell far out on a coarse grid has an unbounded-Gaussian probability too small for binary64:
 * intervalProbability then reports it as not representable, rather than as a physical zero. For
 * such a cell the comparison records 0, but only when farTailBound proves the exact value is below
 * 2^-1022, the smallest normal number. The recorded 0 is then wrong by less than that, which
 * none of the sums and differences below can register beside the central cells. Any other
 * unrepresentable cell still refuses. Until am-xry2 every such cell refused the whole
 * comparison, so the page's own "Use a coarser spatial grid." (0.927 um, 101 cells, 1 s) ended in
 * invariant-violation.
 */
export function ftcsAnalyticComparison({
  field,
  dx,
  t,
  D,
  startCell,
  wallTolerance = 1e-6,
}: {
  field: Float64Array;
  dx: number;
  t: number;
  D: number;
  startCell: number;
  wallTolerance?: number;
}): Computation<FtcsComparison> {
  if (
    !(field instanceof Float64Array) ||
    !(field.buffer instanceof ArrayBuffer) ||
    field.length < 3 ||
    !integer(startCell) ||
    startCell >= field.length
  )
    return invalid(
      ["field", "startCell"],
      "Use at least three cells and an in-range starting cell.",
    );
  if (
    ![dx, t, D, wallTolerance].every(Number.isFinite) ||
    dx <= 0 ||
    t < 0 ||
    D < 0 ||
    wallTolerance < 0 ||
    wallTolerance >= 1
  )
    return invalid(
      ["dx", "t", "D", "wallTolerance"],
      "Use positive dx, nonnegative t and D, and wallTolerance in [0, 1).",
    );
  const limited = budgetCheck(field.length, field.length * 16, REFERENCE_FTCS_BUDGET);
  if (limited) return limited;
  if (!field.every((v) => Number.isFinite(v) && v >= 0))
    return invalid(["field"], "Cell densities must be finite and nonnegative.");
  const probabilities = new Float64Array(field.length);
  const masses = new Float64Array(field.length);
  let maxDifference = 0;
  let massInBox = 0;
  let compensation = 0;
  for (let i = 0; i < field.length; i++) {
    const lowerEdge = (i - startCell - 0.5) * dx;
    const upperEdge = (i - startCell + 0.5) * dx;
    const probability = intervalProbability(lowerEdge, upperEdge, t, D).result;
    if (probability.status === "value" && typeof probability.value === "number")
      probabilities[i] = probability.value;
    else if (farTailBound(lowerEdge, upperEdge, t, D) < SMALLEST_NORMAL) probabilities[i] = 0;
    else
      return numerical(
        `Cell ${i}'s analytic probability is not representable; no fabricated zero was substituted.`,
      );
    const cellDensity = field[i];
    if (cellDensity === undefined) return numerical("A cell density is missing from the field.");
    const cellMass = cellDensity * dx;
    masses[i] = cellMass;
    if (!Number.isFinite(cellMass)) return numerical("A cell mass is outside binary64 range.");
    const storedMass = masses[i];
    const storedProb = probabilities[i];
    if (storedMass === undefined || storedProb === undefined)
      return numerical("A cell mass or probability is outside bounds.");
    maxDifference = Math.max(maxDifference, Math.abs(storedMass - storedProb));
    const corrected = storedProb - compensation;
    const next = massInBox + corrected;
    compensation = next - massInBox - corrected;
    massInBox = next;
  }
  const firstMass = masses[0];
  const lastMass = masses[field.length - 1];
  if (firstMass === undefined || lastMass === undefined)
    return numerical("Edge cell masses are undefined.");
  const wallContact =
    1 - massInBox > wallTolerance || firstMass > wallTolerance || lastMass > wallTolerance;
  return {
    kind: "accepted",
    data: Object.freeze({
      cellProbabilities: probabilities,
      cellMasses: masses,
      analyticMassInsideBox: massInBox,
      wallContact,
      maxCellMassDifference: Object.freeze({
        status: "value",
        value: maxDifference,
        quantityId: "maxCellMassDifference",
        unit: "1",
        semanticKind: "probability-difference",
        ownerId: "diffusion.ftcsAnalyticComparison",
      }),
      gridModel: "zero-flux finite box",
      analyticModel: "unbounded point-source Gaussian",
    }),
  };
}
