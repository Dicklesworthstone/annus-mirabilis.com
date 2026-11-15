/** Equation-free comparisons prepared by the same scientific owners as the full Brownian labs. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseContentYaml } from "../../content/compiler/loaders.ts";
import { validateExperiment, type PresetEntry } from "../../content/schemas/experiment.ts";
import type { TourStep } from "../../content/tours/tours.ts";
import { BM01_DEFAULTS, type Bm01Parameters } from "../../experiments/bm01/definition.ts";
import { validateBm01Parameters } from "../../experiments/bm01/parameters.ts";
import { createBm01Session, type PreparedBm01Example } from "../../experiments/bm01/session.ts";
import { BM05_DEFAULTS, type Bm05Parameters } from "../../experiments/bm05/definition.ts";
import { BM05_DRAFT_TAPE } from "../../experiments/bm05/draftTape.ts";
import { validateBm05Parameters } from "../../experiments/bm05/parameters.ts";
import { createBm05Session, type PreparedBm05Example } from "../../experiments/bm05/session.ts";
import { BM06_DEFAULTS, type Bm06Parameters } from "../../experiments/bm06/definition.ts";
import { validateBm06Parameters } from "../../experiments/bm06/parameters.ts";
import { createBm06Session, type PreparedBm06Example } from "../../experiments/bm06/session.ts";
import { checkTapeCompatibility } from "../../experiments/permalink/compatibility.ts";
import { environmentForSettings } from "../../experiments/permalink/draftTape.ts";
import { validateTapeV2 } from "../../experiments/permalink/schema.ts";
import { settingsFromTape } from "../../experiments/permalink/sessionTape.ts";
import { WALKTHROUGH_CATALOGUE } from "../../experiments/permalink/walkthroughCatalogue.ts";
import type { WalkthroughCatalogue } from "../../experiments/permalink/walkthroughCheckpoints.ts";
import { encodeResult } from "../../experiments/results/codec.ts";
import type { ExperimentView } from "../../experiments/store/instanceStore.ts";
import tracerExample from "../../generated/bm01-example.json";
import walkExample from "../../generated/bm05-example.json";
import distributionExample from "../../generated/bm06-example.json";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { createBm01Recording, measureBm01 } from "../../workers/operations/bm01.ts";
import { createBm05Recording, measureBm05 } from "../../workers/operations/bm05.ts";
import { evaluateBm06 } from "../../workers/operations/bm06.ts";
import { brownianHistogram, type BrownianHistogram } from "./brownianTourPresentation.ts";
import type { TourAction, TourColumn, TourResultRow } from "./massEnergyTourSpec.ts";

export type BrownianTourStep = Extract<TourStep, { kind: "instrument" }>;
type Base = Readonly<{
  sourceDigest: string;
  revealId: string;
  description: string;
  rowHeading: string;
  columns: readonly TourColumn[];
  workedRows: readonly TourResultRow[];
  reading: string;
  limitation: string;
  sourceHref: string;
  walkthroughHref?: string;
  histograms?: readonly Readonly<{ id: string; label: string; data: BrownianHistogram }>[];
  histogramExtent?: readonly [number, number];
  histogramMaximum?: number;
}>;
export type BrownianTourSpec = Base & (
  | Readonly<{ id: "bm-01"; initial: Bm01Parameters; example: PreparedBm01Example;
      actions: readonly TourAction<Bm01Parameters>[] }>
  | Readonly<{ id: "bm-05"; initial: Bm05Parameters; example: PreparedBm05Example;
      actions: readonly TourAction<Bm05Parameters>[] }>
  | Readonly<{ id: "bm-06"; initial: Bm06Parameters; example: PreparedBm06Example;
      actions: readonly TourAction<Bm06Parameters>[] }>
);

type BindingCode = "brownian-tour-binding" | "brownian-tour-tape" | "brownian-tour-owner";
export class BrownianTourBindingError extends TypeError {
  readonly code: BindingCode;
  constructor(code: BindingCode, message: string) {
    super(message);
    this.name = "BrownianTourBindingError";
    this.code = code;
  }
}

function accepted<T>(result: Computation<T>, message: string): T {
  if (result.kind !== "accepted")
    throw new BrownianTourBindingError("brownian-tour-owner", message);
  return result.data;
}

const noWorker = () => {
  throw new BrownianTourBindingError("brownian-tour-owner", "A worked example cannot start a worker.");
};

function workedRow(id: string, label: string, view: ExperimentView): TourResultRow {
  if (view.pending || !view.accepted?.final)
    throw new BrownianTourBindingError("brownian-tour-owner", "A worked row needs a final accepted result.");
  return {
    id,
    label,
    outputs: view.accepted.outputs.filter((output) =>
      output.status !== "value" || typeof output.value === "number"),
  };
}

type PresetReader = (instrumentId: string, presetId: string) => PresetEntry;
function readPreset(instrumentId: string, presetId: string): PresetEntry {
  const path = join(process.cwd(), "content", "experiments", instrumentId + ".yaml");
  const manifest = validateExperiment(parseContentYaml(readFileSync(path, "utf8"), path), path);
  const preset = manifest.presets.find((entry) => entry.presetId === presetId);
  if (manifest.id !== instrumentId || !preset)
    throw new BrownianTourBindingError("brownian-tour-binding", "The tour's authored preset is missing.");
  return preset;
}

/**
 * Copy the recorded settings, not the checkpoint's expected numerical answers. Reconstruct each
 * prefix and check its current identity before using it. This is deliberately not scientific replay.
 */
export function brownianKernelActions(
  catalogue: WalkthroughCatalogue,
): readonly TourAction<Bm05Parameters>[] {
  const walkthrough = catalogue.walkthroughs.find((item) => item.tapeId === "coin-to-bell");
  const fail = (message: string): never => {
    throw new BrownianTourBindingError("brownian-tour-tape", message);
  };
  if (!walkthrough || walkthrough.experimentId !== "bm-05")
    return fail("The kernel comparison requires the authored coin-to-bell walkthrough.");
  const stops = (["coin", "uniform", "gaussian"] as const).map((kernel) => {
    const matches = walkthrough.checkpoints.filter((stop) =>
      stop.settings.kernel === kernel && stop.settings.n === 400);
    if (matches.length !== 1)
      return fail("The walkthrough must name exactly one 400-step stop for each step rule.");
    const stop = matches[0]!;
    if (!stop.tape) return fail("A kernel stop has no complete recorded prefix.");
    let tape: ReturnType<typeof validateTapeV2>;
    try {
      tape = validateTapeV2(stop.tape);
    } catch {
      return fail("A kernel stop has an invalid recorded prefix.");
    }
    let parameters = accepted(
      validateBm05Parameters({ ...BM05_DEFAULTS, ...settingsFromTape(tape.initialConditions, BM05_DEFAULTS) }),
      "The recorded opening settings were refused.",
    );
    if (tape.experimentId !== "bm-05" || tape.mode !== BM05_DRAFT_TAPE.environment.mode ||
        !checkTapeCompatibility(tape, environmentForSettings(BM05_DRAFT_TAPE, parameters)).compatible ||
        tape.seed !== parameters.seed)
      return fail("The kernel walkthrough does not match the current owner, grid and random stream.");
    let lastAction = 0;
    for (const event of tape.events) {
      if (!Object.hasOwn(BM05_DEFAULTS, event.paramId) ||
          event.actionIndex <= 0 || event.actionIndex < lastAction || event.actionIndex > stop.actionIndex)
        return fail("A kernel stop does not contain its complete ordered controls.");
      if (event.previousValue !== undefined &&
          !Object.is(settingsFromTape({ [event.paramId]: event.previousValue }, BM05_DEFAULTS)[event.paramId],
            parameters[event.paramId as keyof Bm05Parameters]))
        return fail("A recorded kernel control does not begin at its stated previous value.");
      parameters = accepted(validateBm05Parameters({
        ...parameters, ...settingsFromTape({ [event.paramId]: event.value }, BM05_DEFAULTS),
      }), "The recorded intermediate settings were refused.");
      lastAction = event.actionIndex;
    }
    if (lastAction !== stop.actionIndex ||
        tape.acceptedCheckpoint.acceptedActionIndex !== stop.actionIndex ||
        Object.entries(parameters).some(([key, value]) => !Object.is(stop.settings[key], value)) ||
        parameters.kernel !== kernel || parameters.n !== 400 || parameters.runSteps !== 400 ||
        parameters.walkers > BM05_DEFAULTS.walkers)
      return fail("The kernel stop must preserve its bounded 400-step settings exactly.");
    return { actionIndex: stop.actionIndex, parameters };
  });
  const [coin, uniform, gaussian] = stops;
  if (!coin || !uniform || !gaussian ||
      coin.actionIndex >= uniform.actionIndex || uniform.actionIndex >= gaussian.actionIndex ||
      [uniform, gaussian].some((stop) => Object.entries(coin.parameters).some(([key, value]) =>
        key !== "kernel" && !Object.is(stop.parameters[key as keyof Bm05Parameters], value))))
    return fail("Only the step rule may differ between the three recorded 400-step comparisons.");
  return [
    { id: "varying-steps", label: "Varying step sizes", parameters: gaussian.parameters,
      tapeActionIndex: gaussian.actionIndex },
    { id: "equal-steps", label: "Equal left-or-right steps", parameters: coin.parameters,
      tapeActionIndex: coin.actionIndex },
    { id: "bounded-steps", label: "Bounded varying step sizes", parameters: uniform.parameters,
      tapeActionIndex: uniform.actionIndex },
  ];
}

export async function brownianTourSpec(
  step: BrownianTourStep,
  catalogue: WalkthroughCatalogue = WALKTHROUGH_CATALOGUE,
  presetReader: PresetReader = readPreset,
): Promise<BrownianTourSpec | null> {
  if (step.instrumentId === "bm-01") {
    if (step.promptId !== "bm-01-predict-observation-interval" || step.controlId !== "interval" ||
        step.reveal.kind !== "preset" || step.reveal.id !== "bm-01-radius-probe")
      throw new BrownianTourBindingError("brownian-tour-binding", "The duration lesson needs its authored interval prompt and radius preset.");
    const preset = presetReader("bm-01", step.reveal.id);
    const initial = accepted(validateBm01Parameters({ ...BM01_DEFAULTS, ...preset.parameterValues }),
      "The duration preset was refused.");
    if (initial.interval !== 1 || initial.M > BM01_DEFAULTS.M || initial.H > BM01_DEFAULTS.H ||
        initial.h < BM01_DEFAULTS.h || initial.d !== 1 || initial.axis !== 0 || initial.statistic !== "rms")
      throw new BrownianTourBindingError("brownian-tour-binding", "The duration comparison needs the bounded one-second, one-direction preset.");
    const actions: readonly TourAction<Bm01Parameters>[] = [
      { id: "one-second", label: "Watch for one second", parameters: initial },
      { id: "four-seconds", label: "Watch for four seconds", parameters: { ...initial, interval: 4 } },
    ];
    const recording = accepted(await createBm01Recording(initial), "The tracer owner could not prepare the shared recording.");
    const examples = actions.map((action, index): PreparedBm01Example => {
      const result = accepted(measureBm01(recording, action.parameters, index > 0), "The tracer owner could not measure the recorded interval.");
      return {
        sourceDigest: tracerExample.sourceDigest,
        snapshotFunctionName: tracerExample.snapshotFunctionName,
        snapshotFunctionHash: tracerExample.snapshotFunctionHash,
        parameters: action.parameters, results: result.outputs.map(encodeResult),
        stepIndex: result.stepIndex, simulationTime: result.simulationTime,
      };
    });
    const example = examples[0]!;
    return {
      id: "bm-01", initial, example, actions, sourceDigest: example.sourceDigest, revealId: "four-seconds",
      description: "Keep the same particles, liquid and recorded random paths. Change only how long you watch them.",
      rowHeading: "Observation time",
      columns: [
        { quantityId: "rmsDisplacement1d", label: "Typical distance predicted by the model", unit: "micrometres", displayDivisor: 1e-6 },
        { quantityId: "sampleRms", label: "Typical distance in this sample", unit: "micrometres", displayDivisor: 1e-6 },
      ],
      workedRows: actions.map((action, index) => workedRow(action.id, action.label,
        createBm01Session("tour-worked-tracers-" + index, examples[index]!, noWorker).getSnapshot())),
      reading: "Watching four times as long doubles the model's typical distance from the start. A finite group of particles gives a nearby result, with ordinary sampling variation.",
      limitation: "These are synthetic paths under an ideal model, measured along one direction. The two observations belong to the same recording, so they are not independent trials. The historical preset uses the constants stated with Einstein's Brownian argument.",
      sourceHref: "/papers/brownian-motion/view/parallel/#s5-p3",
    };
  }

  if (step.instrumentId === "bm-05") {
    if (step.promptId !== "bm-05-predict-step-shape" || step.controlId !== "kernel" ||
        step.reveal.kind !== "tape" || step.reveal.id !== "coin-to-bell")
      throw new BrownianTourBindingError("brownian-tour-binding", "The shape lesson needs its authored step-rule prompt and walkthrough.");
    const actions = brownianKernelActions(catalogue);
    const examples: PreparedBm05Example[] = [];
    // Sequential, bounded preparations keep the existing owners' chunking and allocation limits.
    for (const action of actions) {
      const recording = accepted(await createBm05Recording(action.parameters), "The walk owner could not prepare this step rule.");
      const result = accepted(await measureBm05(recording, action.parameters, false), "The walk owner could not measure this step rule.");
      examples.push({
        sourceDigest: walkExample.sourceDigest,
        snapshotFunctionName: walkExample.snapshotFunctionName,
        snapshotFunctionHash: walkExample.snapshotFunctionHash,
        parameters: action.parameters, results: result.outputs.map(encodeResult),
        stepIndex: result.stepIndex, simulationTime: result.simulationTime,
      });
    }
    const example = examples[0]!;
    const views = examples.map((prepared, index) =>
      createBm05Session("tour-worked-walks-" + index, prepared, noWorker).getSnapshot());
    const histograms = actions.map((action, index) => {
      const data = brownianHistogram(views[index]!.accepted!.outputs);
      if (!data) throw new BrownianTourBindingError("brownian-tour-owner", "The walk owner did not publish its histogram.");
      return { id: action.id, label: action.label, data };
    });
    return {
      id: "bm-05", initial: actions[0]!.parameters, example, actions,
      sourceDigest: example.sourceDigest, revealId: "equal-steps",
      description: "Compare 400 independent steps with the same typical step size and the same number of walkers. Change only the rule for each individual step.",
      rowHeading: "Rule for each step",
      columns: [
        { quantityId: "modelRms", label: "Typical distance predicted by the model", unit: "micrometres", displayDivisor: 1e-6 },
        { quantityId: "sampleRms", label: "Typical distance in this sample", unit: "micrometres", displayDivisor: 1e-6 },
      ],
      workedRows: actions.map((action, index) => workedRow(action.id, action.label, views[index]!)),
      histograms,
      histogramExtent: [
        Math.min(...histograms.map((item) => item.data.edges[0]!)),
        Math.max(...histograms.map((item) => item.data.edges.at(-1)!)),
      ],
      histogramMaximum: Math.max(...histograms.flatMap((item) => [...item.data.observed, ...item.data.model])) * 1.1,
      reading: "The model predicts the same spread for all three rules. After many steps their broad shapes are close to the same bell. Equal left-or-right steps still land on a discrete set of positions, and a finite sample does not make identical bars.",
      limitation: "These are fresh calculations from the recorded walkthrough's settings. They do not replay or verify its scientific checkpoints. Changing the step rule starts a new identified run while keeping the seed; the walks are paired comparisons, not independent repetitions or identical paths.",
      sourceHref: "/papers/brownian-motion/view/parallel/#s5-p4",
      walkthroughHref: "/tapes/coin-to-bell/",
    };
  }

  if (step.instrumentId === "bm-06") {
    if (step.promptId !== "bm-06-predict-within-one-typical-distance" || step.controlId !== "upper" ||
        step.reveal.kind !== "preset" || step.reveal.id !== "bm-06-modern-one-second")
      throw new BrownianTourBindingError("brownian-tour-binding", "The interval lesson needs its authored one-distance prompt and one-second preset.");
    const preset = presetReader("bm-06", step.reveal.id);
    const initial = accepted(validateBm06Parameters({ ...BM06_DEFAULTS, ...preset.parameterValues }),
      "The one-second distribution preset was refused.");
    if (initial.t !== 1 || initial.gridEnabled || initial.lower !== -initial.upper || initial.upper <= 0 ||
        initial.copiedDiffusivityInstanceId !== "")
      throw new BrownianTourBindingError("brownian-tour-binding", "The interval lesson needs its symmetric, analytic one-second preset.");
    const actions: readonly TourAction<Bm06Parameters>[] = [
      { id: "one-typical-distance", label: "Within one typical distance on either side", parameters: initial },
      { id: "two-typical-distances", label: "Within two typical distances on either side",
        parameters: { ...initial, lower: initial.lower * 2, upper: initial.upper * 2 } },
    ];
    const examples: PreparedBm06Example[] = [];
    for (const action of actions) {
      const result = accepted(await evaluateBm06(action.parameters), "The distribution owner could not evaluate this interval.");
      examples.push({
        sourceDigest: distributionExample.sourceDigest,
        snapshotFunctionName: distributionExample.snapshotFunctionName,
        snapshotFunctionHash: distributionExample.snapshotFunctionHash,
        parameters: action.parameters, results: result.outputs.map(encodeResult),
        stepIndex: result.stepIndex, simulationTime: result.simulationTime,
      });
    }
    const example = examples[0]!;
    const views = examples.map((prepared, index) =>
      createBm06Session("tour-worked-distribution-" + index, prepared, noWorker).getSnapshot());
    const distance = views[0]!.accepted!.outputs.find((output) => output.quantityId === "rmsDisplacement1d");
    // Preserve authored bounds; allow their rounding in the label, never in owner outputs.
    if (distance?.status !== "value" || typeof distance.value !== "number" ||
        Math.abs(distance.value - initial.upper) > 1e-6 * distance.value)
      throw new BrownianTourBindingError("brownian-tour-binding", "The authored interval must match one typical distance to within one part in a million.");
    return {
      id: "bm-06", initial, example, actions, sourceDigest: example.sourceDigest,
      revealId: "two-typical-distances",
      description: "Keep the same one-second distribution. Widen only the interval whose share you count.",
      rowHeading: "Distance interval",
      columns: [
        { quantityId: "rmsDisplacement1d", label: "Typical distance predicted by the model", unit: "micrometres", displayDivisor: 1e-6 },
        { quantityId: "intervalProbability", label: "Share inside the interval", unit: "percent", format: "percent" },
      ],
      workedRows: actions.map((action, index) => workedRow(action.id, action.label, views[index]!)),
      reading: "About two particles in three fall within one typical distance on either side of the start. Widening the interval to two typical distances includes about 95 in 100. The typical distance is a measure of spread, not an outer boundary.",
      limitation: "These are exact model chances for an unbounded line, using modern constants. They are not counts from a finite particle sample. Widening the interval changes what is counted, while the distribution itself stays the same.",
      sourceHref: "/papers/brownian-motion/view/parallel/#s5-p3",
    };
  }
  return null;
}
