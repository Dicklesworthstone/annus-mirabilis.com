import { executionOutcomeRegistry } from "../../../experiments/results/outcomes.ts";
import { makeRefusal } from "../../../experiments/results/refusals.ts";
import { BM01_ALLOCATION, bm01Tile } from "../../../experiments/streams/allocation.ts";
import { createPhiloxStream, HOST_NORMAL_VERSION, parseU64 } from "../philox.ts";
import type { Computation } from "./ftcs.ts";

export const TRACER_BUDGET = Object.freeze({
  workUnits: 5_000_000,
  allocationBytes: 8 * 1024 * 1024,
});
export type TracerSetup = Readonly<{
  M: number;
  steps: number;
  h: number;
  D: number;
  seed: string;
}>;
export type TracerRecording = Readonly<{
  setup: TracerSetup;
  values: Float64Array;
  allocationId: string;
  normalVersion: string;
  draws: number;
}>;
const invalid = (ids: readonly string[], requirements: string): Computation<never> => ({
  kind: "refused",
  refusal: makeRefusal("invalid-parameter", { parameterIds: ids }, { details: { requirements } }),
});
function failure(reason: string): Computation<never> {
  return {
    kind: "outcome",
    outcome: {
      outcome: "invariant-violation",
      ...executionOutcomeRegistry["invariant-violation"],
      details: { reason },
    },
  };
}
export function observationGridCheck(
  interval: number,
  h: number,
  steps: number,
): Computation<number> {
  if (
    ![interval, h].every(Number.isFinite) ||
    h <= 0 ||
    interval < 0 ||
    !Number.isSafeInteger(steps) ||
    steps < 1
  )
    return invalid(["interval", "h"], "Use nonnegative time on a positive replay grid.");
  const ratio = interval / h,
    index = Math.round(ratio);
  if (
    (interval > 0 && index === 0) ||
    !Number.isSafeInteger(index) ||
    index > steps ||
    Math.abs(ratio - index) > 1e-9 * Math.max(1, ratio)
  ) {
    const nearest = [Math.floor(ratio), Math.ceil(ratio)].filter((i) => i >= 0 && i <= steps);
    return {
      kind: "refused",
      refusal: makeRefusal(
        "off-replay-grid",
        { parameterIds: ["interval"] },
        {
          details: { gridStep: h, maximumInterval: steps * h },
          rankedRepairs: [...new Set(nearest)]
            .map((i) => ({
              label: `Observe the recorded time ${i * h} seconds.`,
              action: { parameterId: "interval", value: i * h },
            }))
            .concat([
              {
                label: "Observe the end of this recording.",
                action: { parameterId: "interval", value: steps * h },
              },
            ]),
        },
      ),
    };
  }
  return { kind: "accepted", data: index };
}
/** Bounded full three-axis recording. Measurement, display and estimator changes read it without draws. */
export async function recordTracers(
  p: TracerSetup,
  options: {
    chunkSeries?: number;
    cancelled?: () => boolean;
    yieldControl?: () => Promise<void>;
  } = {},
): Promise<Computation<TracerRecording>> {
  if (
    !Number.isInteger(p.M) ||
    p.M < 1 ||
    p.M > 10000 ||
    !Number.isInteger(p.steps) ||
    p.steps < 1 ||
    p.steps > 30000 ||
    !Number.isFinite(p.h) ||
    p.h <= 0 ||
    !Number.isFinite(p.D) ||
    p.D < 0
  )
    return invalid(
      ["M", "steps", "h", "D"],
      "Use 1–10000 tracers, 1–30000 steps, a positive time resolution and nonnegative diffusivity.",
    );
  try {
    parseU64(p.seed);
  } catch {
    return { kind: "refused", refusal: makeRefusal("invalid-seed", { parameterIds: ["seed"] }) };
  }
  const workUnits = p.M * 3 * p.steps,
    allocationBytes = p.M * 3 * (p.steps + 1) * 8;
  if (workUnits > TRACER_BUDGET.workUnits || allocationBytes > TRACER_BUDGET.allocationBytes)
    return {
      kind: "outcome",
      outcome: {
        outcome: "budget-exhausted",
        ...executionOutcomeRegistry["budget-exhausted"],
        requested: { workUnits, allocationBytes },
        allowed: TRACER_BUDGET,
      },
    };
  const chunk = options.chunkSeries ?? 6;
  if (!Number.isSafeInteger(chunk) || chunk < 1 || chunk > 128)
    return invalid(["chunkSeries"], "Choose 1–128 series per chunk.");
  const amplitude = Math.sqrt(2 * p.D * p.h);
  if (!Number.isFinite(amplitude) || (p.D > 0 && amplitude === 0))
    return failure("The step amplitude is outside the representable range.");
  const values = new Float64Array(p.M * 3 * (p.steps + 1));
  const yieldControl =
    options.yieldControl ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  for (let series = 0; series < p.M * 3; series++) {
    if (series % chunk === 0) {
      if (options.cancelled?.())
        return {
          kind: "outcome",
          outcome: { outcome: "cancelled", ...executionOutcomeRegistry.cancelled },
        };
      await yieldControl();
    }
    const rng = createPhiloxStream({
      seed: p.seed,
      kernel: BM01_ALLOCATION.streamKernelId,
      tile: bm01Tile(Math.floor(series / 3), series % 3),
    });
    const offset = series * (p.steps + 1);
    let position = 0;
    for (let step = 1; step <= p.steps; step++) {
      position += rng.nextNormal() * amplitude;
      if (!Number.isFinite(position))
        return failure(
          "A sampled position exceeded the numerical range; no partial recording was accepted.",
        );
      values[offset + step] = position;
    }
  }
  if (options.cancelled?.())
    return {
      kind: "outcome",
      outcome: { outcome: "cancelled", ...executionOutcomeRegistry.cancelled },
    };
  return {
    kind: "accepted",
    data: Object.freeze({
      setup: Object.freeze({ ...p }),
      values,
      allocationId: BM01_ALLOCATION.allocationId,
      normalVersion: HOST_NORMAL_VERSION,
      draws: workUnits * 2,
    }),
  };
}
export type EnsembleMoments = Readonly<{
  M: number;
  axes: readonly Readonly<{
    mean: number;
    meanAbsolute: number;
    meanSquare: number;
    rms: number;
  }>[];
  meanNorm: number;
  meanSquareNorm: number;
  rmsNorm: number;
}>;
/** Compensated sums over ALL members, never a viewport-selected subset. Row-major M by d. */
export function ensembleMoments({
  displacements,
  d,
}: {
  displacements: Float64Array;
  d: number;
}): Computation<EnsembleMoments> {
  if (
    !(displacements instanceof Float64Array) ||
    ![1, 2, 3].includes(d) ||
    displacements.length === 0 ||
    displacements.length % d !== 0 ||
    displacements.length > 30000 ||
    !displacements.every(Number.isFinite)
  )
    return invalid(
      ["displacements", "d"],
      "Provide finite, row-major displacements with one, two or three coordinates per tracer.",
    );
  const M = displacements.length / d,
    sums = new Float64Array(d * 3 + 1),
    corrections = new Float64Array(d * 3 + 1);
  function add(i: number, v: number) {
    const corr = corrections[i] ?? 0,
      sum = sums[i] ?? 0,
      y = v - corr,
      t = sum + y;
    corrections[i] = t - sum - y;
    sums[i] = t;
  }
  for (let i = 0; i < M; i++) {
    let norm = 0;
    for (let j = 0; j < d; j++) {
      const v = displacements[i * d + j];
      if (v === undefined) return failure("A required displacement coordinate was undefined.");
      if (v !== 0 && v * v === 0)
        return failure("A nonzero squared displacement is below the representable range.");
      add(j * 3, v);
      add(j * 3 + 1, Math.abs(v));
      add(j * 3 + 2, v * v);
      norm = Math.hypot(norm, v);
    }
    add(d * 3, norm);
  }
  const axes = Array.from({ length: d }, (_, j) => {
    const mean = (sums[j * 3] ?? 0) / M;
    const meanAbsolute = (sums[j * 3 + 1] ?? 0) / M;
    const meanSquare = (sums[j * 3 + 2] ?? 0) / M;
    return {
      mean,
      meanAbsolute,
      meanSquare,
      rms: Math.sqrt(meanSquare),
    };
  });
  const meanSquareNorm = axes.reduce((s, a) => s + a.meanSquare, 0);
  if (![...sums, meanSquareNorm].every(Number.isFinite))
    return failure("The moment reduction exceeded the numerical range.");
  return {
    kind: "accepted",
    data: {
      M,
      axes,
      meanNorm: (sums[d * 3] ?? 0) / M,
      meanSquareNorm,
      rmsNorm: Math.sqrt(meanSquareNorm),
    },
  };
}
export function displacementHistogram(
  values: Float64Array,
  edges: Float64Array,
): Computation<{ counts: Float64Array; underflow: number; overflow: number; total: number }> {
  if (
    values.length === 0 ||
    values.length > 10000 ||
    edges.length < 2 ||
    edges.length > 1001 ||
    !values.every(Number.isFinite) ||
    !edges.every((v, i) => {
      if (!Number.isFinite(v)) return false;
      if (i === 0) return true;
      const prev = edges[i - 1];
      return prev !== undefined && v > prev;
    })
  )
    return invalid(
      ["values", "edges"],
      "Use finite samples and strictly increasing histogram edges.",
    );
  const counts = new Float64Array(edges.length - 1);
  let underflow = 0,
    overflow = 0;
  const firstEdge = edges[0];
  const lastEdge = edges[edges.length - 1];
  if (firstEdge === undefined || lastEdge === undefined)
    return invalid(["edges"], "Histogram edges array must contain at least two finite bounds.");
  for (const value of values) {
    if (value < firstEdge) {
      underflow++;
      continue;
    }
    if (value > lastEdge) {
      overflow++;
      continue;
    }
    let lo = 0,
      hi = edges.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >>> 1;
      const edgeMid = edges[mid];
      if (edgeMid !== undefined && value < edgeMid) hi = mid;
      else lo = mid;
    }
    const bin = Math.min(lo, counts.length - 1);
    const prevCount = counts[bin];
    if (prevCount !== undefined) {
      counts[bin] = prevCount + 1;
    }
  }
  return { kind: "accepted", data: { counts, underflow, overflow, total: values.length } };
}
export function tracerDisplacements(
  recording: TracerRecording,
  step: number,
  d: number,
): Float64Array {
  const { M, steps } = recording.setup;
  if (!Number.isSafeInteger(step) || step < 0 || step > steps || ![1, 2, 3].includes(d))
    throw new RangeError("Choose a recorded step and dimension.");
  const values = new Float64Array(M * d);
  for (let i = 0; i < M; i++)
    for (let axis = 0; axis < d; axis++) {
      const idx = (i * 3 + axis) * (steps + 1) + step;
      const val = recording.values[idx];
      if (val === undefined) {
        throw new RangeError(`Recording value at index ${idx} is undefined.`);
      }
      values[i * d + axis] = val;
    }
  return values;
}
