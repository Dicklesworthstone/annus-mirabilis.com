/** Equation-free comparisons prepared by the registered relativity owners. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateExperiment } from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import type { TourStep } from "../../content/tours/tours.ts";
import { encodeResult } from "../../experiments/results/codec.ts";
import { SR01_PRESETS, type Sr01Parameters } from "../../experiments/sr01/definition.ts";
import { createSr01Session } from "../../experiments/sr01/session.ts";
import { SR03_PRESETS, type Sr03Parameters } from "../../experiments/sr03/definition.ts";
import {
  createSr03Session,
  type PreparedSr03Example,
} from "../../experiments/sr03/session.ts";
import {
  SR06_DEFAULTS,
  SR06_PRESETS,
  type Sr06Parameters,
} from "../../experiments/sr06/definition.ts";
import { createSr06Session } from "../../experiments/sr06/session.ts";
import { SR09_DEFAULTS, type Sr09Parameters } from "../../experiments/sr09/definition.ts";
import { validateSr09Parameters } from "../../experiments/sr09/parameters.ts";
import {
  createSr09Session,
  type PreparedSr09Example,
  snapshotOutputs,
} from "../../experiments/sr09/session.ts";
import type { ExperimentView } from "../../experiments/store/instanceStore.ts";
import labDigests from "../../generated/lab-source-digests.json";
import {
  type GeneratedPredictPrompt,
  PREDICT_PROMPTS,
} from "../../generated/predict-prompts.ts";
import { SR03_SOURCE_DIGEST } from "../../generated/sr03-provenance.ts";
import frequencyExample from "../../generated/sr09-example.json";
import { evaluateSr03 } from "../../workers/operations/sr03.ts";
import type { TourAction, TourColumn, TourResultRow } from "./massEnergyTourSpec.ts";

export type RelativityTourStep = Extract<TourStep, { kind: "instrument" }>;
export type RelativityTourId = "sr-01" | "sr-03" | "sr-06" | "sr-09";

type TourSpecBase = Readonly<{
  sourceDigest: string;
  revealId: string;
  prompt: GeneratedPredictPrompt;
  description: string;
  rowHeading: string;
  columns: readonly TourColumn[];
  workedRows: readonly TourResultRow[];
  reading: string;
  limitation: string;
  sourceHref: string;
}>;

export type RelativityTourSpec = TourSpecBase &
  (
    | Readonly<{
        id: "sr-01";
        initial: Sr01Parameters;
        actions: readonly TourAction<Sr01Parameters>[];
      }>
    | Readonly<{
        id: "sr-03";
        initial: Sr03Parameters;
        example: PreparedSr03Example;
        actions: readonly TourAction<Sr03Parameters>[];
      }>
    | Readonly<{
        id: "sr-06";
        initial: Sr06Parameters;
        actions: readonly TourAction<Sr06Parameters>[];
      }>
    | Readonly<{
        id: "sr-09";
        initial: Sr09Parameters;
        example: PreparedSr09Example;
        actions: readonly TourAction<Sr09Parameters>[];
      }>
  );

export class RelativityTourBindingError extends TypeError {
  readonly code: "relativity-tour-binding" | "relativity-tour-owner";
  constructor(code: RelativityTourBindingError["code"], message: string) {
    super(message);
    this.name = "RelativityTourBindingError";
    this.code = code;
  }
}

const BINDINGS = {
  "sr-01": {
    promptId: "sr-01-predict-moving-pair",
    controlId: "pairBeta",
    presetId: "sr-01-moving-pair-0.6c",
  },
  "sr-03": {
    promptId: "sr-03-predict-endpoint-pair",
    controlId: "endpointPairId",
    // The older boost preset marks points 10 light-seconds apart on the platform,
    // not both ends of the moving rod. Only this preset measures the rod in the question.
    presetId: "sr-03-valid-pair-0.6c",
  },
  "sr-06": {
    promptId: "sr-06-predict-collinear",
    controlId: "movingSpeed",
    presetId: "sr-06-collinear-0.6-0.6",
  },
  "sr-09": {
    promptId: "sr-09-predict-approaching",
    controlId: "propagationAngleDeg",
    presetId: "sr-09-approaching-0.6",
  },
} as const;

/** Keep the real prediction identities and verdict, substituting only authored plain wording. */
function boundPrompt(step: RelativityTourStep, id: RelativityTourId): GeneratedPredictPrompt {
  const binding = BINDINGS[id];
  const prompt = PREDICT_PROMPTS[id]?.find((item) => item.promptId === binding.promptId);
  const choiceIds = step.choices.map((choice) => choice.candidateId);
  if (
    step.promptId !== binding.promptId ||
    step.controlId !== binding.controlId ||
    step.reveal.kind !== "preset" ||
    step.reveal.id !== binding.presetId ||
    !prompt ||
    prompt.controlId !== binding.controlId ||
    step.supportedCandidateId !== prompt.supportedCandidateId ||
    choiceIds.length !== prompt.candidates.length ||
    new Set(choiceIds).size !== choiceIds.length ||
    prompt.candidates.some((candidate) => !choiceIds.includes(candidate.id))
  )
    throw new RelativityTourBindingError(
      "relativity-tour-binding",
      "The relativity tour must retain its authored question, candidates, control and reveal preset.",
    );
  return {
    promptId: prompt.promptId,
    controlId: binding.controlId,
    question: step.question,
    supportedCandidateId: prompt.supportedCandidateId,
    explanation: step.choices.find((choice) => choice.candidateId === prompt.supportedCandidateId)!
      .response,
    candidates: step.choices.map((choice) => ({
      id: choice.candidateId,
      label: choice.text,
      description: choice.response,
      separatingAssumption: choice.response,
    })),
  };
}

/** Missing or refused registered presets cannot silently fall back to unrelated defaults. */
export function requireRelativityPreset<T>(value: T | undefined): T {
  if (value === undefined)
    throw new RelativityTourBindingError(
      "relativity-tour-binding",
      "The relativity tour requires an accepted registered preset.",
    );
  return value;
}

/** A refused, unfinished or pending calculation cannot become a worked result. */
export function relativityWorkedRow(
  id: string,
  label: string,
  view: ExperimentView,
  applied: { kind: string },
): TourResultRow {
  if (applied.kind !== "accepted" || view.pending || !view.accepted?.final)
    throw new RelativityTourBindingError(
      "relativity-tour-owner",
      "The relativity comparison requires a complete accepted owner calculation.",
    );
  return {
    id,
    label,
    outputs: view.accepted.outputs.filter(
      (output) => output.status !== "value" || typeof output.value === "number",
    ),
  };
}

/** Build-time execution of the same bounded operation used by the dedicated worker. */
export async function relativityRodExample(
  parameters: Sr03Parameters,
): Promise<PreparedSr03Example> {
  const evaluated = await evaluateSr03(parameters);
  if (evaluated.kind !== "accepted")
    throw new RelativityTourBindingError(
      "relativity-tour-owner",
      "The rod owner did not accept the tour's declared endpoint comparison.",
    );
  return {
    sourceDigest: SR03_SOURCE_DIGEST,
    parameters,
    results: evaluated.data.outputs.map(encodeResult),
    stepIndex: evaluated.data.stepIndex,
    simulationTime: evaluated.data.simulationTime,
  };
}

/** Server-only preparation; every live action later passes through the same session validators. */
export async function relativityTourSpec(
  step: RelativityTourStep,
): Promise<RelativityTourSpec | null> {
  if (step.instrumentId === "sr-01") {
    const prompt = boundPrompt(step, "sr-01");
    const opening = requireRelativityPreset(
      SR01_PRESETS.find((preset) => preset.presetId === step.reveal.id),
    );
    const initial = opening.parameterValues;
    const actions: readonly TourAction<Sr01Parameters>[] = [
      { id: opening.presetId, label: "Moving at 60 percent of light speed", parameters: initial },
      { id: "clocks-at-rest", label: "At rest beside the platform", parameters: { ...initial, pairBeta: 0 } },
      { id: "clocks-half-speed", label: "Moving at 30 percent of light speed", parameters: { ...initial, pairBeta: 0.3 } },
    ];
    const owner = createSr01Session("tour-worked-clocks", initial);
    return {
      id: "sr-01",
      initial,
      actions,
      prompt,
      revealId: opening.presetId,
      sourceDigest: labDigests["sr-01"],
      description:
        "Keep the clocks ten light-seconds apart in their own resting frame. Each pair uses " +
        "light signals to set its clocks. Change how fast the pair passes the platform.",
      rowHeading: "Motion of the clock pair",
      columns: [{ quantityId: "desynchronization", label: "Clock disagreement", unit: "seconds, judged at one platform time" }],
      workedRows: actions.map((action) => {
        const applied = owner.apply(action.parameters);
        return relativityWorkedRow(action.id, action.label, owner.getSnapshot(), applied);
      }),
      reading:
        "At 60 percent of light speed, the platform finds the trailing clock six seconds ahead. " +
        "At half that speed the gap is three seconds. At rest the clocks agree. Each moving " +
        "pair still judges its own clocks synchronized by the same light-signal rule.",
      limitation:
        "These are ideal clocks in steady relative motion. The comparison concerns distant " +
        "clock readings at one platform time, not the travel time of a photograph.",
      sourceHref: "/papers/special-relativity/view/parallel/#s1",
    };
  }

  if (step.instrumentId === "sr-03") {
    const prompt = boundPrompt(step, "sr-03");
    const opening = requireRelativityPreset(SR03_PRESETS[step.reveal.id]);
    const initial = opening.parameters;
    const actions: readonly TourAction<Sr03Parameters>[] = [
      { id: step.reveal.id, label: "Mark both ends at one platform time", parameters: initial },
      { id: "rod-simultaneous", label: "Mark both ends at one rod time", parameters: { ...initial, measuringFrame: "k" } },
    ];
    const examples = await Promise.all(actions.map((action) => relativityRodExample(action.parameters)));
    const example = examples[0]!;
    return {
      id: "sr-03",
      initial,
      example,
      actions,
      prompt,
      revealId: step.reveal.id,
      sourceDigest: example.sourceDigest,
      description:
        "Keep the same rod and speed. Choose which clocks say that the two endpoint marks " +
        "happen together. Choosing a different clock system selects a different pair of events.",
      rowHeading: "Which endpoint events are compared",
      columns: [
        { quantityId: "measuredLength", label: "Length measured with this pair", unit: "light-seconds" },
        { quantityId: "temporalSeparationK", label: "Time between marks on the platform", unit: "seconds, front mark minus rear mark" },
        { quantityId: "temporalSeparationKPrime", label: "Time between marks on the rod", unit: "seconds, front mark minus rear mark" },
      ],
      workedRows: actions.map((action, index) =>
        relativityWorkedRow(
          action.id,
          action.label,
          createSr03Session("tour-worked-rod-" + index, examples[index]!).getSnapshot(),
          { kind: "accepted" },
        ),
      ),
      reading:
        "Marks made together on the platform are eight light-seconds apart there. The rod's " +
        "clocks put the front mark six seconds before the rear mark. To measure ten light-seconds " +
        "on the rod, choose a different pair of marks, simultaneous on the rod. A negative time " +
        "difference means that the front mark happens first.",
      limitation:
        "Length here comes from marking both ends at the same time in the chosen frame. " +
        "A photograph and two arbitrary platform marks do not carry out that measurement.",
      sourceHref: "/papers/special-relativity/view/parallel/#s2",
    };
  }

  if (step.instrumentId === "sr-06") {
    const prompt = boundPrompt(step, "sr-06");
    const opening = requireRelativityPreset(
      SR06_PRESETS.find((preset) => preset.presetId === step.reveal.id),
    );
    const initial: Sr06Parameters = { ...SR06_DEFAULTS, ...opening.parameterValues };
    const actions: readonly TourAction<Sr06Parameters>[] = [
      { id: opening.presetId, label: "A second speed of 60 percent of light speed", parameters: initial },
      { id: "no-second-motion", label: "The object rests in the moving frame", parameters: { ...initial, movingSpeed: 0 } },
      { id: "light-in-moving-frame", label: "Send a light ray forward", parameters: { ...initial, movingSpeed: 1 } },
    ];
    const owner = createSr06Session("tour-worked-speeds", initial);
    return {
      id: "sr-06",
      initial,
      actions,
      prompt,
      revealId: opening.presetId,
      sourceDigest: labDigests["sr-06"],
      description:
        "Keep the moving frame at 60 percent of light speed. Change the object's speed " +
        "along the same line inside it, and compare what the platform measures.",
      rowHeading: "Motion inside the moving frame",
      columns: [
        { quantityId: "composedSpeedOverC", label: "Speed measured from the platform", unit: "percent of light speed", format: "percent" },
        { quantityId: "galileanSpeedOverC", label: "Prediction from ordinary addition", unit: "percent of light speed", format: "percent" },
      ],
      workedRows: actions.map((action) => {
        const applied = owner.apply(action.parameters);
        return relativityWorkedRow(action.id, action.label, owner.getSnapshot(), applied);
      }),
      reading:
        "Two motions at 60 percent of light speed combine to about 88.24 percent, while " +
        "ordinary addition predicts 120 percent. A forward light ray is still measured " +
        "at light speed from the platform.",
      limitation:
        "These comparisons use steady motion along one line in vacuum. They do not " +
        "describe acceleration or the speed of light through a material.",
      sourceHref: "/papers/special-relativity/view/parallel/#s5",
    };
  }

  if (step.instrumentId === "sr-09") {
    const prompt = boundPrompt(step, "sr-09");
    // SR-09 declares its presets in the manifest, without a duplicate TypeScript table.
    const path = join(process.cwd(), "content", "experiments", "sr-09.yaml");
    const manifest = validateExperiment(strictParse(readFileSync(path, "utf8"), "yaml"), path);
    const actions: readonly TourAction<Sr09Parameters>[] = [
      { id: step.reveal.id, label: "Move toward the source" },
      { id: "sr-09-receding-0.6", label: "Move away from the source" },
      { id: "sr-09-transverse-0.6", label: "Move across the light's direction" },
    ].map((action) => {
      const preset = manifest.presets.find((item) => item.presetId === action.id);
      const checked = preset && validateSr09Parameters({ ...SR09_DEFAULTS, ...preset.parameterValues });
      return {
        ...action,
        parameters: requireRelativityPreset(checked?.kind === "accepted" ? checked.data : undefined),
      };
    });
    const initial = actions[0]!.parameters;
    const example: PreparedSr09Example = {
      sourceDigest: frequencyExample.sourceDigest,
      parameters: initial,
      results: snapshotOutputs(initial).map(encodeResult),
      stepIndex: 0,
      simulationTime: 0,
    };
    const owner = createSr09Session("tour-worked-frequency", example);
    return {
      id: "sr-09",
      initial,
      example,
      actions,
      prompt,
      revealId: step.reveal.id,
      sourceDigest: example.sourceDigest,
      description:
        "Keep the same source frequency and a relative speed of 60 percent of light speed. " +
        "Compare approaching, receding and crossing the light's direction.",
      rowHeading: "Observer's motion",
      columns: [
        { quantityId: "dopplerFactor", label: "Frequency according to relativity", unit: "times the source frequency" },
        { quantityId: "classicalObserverDopplerFactor", label: "Older moving-observer prediction", unit: "times the source frequency" },
        { quantityId: "classicalSourceDopplerFactor", label: "Older moving-source prediction", unit: "times the source frequency" },
      ],
      workedRows: actions.map((action) => {
        const applied = owner.apply(action.parameters);
        return relativityWorkedRow(action.id, action.label, owner.getSnapshot(), applied);
      }),
      reading:
        "Moving toward the source doubles the measured frequency. The two older predictions " +
        "give 1.6 and 2.5 times the source frequency because they distinguish motion of the " +
        "source from motion of the observer through a medium. Moving away halves the frequency. " +
        "Across the ray's direction in the source's frame, relativity predicts a factor of 1.25.",
      limitation:
        "The light is an ideal plane wave in vacuum. The two older comparisons assume a " +
        "stationary propagation medium; their disagreement exposes that additional assumption.",
      sourceHref: "/papers/special-relativity/view/parallel/#s7",
    };
  }
  return null;
}
