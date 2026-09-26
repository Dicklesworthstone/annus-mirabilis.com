import {
  BM05_OUTPUTS,
  type Bm05Parameters,
  bm05BinCount,
  WALK_TRACE_POINTS,
  walkComparisonSteps,
} from "../../experiments/bm05/definition.ts";
import { validateBm05Parameters } from "../../experiments/bm05/parameters.ts";
import { executionOutcomeRegistry } from "../../experiments/results/outcomes.ts";
import { makeRefusal } from "../../experiments/results/refusals.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import { intervalProbability } from "../../physics/reference/diffusion/distributions.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import {
  displacementHistogram,
  ensembleMoments,
} from "../../physics/reference/diffusion/tracers.ts";
import {
  coinWalkDistribution,
  continuumLimit,
  dkwBound,
  kernelDiffusivity,
  kernelMoments,
  kolmogorovDistanceToGaussian,
  kolmogorovShapeTerm,
  randomWalkMoments,
  type ShapeTerm,
  uniformSumDistribution,
  WALK_KERNELS,
} from "../../physics/reference/diffusion/walkLaws.ts";
import {
  HOST_WALK_DRAW_OWNER,
  observeWalks,
  recordWalks,
  type WalkExecutionOptions,
  type WalkRecording,
} from "../../physics/reference/diffusion/walks.ts";
export type Bm05Evaluation = Readonly<{
  outputs: readonly ScientificResult[];
  stepIndex: number;
  simulationTime: number;
}>;
const shapes = new Map<string, ShapeTerm>();
function shape(p: Bm05Parameters, n: number): Computation<ShapeTerm> {
  const key = `${p.kernel}/${n}`,
    cached = shapes.get(key);
  if (cached) return { kind: "accepted", data: cached };
  const r = kolmogorovShapeTerm(p.kernel, n);
  if (r.kind === "accepted") {
    if (shapes.size >= 128) {
      const oldestKey = shapes.keys().next().value;
      if (oldestKey !== undefined) shapes.delete(oldestKey);
    }
    shapes.set(key, r.data);
  }
  return r;
}
const fail = (): Computation<never> => ({
  kind: "outcome",
  outcome: { outcome: "invariant-violation", ...executionOutcomeRegistry["invariant-violation"] },
});
function scalar(r: ScientificResult): number {
  if (r.status !== "value" || typeof r.value !== "number")
    throw new RangeError("A required law value is unavailable.");
  return r.value;
}
function unwrap<T>(r: Computation<T>): T {
  if (r.kind !== "accepted") throw new RangeError("A reduction failed.");
  return r.data;
}
function number(id: string, v: number | Float64Array): ScientificResult {
  const c = BM05_OUTPUTS[id];
  if (!c) throw new RangeError(`Unknown BM05 output: ${id}`);
  if (typeof v === "number" ? !Number.isFinite(v) : !v.every(Number.isFinite))
    throw new RangeError("A result is not finite.");
  return {
    quantityId: id,
    unit: c.unit,
    semanticKind: c.semanticKind,
    ownerId: c.ownerId,
    status: "value",
    value: v,
  };
}
function notApplicable(id: string, reason: string): ScientificResult {
  const c = BM05_OUTPUTS[id];
  if (!c) throw new RangeError(`Unknown BM05 output: ${id}`);
  return {
    quantityId: id,
    unit: c.unit,
    semanticKind: c.semanticKind,
    ownerId: c.ownerId,
    status: "not-applicable",
    reason,
  };
}
const rename = (id: string, r: ScientificResult): ScientificResult => ({ ...r, quantityId: id });
/**
 * An output read straight from the draws: its registered owner when this reference drew them, and
 * the drawing engine's owner when another did (protocol/bm05.ts admits only
 * fs-wasm.philox_normals, and only for a Gaussian walk).
 */
function drawn(recording: WalkRecording, id: string, v: number | Float64Array): ScientificResult {
  const r = number(id, v);
  return recording.drawOwner === HOST_WALK_DRAW_OWNER ? r : { ...r, ownerId: recording.drawOwner };
}
export async function createBm05Recording(
  input: unknown,
  options: WalkExecutionOptions = {},
): Promise<Computation<WalkRecording>> {
  const valid = validateBm05Parameters(input);
  if (valid.kind !== "accepted") return valid;
  const p = valid.data;
  const moments = kernelMoments({ kind: p.kernel, stepRms: p.stepRms }),
    coefficient = kernelDiffusivity({ kind: p.kernel, stepRms: p.stepRms }, p.tau).diffusion;
  if (Object.values(moments).some((r) => r.status !== "value") || coefficient.status !== "value")
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["stepRms", "tau"] },
        {
          details: {
            requirements: "The step moments and coefficient must fit the declared numerical range.",
          },
        },
      ),
    };
  if (p.kernel === "uniform" && p.n > 400) {
    const limited = kolmogorovShapeTerm(p.kernel, p.n);
    if (limited.kind !== "accepted") return limited;
  }
  return recordWalks(
    {
      walkers: p.walkers,
      runSteps: p.runSteps,
      stepRms: p.stepRms,
      tau: p.tau,
      kernel: p.kernel,
      seed: p.seed,
    },
    p.n,
    options,
  );
}
/** Owns all law values, bins, convergence comparisons and analytic teaching deviations. */
export async function measureBm05(
  recording: WalkRecording,
  p: Bm05Parameters,
  reused: boolean,
  options: WalkExecutionOptions = {},
): Promise<Computation<Bm05Evaluation>> {
  const valid = validateBm05Parameters(p);
  if (valid.kind !== "accepted") return valid;
  if (
    Object.keys(recording.setup).some(
      (k) =>
        !Object.is(
          recording.setup[k as keyof typeof recording.setup],
          p[k as keyof Bm05Parameters],
        ),
    )
  )
    return fail();
  if (p.kernel === "uniform" && p.n > 400) {
    const limited = kolmogorovShapeTerm(p.kernel, p.n);
    if (limited.kind !== "accepted") return limited;
  }
  const observation = await observeWalks(recording, p.n, options);
  if (observation.kind !== "accepted") return observation;
  try {
    const k = { kind: p.kernel, stepRms: p.stepRms },
      km = kernelMoments(k),
      D = kernelDiffusivity(k, p.tau).diffusion;
    const model = unwrap(randomWalkMoments(p.stepRms, p.tau, p.n));
    const samples = observation.data.positions,
      axes = unwrap(ensembleMoments({ displacements: samples, d: 1 })).axes,
      stats = axes[0];
    if (!stats) throw new RangeError("Missing 1D ensemble moments axis.");
    const sampling = unwrap(dkwBound(p.walkers, 0.001));
    const outputs: ScientificResult[] = [
      km.mean,
      km.secondMoment,
      km.fourthMoment,
      D,
      number("stepKurtosis", WALK_KERNELS[p.kernel].excessKurtosis),
      number("sampleMean", stats.mean),
      number("sampleMeanSquare", stats.meanSquare),
      number("sampleRms", stats.rms),
      number("modelMeanSquare", model.meanSquare),
      number("modelRms", model.rms),
      number("elapsedTime", model.elapsedTime),
      number("samplingTerm", sampling),
      number("walkerCount", p.walkers),
      drawn(recording, "walkPositions", samples),
    ];
    if (p.n === 0)
      for (const id of [
        "sumKurtosis",
        "kolmogorovDistance",
        "shapeTerm",
        "agreementBound",
        "withinBound",
      ])
        outputs.push(
          notApplicable(
            id,
            "Before any steps there is a point mass, not a finite-width Gaussian comparison.",
          ),
        );
    else {
      const distance = unwrap(kolmogorovDistanceToGaussian(samples, model.meanSquare)),
        term = shape(p, p.n);
      if (term.kind !== "accepted") return term;
      outputs.push(
        number("sumKurtosis", WALK_KERNELS[p.kernel].excessKurtosis / p.n),
        number("kolmogorovDistance", distance),
        number("shapeTerm", term.data.distance),
        number("agreementBound", term.data.distance + sampling),
        number("withinBound", distance <= term.data.distance + sampling ? 1 : 0),
      );
    }
    const count = bm05BinCount(p);
    let edges: Float64Array;
    if (p.n === 0) edges = new Float64Array([-p.stepRms, p.stepRms]);
    else if (p.kernel === "coin") {
      const atoms = p.n <= 40 ? 1 : Math.ceil((5 * Math.sqrt(p.n)) / count);
      let left = -count * atoms;
      if (Math.abs(left - (p.n + 1)) % 2 === 1) left++;
      edges = Float64Array.from(
        { length: count + 1 },
        (_, i) => (left + 2 * i * atoms) * p.stepRms,
      );
    } else
      edges = Float64Array.from(
        { length: count + 1 },
        (_, i) => ((2 * i) / count - 1) * 5 * model.rms,
      );
    const hist = unwrap(displacementHistogram(samples, edges));
    const gaussian = Float64Array.from({ length: count }, (_, i) => {
      const e0 = edges[i] ?? 0,
        e1 = edges[i + 1] ?? 0;
      return p.n === 0
        ? 1
        : scalar(intervalProbability(e0, e1, p.n, model.diffusion * p.tau).result);
    });
    let exact: Float64Array;
    if (p.n === 0) exact = new Float64Array([1]);
    else if (p.kernel === "coin") {
      const law = unwrap(coinWalkDistribution(p.n, p.stepRms));
      exact = new Float64Array(count);
      for (let i = 0; i < law.positions.length; i++) {
        const x = law.positions[i];
        if (x === undefined) continue;
        const prob = law.probabilities[i] ?? 0;
        for (let j = 0; j < count; j++) {
          const ej0 = edges[j] ?? 0,
            ej1 = edges[j + 1] ?? 0;
          if (x >= ej0 && (x < ej1 || (j === count - 1 && x === ej1))) {
            exact[j] = (exact[j] ?? 0) + prob;
            break;
          }
        }
      }
    } else if (p.kernel === "gaussian") exact = gaussian.slice();
    else {
      const width = 2 * Math.sqrt(3) * p.stepRms;
      exact = Float64Array.from({ length: count }, (_, i) => {
        const ei0 = edges[i] ?? 0,
          ei1 = edges[i + 1] ?? 0;
        const lo = p.n / 2 + ei0 / width,
          hi = p.n / 2 + ei1 / width;
        return lo >= p.n / 2
          ? uniformSumDistribution(p.n, p.n - lo).cdf - uniformSumDistribution(p.n, p.n - hi).cdf
          : uniformSumDistribution(p.n, hi).cdf - uniformSumDistribution(p.n, lo).cdf;
      });
    }
    outputs.push(
      number("histogramEdges", edges),
      number("histogramCounts", hist.counts),
      number(
        "histogramFrequencies",
        Float64Array.from(hist.counts, (c) => c / p.walkers),
      ),
      number("histogramGaussian", gaussian),
      number("histogramExact", exact),
      number("underflow", hist.underflow),
      number("overflow", hist.overflow),
    );
    if (p.kernel === "coin" && p.n <= 16) {
      const coin = unwrap(coinWalkDistribution(p.n, p.stepRms));
      const numerators = coin.coefficients
        ? Float64Array.from(coin.coefficients, Number)
        : new Float64Array(0);
      outputs.push(
        number("coinPositions", coin.positions),
        number("coinProbabilities", coin.probabilities),
        number("coinNumerators", numerators),
        number("coinDenominator", Number(coin.denominator)),
      );
    } else
      for (const id of ["coinPositions", "coinProbabilities", "coinNumerators", "coinDenominator"])
        outputs.push(
          notApplicable(
            id,
            "Exact integer fractions are shown for the coin through sixteen steps; the finite-step law still contributes to the histogram and shape comparison.",
          ),
        );
    const times = new Float64Array(WALK_TRACE_POINTS),
      traces = new Float64Array(Math.min(20, p.walkers) * WALK_TRACE_POINTS);
    for (let j = 0; j < WALK_TRACE_POINTS; j++) {
      const step = Math.floor((p.n * j) / (WALK_TRACE_POINTS - 1));
      times[j] = step * p.tau;
      for (let i = 0; i < Math.min(20, p.walkers); i++)
        traces[i * WALK_TRACE_POINTS + j] = recording.traceValues[i * (p.runSteps + 1) + step] ?? 0;
    }
    outputs.push(number("traceTimes", times), drawn(recording, "traceDisplacements", traces));
    const indices = walkComparisonSteps(p),
      msd = new Float64Array(indices.length),
      theory = new Float64Array(indices.length),
      distances = new Float64Array(indices.length),
      terms = new Float64Array(indices.length);
    let replayed = observation.data.replayedDraws;
    for (let i = 0; i < indices.length; i++) {
      if (options.cancelled?.())
        return {
          kind: "outcome",
          outcome: { outcome: "cancelled", ...executionOutcomeRegistry.cancelled },
        };
      const n = indices[i];
      if (n === undefined) continue;
      const seen = await observeWalks(recording, n, options);
      if (seen.kind !== "accepted") return seen;
      replayed += seen.data.replayedDraws;
      const momAxes = unwrap(ensembleMoments({ displacements: seen.data.positions, d: 1 })).axes;
      const mom0 = momAxes[0];
      if (!mom0) throw new RangeError("Missing ensemble moments axis.");
      msd[i] = mom0.meanSquare;
      const th = unwrap(randomWalkMoments(p.stepRms, p.tau, n)).meanSquare;
      theory[i] = th;
      distances[i] = unwrap(kolmogorovDistanceToGaussian(seen.data.positions, th));
      const term = shape(p, n);
      if (term.kind !== "accepted") return term;
      terms[i] = term.data.distance;
    }
    outputs.push(
      number("comparisonSteps", Float64Array.from(indices)),
      number("comparisonSampleMsd", msd),
      number("comparisonModelMsd", theory),
      number("comparisonDistance", distances),
      number("comparisonShape", terms),
    );
    const biased = { kind: "biased-coin" as const, stepRms: p.stepRms, probability: p.bias },
      bm = kernelMoments(biased),
      bd = kernelDiffusivity(biased, p.tau);
    outputs.push(
      rename("biasedDiffusion", bd.diffusion),
      rename("biasedMean", bm.mean),
      rename("biasedDrift", bd.drift),
      rename("biasedCenteredDiffusion", bd.centeredDiffusion),
      rename(
        "cauchyDiffusion",
        kernelDiffusivity({ kind: "cauchy", scale: p.stepRms }, p.tau).diffusion,
      ),
      rename(
        "continuumLimit",
        continuumLimit({ stepScale: p.stepRms, tau: p.tau, scaling: "fixed-step" }),
      ),
    );
    const intervals = new Float64Array(4),
      fixed = new Float64Array(4),
      stepSizes = new Float64Array(4),
      ratios = new Float64Array(4);
    for (let i = 0; i < 4; i++) {
      const factor = 10 ** i;
      const tau_i = p.tau / factor;
      const step_i = p.stepRms / Math.sqrt(factor);
      intervals[i] = tau_i;
      stepSizes[i] = step_i;
      fixed[i] = scalar(
        continuumLimit({ stepScale: p.stepRms, tau: tau_i, scaling: "fixed-ratio" }),
      );
      ratios[i] = scalar(continuumLimit({ stepScale: step_i, tau: tau_i, scaling: "fixed-ratio" }));
    }
    outputs.push(
      number("continuumIntervals", intervals),
      number("fixedStepCoefficients", fixed),
      number("fixedRatioSteps", stepSizes),
      number("fixedRatioCoefficients", ratios),
    );
    outputs.push(
      drawn(recording, "recordingDraws", recording.draws),
      number("requestDraws", (reused ? 0 : recording.draws) + replayed),
      drawn(recording, "replayedDraws", replayed),
      number("reusedRecording", reused ? 1 : 0),
      number(
        "retainedBytes",
        recording.traceValues.byteLength +
          [...recording.checkpoints.values()].reduce((s, a) => s + a.byteLength, 0),
      ),
    );
    return {
      kind: "accepted",
      data: { outputs, stepIndex: p.runSteps, simulationTime: p.runSteps * p.tau },
    };
  } catch {
    return fail();
  }
}
