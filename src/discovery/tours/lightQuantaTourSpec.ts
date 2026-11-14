/** Compact, equation-free comparisons through the ordinary light-quanta owners. */
import type { TourStep } from "../../content/tours/tours.ts";
import {
  LQ01_CAPTION,
  LQ01_PRESETS,
  type Lq01Parameters,
} from "../../experiments/lq01/definition.ts";
import {
  createLq01Session,
  type PreparedLq01Example,
} from "../../experiments/lq01/session.ts";
import {
  LQ05_PRESETS,
  type Lq05Parameters,
} from "../../experiments/lq05/definition.ts";
import { createLq05Session } from "../../experiments/lq05/session.ts";
import { LQ05_TAPE } from "../../experiments/lq05/tape.ts";
import {
  LQ08_CAPTION,
  LQ08_MODEL,
  LQ08_PRESETS,
  type Lq08Parameters,
} from "../../experiments/lq08/definition.ts";
import {
  createLq08Session,
  evaluateLq08,
  type PreparedLq08Example,
} from "../../experiments/lq08/session.ts";
import { replayTapeOnSession } from "../../experiments/permalink/sessionTape.ts";
import { WALKTHROUGH_CATALOGUE } from "../../experiments/permalink/walkthroughCatalogue.ts";
import type { WalkthroughCatalogue } from "../../experiments/permalink/walkthroughCheckpoints.ts";
import { encodeResult } from "../../experiments/results/codec.ts";
import type { ExperimentView } from "../../experiments/store/instanceStore.ts";
import labDigests from "../../generated/lab-source-digests.json";
import { LQ01_SOURCE_DIGEST } from "../../generated/lq01-provenance.ts";
import photoelectricExample from "../../generated/lq08-example.json";
import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";
import { evaluateLq01 } from "../../workers/operations/lq01.ts";
import type { TourAction, TourColumn, TourResultRow } from "./massEnergyTourSpec.ts";

export type LightQuantaTourStep = Extract<TourStep, { kind: "instrument" }>;
export type LightQuantaTourId = "lq-01" | "lq-05" | "lq-08";
type TourSpecBase = Readonly<{
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
}>;
export type LightQuantaTourSpec = TourSpecBase &
  (
    | Readonly<{
        id: "lq-01";
        initial: Lq01Parameters;
        example: PreparedLq01Example;
        actions: readonly TourAction<Lq01Parameters>[];
      }>
    | Readonly<{
        id: "lq-05";
        initial: Lq05Parameters;
        actions: readonly TourAction<Lq05Parameters>[];
      }>
    | Readonly<{
        id: "lq-08";
        initial: Lq08Parameters;
        example: PreparedLq08Example;
        actions: readonly TourAction<Lq08Parameters>[];
      }>
  );

type TourBindingCode =
  | "light-quanta-tour-binding"
  | "light-quanta-tour-tape"
  | "light-quanta-tour-owner";
export class LightQuantaTourBindingError extends TypeError {
  readonly code: TourBindingCode;
  constructor(code: TourBindingCode, message: string) {
    super(message);
    this.name = "LightQuantaTourBindingError";
    this.code = code;
  }
}

/** Only complete, accepted owner outputs become worked rows. */
export function lightQuantaWorkedRow(
  id: string,
  label: string,
  view: ExperimentView,
  applied: { kind: string },
): TourResultRow {
  if (applied.kind !== "accepted" || view.pending || !view.accepted?.final)
    throw new LightQuantaTourBindingError(
      "light-quanta-tour-owner",
      "The tour comparison requires a complete accepted calculation.",
    );
  return {
    id,
    label,
    // Only scalar cells cross the server/client boundary; profile arrays stay in the owner.
    outputs: view.accepted.outputs.filter(
      (output) => output.status !== "value" || typeof output.value === "number",
    ),
  };
}

export async function lightQuantaWaveExample(
  parameters: Lq01Parameters,
): Promise<PreparedLq01Example> {
  const evaluation = await evaluateLq01(parameters);
  if (evaluation.kind !== "accepted")
    throw new LightQuantaTourBindingError(
      "light-quanta-tour-owner",
      "The wave owner did not accept the tour's declared comparison.",
    );
  return {
    sourceDigest: LQ01_SOURCE_DIGEST,
    parameters,
    results: evaluation.data.outputs.map(encodeResult),
    stepIndex: evaluation.data.stepIndex,
    simulationTime: evaluation.data.simulationTime,
  };
}

/** Server-side preparation. Live views consume these settings through the same owners. */
export async function lightQuantaTourSpec(
  step: LightQuantaTourStep,
  catalogue: WalkthroughCatalogue = WALKTHROUGH_CATALOGUE,
): Promise<LightQuantaTourSpec | null> {
  if (step.instrumentId === "lq-01") {
    const opening = LQ01_PRESETS["equal-amplitudes"];
    const shifted = LQ01_PRESETS["phase-shifted"];
    if (
      step.promptId !== "lq-01-predict-phase-shift" ||
      step.controlId !== "delta" ||
      step.reveal.kind !== "preset" ||
      step.reveal.id !== opening.id
    )
      throw new LightQuantaTourBindingError(
        "light-quanta-tour-binding",
        "The wave tour must use its authored phase prompt and equal-wave preset.",
      );
    const actions: readonly TourAction<Lq01Parameters>[] = [
      { id: opening.id, label: "The two waves arrive in step", parameters: opening.parameters },
      { id: shifted.id, label: "Delay one wave by half a wave", parameters: shifted.parameters },
    ];
    const examples = await Promise.all(actions.map((action) => lightQuantaWaveExample(action.parameters)));
    const example = examples[0]!;
    return {
      id: "lq-01",
      initial: opening.parameters,
      example,
      actions,
      revealId: shifted.id,
      sourceDigest: example.sourceDigest,
      description:
        "Keep both waves equally strong and watch the same point at the center of the screen. " +
        "Change only when one wave arrives.",
      rowHeading: "How the waves meet",
      columns: [
        {
          quantityId: "centerIntensity",
          label: "Brightness at the center",
          unit: "one wave on its own counts as 1",
        },
      ],
      workedRows: actions.map((action, index) =>
        lightQuantaWorkedRow(
          action.id,
          action.label,
          createLq01Session("tour-worked-wave-" + index, examples[index]!).getSnapshot(),
          { kind: "accepted" },
        ),
      ),
      reading: LQ01_CAPTION.r0,
      limitation:
        "These are predictions of the continuous wave model. A dark point at the center does " +
        "not mean the energy vanished everywhere, and this calculation is not evidence for " +
        "separate light particles.",
      sourceHref: "/papers/light-quanta/view/parallel/#s0-p2",
    };
  }

  if (step.instrumentId === "lq-05") {
    const walkthrough = catalogue.walkthroughs.find((item) => item.tapeId === step.reveal.id);
    if (
      step.promptId !== "lq-05-predict-ten-points" ||
      step.controlId !== "n" ||
      step.reveal.kind !== "tape" ||
      step.reveal.id !== "the-locked-positions" ||
      !walkthrough ||
      walkthrough.experimentId !== "lq-05" ||
      walkthrough.checkpoints.length === 0
    )
      throw new LightQuantaTourBindingError(
        "light-quanta-tour-tape",
        "The counting tour needs its authored ten-point prompt and locked-positions walkthrough.",
      );
    const stops = walkthrough.checkpoints.map((checkpoint) => {
      const replayOwner = createLq05Session("tour-checkpoint-" + checkpoint.actionIndex);
      const replay = checkpoint.tape
        ? replayTapeOnSession(LQ05_TAPE, replayOwner, checkpoint.tape)
        : null;
      if (!replay || replay.kind !== "success" || replay.isNewRun)
        throw new LightQuantaTourBindingError(
          "light-quanta-tour-tape",
          "Every counting-tour checkpoint must replay under the current owner and its recorded digest.",
        );
      return { actionIndex: checkpoint.actionIndex, parameters: replayOwner.acceptedParameters() };
    });
    const independent = stops.find(
      (stop) => stop.parameters.n === 10 && stop.parameters.f === 0.5 && !stop.parameters.locked,
    );
    const ending = stops.at(-1);
    if (
      !independent ||
      !ending ||
      ending.actionIndex <= independent.actionIndex ||
      ending.parameters.n !== 10 ||
      ending.parameters.f !== 0.5 ||
      !ending.parameters.locked ||
      Object.entries(independent.parameters).some(
        ([key, value]) =>
          key !== "locked" &&
          !Object.is(ending.parameters[key as keyof Lq05Parameters], value),
      )
    )
      throw new LightQuantaTourBindingError(
        "light-quanta-tour-tape",
        "The walkthrough must record ten independent points before locking those same ten points.",
      );
    const initial = independent.parameters;
    const locked = LQ05_PRESETS["lq-05-locked-positions"].parameters;
    const actions: readonly TourAction<Lq05Parameters>[] = [
      { id: "ten-independent", label: "Ten independent choices", parameters: initial },
      {
        id: "ten-together",
        label: "Ten tokens, one shared choice",
        // Preserve every opening setting except the dependence assumption.
        parameters: { ...initial, locked: locked.locked },
      },
    ];
    const owner = createLq05Session("tour-worked-counting", initial);
    return {
      id: "lq-05",
      initial,
      actions,
      revealId: "ten-together",
      sourceDigest: labDigests["lq-05"],
      description:
        "Keep ten tokens and the same two equal parts. Compare ten separate choices with " +
        "one shared choice that puts every token in the same part.",
      rowHeading: "What is assumed about the tokens",
      columns: [
        {
          quantityId: "configurationProbability",
          label: "Chance that all are in the left part",
          unit: "percent of equally likely placements",
          format: "percent",
        },
      ],
      workedRows: actions.map((action) => {
        const applied = owner.apply(action.parameters);
        return lightQuantaWorkedRow(action.id, action.label, owner.getSnapshot(), applied);
      }),
      reading:
        "With ten independent choices between equal parts, all ten reach the left part in " +
        "one of 1024 equally likely arrangements. If all ten must move together, there are " +
        "only two arrangements and one puts them on the left. Independence makes the difference.",
      limitation:
        "The table gives exact model chances. Keeping tokens together changes the model's " +
        "independence assumption; it is not a new measurement of light. These buttons compare " +
        "settings. The linked walkthrough separately replays its recorded sequence.",
      sourceHref: "/papers/light-quanta/view/parallel/#s5-p1",
      walkthroughHref: "/tapes/the-locked-positions/",
    };
  }

  if (step.instrumentId === "lq-08") {
    const opening = LQ08_PRESETS.intensityProbe;
    if (
      step.promptId !== "lq-08-predict-double-power" ||
      step.controlId !== "incidentPower" ||
      step.reveal.kind !== "preset" ||
      step.reveal.id !== opening.id
    )
      throw new LightQuantaTourBindingError(
        "light-quanta-tour-binding",
        "The electron tour must use its authored brightness prompt and intensity preset.",
      );
    const actions: readonly TourAction<Lq08Parameters>[] = [
      { id: opening.id, label: "The original lamp", parameters: opening.parameters },
      {
        id: "double-power",
        label: "Twice the light power, the same frequency",
        parameters: { ...opening.parameters, incidentPower: 2 * opening.parameters.incidentPower },
      },
    ];
    const example: PreparedLq08Example = {
      sourceDigest: photoelectricExample.sourceDigest,
      parameters: opening.parameters,
      results: evaluateLq08(opening.parameters).map(encodeResult),
      stepIndex: 0,
      simulationTime: 0,
    };
    const owner = createLq08Session("tour-worked-electrons", example);
    // An electronvolt is the energy of one elementary charge across one volt. Its conversion
    // comes from the same declared constant set as this owner, never a second charge literal.
    const joulesPerElectronvolt = constantValue(
      getConstantSet(LQ08_MODEL.constantSetId),
      "elementaryCharge",
    ).value;
    return {
      id: "lq-08",
      initial: opening.parameters,
      example,
      actions,
      revealId: "double-power",
      sourceDigest: example.sourceDigest,
      description:
        "Use light at 600 trillion cycles per second on the same hypothetical surface. " +
        "Keep the escape work and the assumed emission efficiency fixed, and double only " +
        "the power reaching the surface.",
      rowHeading: "Lamp setting",
      columns: [
        {
          quantityId: "incidentPower",
          label: "Light power reaching the surface",
          unit: "milliwatts",
          displayDivisor: 0.001,
        },
        {
          quantityId: "maxKineticEnergy",
          label: "Most energy an escaping electron keeps",
          unit: "electronvolts",
          displayDivisor: joulesPerElectronvolt,
        },
        {
          quantityId: "emissionRate",
          label: "Electrons leaving each second",
          unit: "trillions per second",
          displayDivisor: 1e12,
        },
      ],
      workedRows: actions.map((action) => {
        const applied = owner.apply(action.parameters);
        return lightQuantaWorkedRow(action.id, action.label, owner.getSnapshot(), applied);
      }),
      reading: LQ08_CAPTION.r0,
      limitation:
        "The surface is hypothetical. The count assumes one in ten incident energy parcels " +
        "releases an electron; a real surface need not have this efficiency. These are consequences " +
        "of the single-parcel model, not measurements proving it.",
      sourceHref: "/papers/light-quanta/view/parallel/#s8-p7",
    };
  }
  return null;
}
