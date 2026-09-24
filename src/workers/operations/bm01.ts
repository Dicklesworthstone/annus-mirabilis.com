import {
  BM01_HOST_RECORDER_OWNER,
  BM01_OUTPUTS,
  type Bm01Parameters,
  comparisonIndices,
  HISTOGRAM_BINS,
  TRACE_COUNT,
  TRACE_POINTS,
} from "../../experiments/bm01/definition.ts";
import { validateBm01Parameters } from "../../experiments/bm01/parameters.ts";
import { executionOutcomeRegistry } from "../../experiments/results/outcomes.ts";
import { makeRefusal } from "../../experiments/results/refusals.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import { ownerAdmitted } from "../../experiments/store/instanceStore.ts";
import { getConstantSet } from "../../physics/reference/constants.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { ensembleMomentBands } from "../../physics/reference/diffusion/statistics.ts";
import {
  displacementHistogram,
  ensembleMoments,
  observationGridCheck,
  recordTracers,
  type TracerRecording,
  type TracerSetup,
  tracerDisplacements,
} from "../../physics/reference/diffusion/tracers.ts";
import { kolmogorovDistanceToGaussian } from "../../physics/reference/diffusion/walkLaws.ts";
import {
  apparentSpeed,
  intervalProbability,
  moments,
  rmsDisplacement,
  stokesEinsteinD,
} from "../../physics/reference/diffusion.ts";
export type Bm01Evaluation = Readonly<{
  outputs: readonly ScientificResult[];
  stepIndex: number;
  simulationTime: number;
}>;
/**
 * Who records the tracer ensemble. The host reference is the default. The worker may hand in
 * FrankenSim's compiled brownian_frames instead (src/workers/wasm/frankensimTracerRecorder.ts).
 * Either way the recording has the same layout, and every statistic below is the same host
 * reduction of it. Only the three outputs read straight from the recording name the recorder
 * as their owner.
 */
export type Bm01Recorder = Readonly<{
  ownerId: string;
  record(
    setup: TracerSetup,
    options: Parameters<typeof recordTracers>[1],
  ): Promise<Computation<TracerRecording>>;
}>;
export const HOST_TRACER_RECORDER: Bm01Recorder = Object.freeze({
  ownerId: BM01_HOST_RECORDER_OWNER,
  record: recordTracers,
});
function value(result: ScientificResult): number {
  if (result.status !== "value" || typeof result.value !== "number")
    throw new RangeError("A model value was not numerically representable.");
  return result.value;
}
function unwrap<T>(r: Computation<T> | ScientificResult): T {
  if (!("kind" in r) || r.kind !== "accepted")
    throw new RangeError("A reduction was not numerically representable.");
  return r.data;
}
function number(id: string, v: number | Float64Array, owner?: string): ScientificResult {
  const contract = BM01_OUTPUTS[id];
  if (!contract) throw new RangeError(`Unknown BM01 output: ${id}`);
  if (typeof v === "number" ? !Number.isFinite(v) : !v.every(Number.isFinite))
    throw new RangeError("Nonfinite result.");
  return {
    quantityId: id,
    unit: contract.unit,
    semanticKind: contract.semanticKind,
    ownerId: owner ?? contract.ownerId,
    status: "value",
    value: v,
  };
}
function notApplicable(id: string, reason: string): ScientificResult {
  const c = BM01_OUTPUTS[id];
  if (!c) throw new RangeError(`Unknown BM01 output: ${id}`);
  return {
    quantityId: id,
    unit: c.unit,
    semanticKind: c.semanticKind,
    ownerId: c.ownerId,
    status: "not-applicable",
    reason,
  };
}
function failed(): Computation<never> {
  return {
    kind: "outcome",
    outcome: { outcome: "invariant-violation", ...executionOutcomeRegistry["invariant-violation"] },
  };
}
export async function createBm01Recording(
  input: unknown,
  options: Parameters<typeof recordTracers>[1] = {},
  recorder: Bm01Recorder = HOST_TRACER_RECORDER,
): Promise<Computation<TracerRecording>> {
  const p = validateBm01Parameters(input);
  if (p.kind !== "accepted") return p;
  const D = stokesEinsteinD(p.data, getConstantSet("modern-si-2019")).result;
  if (D.status !== "value" || typeof D.value !== "number")
    return {
      kind: "refused",
      refusal: makeRefusal(
        "invalid-parameter",
        { parameterIds: ["T", "eta", "a"] },
        {
          details: {
            requirements:
              "These physical inputs do not produce a representable diffusion coefficient.",
          },
        },
      ),
    };
  const grid = observationGridCheck(p.data.interval, p.data.h, Math.round(p.data.H / p.data.h));
  if (grid.kind !== "accepted") return grid;
  return recorder.record(
    {
      M: p.data.M,
      steps: Math.round(p.data.H / p.data.h),
      h: p.data.h,
      D: D.value,
      seed: p.data.seed,
    },
    options,
  );
}
/** Every displayed statistic and model curve is assembled here, never inside a view. */
export function measureBm01(
  recording: TracerRecording,
  p: Bm01Parameters,
  reused: boolean,
  recordedBy: string = BM01_HOST_RECORDER_OWNER,
): Computation<Bm01Evaluation> {
  const checked = validateBm01Parameters(p);
  if (checked.kind !== "accepted") return checked;
  const positionsContract = BM01_OUTPUTS.tracerPositions;
  if (!positionsContract || !ownerAdmitted(positionsContract, recordedBy)) return failed();
  const selected = observationGridCheck(p.interval, p.h, recording.setup.steps);
  if (selected.kind !== "accepted") return selected;
  try {
    const D = recording.setup.D;
    if (
      p.M !== recording.setup.M ||
      p.seed !== recording.setup.seed ||
      p.h !== recording.setup.h ||
      Math.round(p.H / p.h) !== recording.setup.steps ||
      value(stokesEinsteinD(p, getConstantSet("modern-si-2019")).result) !== D
    )
      return failed();
    const step = selected.data,
      positions = tracerDisplacements(recording, step, 3);
    const all = unwrap(ensembleMoments({ displacements: positions, d: 3 })),
      measured = unwrap(
        ensembleMoments({ displacements: tracerDisplacements(recording, step, p.d), d: p.d }),
      );
    const axis = all.axes[p.axis];
    if (!axis) throw new RangeError(`Invalid axis: ${p.axis}`);
    const sigma = value(rmsDisplacement(D, p.interval).result),
      model = moments(p.d, D, p.interval);
    const constantSet = getConstantSet("modern-si-2019");
    const kbEntry = constantSet.entries.find((e) => e.quantityId === "boltzmannConstant");
    if (!kbEntry) throw new RangeError("Missing boltzmannConstant in constant set");
    const outputs: ScientificResult[] = [
      number("temperature", p.T),
      number("viscosity", p.eta),
      number("particleRadius", p.a),
      number("observationInterval", p.interval),
      number("boltzmannConstant", kbEntry.value),
      number("diffusionCoefficient", D),
      number("rmsDisplacement1d", sigma),
      number("modelSecondMoment", value(model.total.result)),
      number("modelMeanNorm", value(model.meanRadius.result)),
      number("modelRmsNorm", value(model.rmsRadius.result)),
      number("tracerPositions", positions, recordedBy),
    ];
    for (const [id, v] of [
      ["sampleMean", axis.mean],
      ["sampleMeanAbsolute", axis.meanAbsolute],
      ["sampleMeanSquare", axis.meanSquare],
      ["sampleRms", axis.rms],
      ["sampleMeanNorm", measured.meanNorm],
      ["sampleMeanSquareNorm", measured.meanSquareNorm],
      ["sampleRmsNorm", measured.rmsNorm],
    ] as const)
      outputs.push(number(id, v));
    for (const [id, speed] of [
      ["modelApparentSpeed", p.interval > 0 ? value(apparentSpeed(D, p.interval).result) : null],
      ["sampledApparentSpeed", p.interval > 0 ? axis.rms / p.interval : null],
    ] as const)
      outputs.push(
        speed === null
          ? notApplicable(id, "An apparent speed requires a positive observation interval.")
          : number(id, speed),
      );
    const traceTimes = new Float64Array(TRACE_POINTS),
      traces = new Float64Array(Math.min(TRACE_COUNT, p.M) * TRACE_POINTS * 2);
    for (let k = 0; k < TRACE_POINTS; k++) {
      const index = Math.floor((step * k) / (TRACE_POINTS - 1));
      traceTimes[k] = index * p.h;
      for (let i = 0; i < Math.min(TRACE_COUNT, p.M); i++)
        for (let a = 0; a < 2; a++)
          traces[(i * TRACE_POINTS + k) * 2 + a] =
            recording.values[(i * 3 + a) * (recording.setup.steps + 1) + index] ?? 0;
    }
    outputs.push(number("traceCoordinates", traces, recordedBy), number("traceTimes", traceTimes));
    const span = sigma > 0 ? 5 * sigma : 1e-6,
      edges = Float64Array.from(
        { length: HISTOGRAM_BINS + 1 },
        (_, i) => span * ((2 * i) / HISTOGRAM_BINS - 1),
      );
    const samples = Float64Array.from({ length: p.M }, (_, i) => positions[i * 3 + p.axis] ?? 0);
    const histogram = unwrap(displacementHistogram(samples, edges));
    const modelBins = Float64Array.from({ length: HISTOGRAM_BINS }, (_, i) => {
      const e0 = edges[i] ?? 0,
        e1 = edges[i + 1] ?? 0;
      return p.interval === 0
        ? e0 <= 0 && (0 < e1 || i === HISTOGRAM_BINS - 1)
          ? 1
          : 0
        : value(intervalProbability(e0, e1, p.interval, D).result);
    });
    outputs.push(
      number("histogramEdges", edges),
      number("histogramCounts", histogram.counts),
      number(
        "histogramFrequencies",
        histogram.counts.map((n) => n / p.M),
      ),
      number("histogramModel", modelBins),
      number("underflow", histogram.underflow),
      number("overflow", histogram.overflow),
    );
    const indices = comparisonIndices(recording.setup.steps),
      times = Float64Array.from(indices, (i) => i * p.h);
    const sampleMean = new Float64Array(indices.length);
    const sampleMsd = new Float64Array(indices.length);
    const sampleRms = new Float64Array(indices.length);
    const sampleApparent = new Float64Array(indices.length);
    const modelMean = new Float64Array(indices.length);
    const modelMsd = new Float64Array(indices.length);
    const modelRms = new Float64Array(indices.length);
    const modelApparent = new Float64Array(indices.length);

    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      if (idx === undefined) continue;
      const time = times[i] ?? 0;
      const xyz = tracerDisplacements(recording, idx, 3);
      const stats = unwrap(
        ensembleMoments({
          displacements: tracerDisplacements(recording, idx, p.d),
          d: p.d,
        }),
      );
      const axes = unwrap(ensembleMoments({ displacements: xyz, d: 3 })).axes;
      const coordinate = axes[p.axis];
      if (!coordinate) throw new RangeError(`Missing ensemble moment axis: ${p.axis}`);
      const prediction = moments(p.d, D, time);
      sampleMean[i] = coordinate.mean;
      sampleMsd[i] = stats.meanSquareNorm;
      sampleRms[i] = stats.rmsNorm;
      sampleApparent[i] = coordinate.rms / time;
      modelMean[i] = 0;
      modelMsd[i] = value(prediction.total.result);
      modelRms[i] = value(prediction.rmsRadius.result);
      modelApparent[i] = value(apparentSpeed(D, time).result);
    }
    const plots: Record<string, Float64Array> = {
      SampleMean: sampleMean,
      SampleMsd: sampleMsd,
      SampleRms: sampleRms,
      SampleApparent: sampleApparent,
      ModelMean: modelMean,
      ModelMsd: modelMsd,
      ModelRms: modelRms,
      ModelApparent: modelApparent,
    };
    outputs.push(number("plotTimes", times));
    for (const [id, data] of Object.entries(plots)) outputs.push(number(`plot${id}`, data));
    if (p.M < 2 || p.interval === 0) {
      for (const id of ["meanBand", "secondMomentBand"]) {
        const c = BM01_OUTPUTS[id];
        if (!c) continue;
        const common = {
          quantityId: id,
          unit: c.unit,
          semanticKind: c.semanticKind,
          ownerId: c.ownerId,
        };
        outputs.push(
          p.M < 2
            ? {
                ...common,
                status: "underdetermined",
                compatibleFamily: "One realization is not an ensemble sampling comparison.",
                neededInformation: ["Use at least two tracers."],
              }
            : {
                ...common,
                status: "analytic-limit",
                description:
                  "At the starting point all displacements and their sampling spread are zero.",
                representation: { kind: "coefficient", value: 0 },
              },
        );
      }
    } else {
      const bands = unwrap(
        ensembleMomentBands({ M: p.M, d: p.d, modelVariance: sigma * sigma, alphas: [0.001] }),
      );
      const band = bands[0];
      if (!band) throw new RangeError("Missing ensemble moment band");
      outputs.push(
        number("meanBand", Float64Array.from([-band.meanHalfWidth, band.meanHalfWidth])),
        number("secondMomentBand", Float64Array.from(band.totalMeanSquare)),
      );
    }
    outputs.push(
      number("recordingDraws", recording.draws, recordedBy),
      number("reusedRecording", reused ? 1 : 0),
      number("ensembleSize", p.M),
      number("signedMean", axis.mean),
      number("meanSquare", axis.meanSquare),
      number("lambdaX1s", value(rmsDisplacement(D, 1).result)),
      number("lambdaX60s", value(rmsDisplacement(D, 60).result)),
    );
    if (p.M < 2 || p.interval === 0) {
      for (const id of [
        "signedMeanLowerBand",
        "signedMeanUpperBand",
        "meanSquareLowerBand",
        "meanSquareUpperBand",
      ]) {
        const c = BM01_OUTPUTS[id];
        if (!c) continue;
        const common = {
          quantityId: id,
          unit: c.unit,
          semanticKind: c.semanticKind,
          ownerId: c.ownerId,
        };
        outputs.push(
          p.M < 2
            ? {
                ...common,
                status: "underdetermined",
                compatibleFamily: "One realization is not an ensemble sampling comparison.",
                neededInformation: ["Use at least two tracers."],
              }
            : {
                ...common,
                status: "analytic-limit",
                description:
                  "At the starting point all displacements and their sampling spread are zero.",
                representation: { kind: "coefficient", value: 0 },
              },
        );
      }
    } else {
      const bands = unwrap(
        ensembleMomentBands({ M: p.M, d: p.d, modelVariance: sigma * sigma, alphas: [0.001] }),
      );
      const band = bands[0];
      if (!band) throw new RangeError("Missing ensemble moment band");
      outputs.push(
        number("signedMeanLowerBand", -band.meanHalfWidth),
        number("signedMeanUpperBand", band.meanHalfWidth),
        number("meanSquareLowerBand", band.totalMeanSquare[0] ?? 0),
        number("meanSquareUpperBand", band.totalMeanSquare[1] ?? 0),
      );
    }
    if (p.interval === 0) {
      outputs.push(notApplicable("kolmogorovDistance", "Interval is 0"));
    } else {
      const kd = unwrap(kolmogorovDistanceToGaussian(samples, sigma * sigma));
      outputs.push(number("kolmogorovDistance", kd));
    }
    return {
      kind: "accepted",
      data: { outputs, stepIndex: recording.setup.steps, simulationTime: p.H },
    };
  } catch {
    return failed();
  }
}
