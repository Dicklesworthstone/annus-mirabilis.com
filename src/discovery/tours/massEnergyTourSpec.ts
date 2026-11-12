/** The tour's declared presets and tape, projected through the laboratory owners. */
import type { TourStep } from "../../content/tours/tours.ts";
import {
  ME01_DEFAULTS,
  ME01_PRESETS,
  type Me01Parameters,
} from "../../experiments/me01/definition.ts";
import { createMe01Session } from "../../experiments/me01/session.ts";
import { ME02_DEFAULTS, type Me02Parameters } from "../../experiments/me02/definition.ts";
import { validateMe02Parameters } from "../../experiments/me02/parameters.ts";
import { createMe02Session, type PreparedMe02Example } from "../../experiments/me02/session.ts";
import { ME02_TAPE } from "../../experiments/me02/tape.ts";
import {
  ME03_DEFAULTS,
  ME03_PRESETS,
  type Me03Parameters,
} from "../../experiments/me03/definition.ts";
import { createMe03Session } from "../../experiments/me03/session.ts";
import { checkTapeCompatibility } from "../../experiments/permalink/compatibility.ts";
import { TEACHING_TAPES } from "../../experiments/permalink/teachingTapeCatalogue.ts";
import type { TapeV2 } from "../../experiments/permalink/types.ts";
import type { ExperimentView, PublishedResult } from "../../experiments/store/instanceStore.ts";
import labDigests from "../../generated/lab-source-digests.json";
import me02Example from "../../generated/me02-example.json";

export type TourInstrumentStep = Extract<TourStep, { kind: "instrument" }>;
export type MassEnergyTourId = "me-01" | "me-02" | "me-03";
export type TourColumn = Readonly<{
  quantityId: string;
  /** Used only when the canonical quantity registry has no plain-word name yet. */
  label: string;
  unit: string;
  format?: "direction" | "percent";
}>;
export type TourResultRow = Readonly<{
  id: string;
  label: string;
  outputs: readonly PublishedResult[];
}>;
export type TourAction<P> = Readonly<{
  id: string;
  label: string;
  parameters: P;
  tapeActionIndex?: number;
}>;
type TourSpecBase = Readonly<{
  sourceDigest: string;
  revealId: string;
  description: string;
  rowHeading: string;
  columns: readonly TourColumn[];
  workedRows: readonly TourResultRow[];
  reading: string;
}>;
export type MassEnergyTourSpec = TourSpecBase &
  (
    | Readonly<{
        id: "me-01";
        initial: Me01Parameters;
        actions: readonly TourAction<Me01Parameters>[];
      }>
    | Readonly<{
        id: "me-02";
        initial: Me02Parameters;
        example: PreparedMe02Example;
        actions: readonly TourAction<Me02Parameters>[];
      }>
    | Readonly<{
        id: "me-03";
        initial: Me03Parameters;
        actions: readonly TourAction<Me03Parameters>[];
      }>
  );

type TourBindingCode =
  | "mass-energy-tour-binding"
  | "mass-energy-tour-tape"
  | "mass-energy-tour-owner";
export class MassEnergyTourBindingError extends TypeError {
  readonly code: TourBindingCode;
  constructor(code: TourBindingCode, message: string) {
    super(message);
    this.name = "MassEnergyTourBindingError";
    this.code = code;
  }
}

/** No copied physics: these are the very outputs accepted by the ordinary laboratory session. */
export function tourWorkedRow(
  id: string,
  label: string,
  view: ExperimentView,
  applied: { kind: "accepted" | "refused" },
): TourResultRow {
  if (applied.kind !== "accepted" || !view.accepted)
    throw new MassEnergyTourBindingError(
      "mass-energy-tour-owner",
      "The worked case has no accepted snapshot.",
    );
  return { id, label, outputs: view.accepted.outputs };
}

/** Other papers keep their explicit full-laboratory fallback until their tour views exist. */
export function massEnergyTourSpec(
  step: TourInstrumentStep,
  tapes: ReadonlyMap<string, TapeV2> = TEACHING_TAPES,
): MassEnergyTourSpec | null {
  if (step.instrumentId === "me-01") {
    const reveal = ME01_PRESETS.find((preset) => preset.presetId === step.reveal.id);
    const transverse = ME01_PRESETS.find(
      (preset) => preset.presetId === "me-01-transverse-emission",
    );
    if (
      step.promptId !== "me-01-predict-tilt-axis" ||
      step.reveal.kind !== "preset" ||
      reveal?.presetId !== "me-01-sixty-degree-tilt" ||
      !transverse
    )
      throw new MassEnergyTourBindingError(
        "mass-energy-tour-binding",
        "The two-flash tour must use its authored tilt prompt and preset.",
      );
    const actions: readonly TourAction<Me01Parameters>[] = [
      { id: "me-01-default", label: "Along the motion: 0 degrees", parameters: ME01_DEFAULTS },
      {
        id: reveal.presetId,
        label: "Tilt the pair: 60 degrees",
        parameters: reveal.parameterValues,
      },
      {
        id: transverse.presetId,
        label: "Across the motion: 90 degrees",
        parameters: transverse.parameterValues,
      },
    ];
    const owner = createMe01Session("tour-worked-me-01");
    return {
      id: "me-01",
      initial: ME01_DEFAULTS,
      actions,
      revealId: reveal.presetId,
      sourceDigest: labDigests["me-01"],
      rowHeading: "Direction of the pair",
      description:
        "Keep the traveler at 60 percent of light speed and the emitted light at one joule. Turn the pair of opposite flashes and compare the two observers' accounts.",
      columns: [
        {
          quantityId: "emittedEnergyRestFrame",
          label: "Light energy for the resting body",
          unit: "joules",
        },
        {
          quantityId: "lightComplexEnergyMoving",
          label: "Light energy for the traveler",
          unit: "joules",
        },
        {
          quantityId: "kineticEnergyDifference",
          label: "Decrease in the body's energy of motion",
          unit: "joules",
        },
      ],
      workedRows: actions.map((action) => {
        const applied = owner.apply(action.parameters);
        return tourWorkedRow(action.id, action.label, owner.getSnapshot(), applied);
      }),
      reading:
        "Turning the pair changes how the energy is divided between the flashes. Their combined energy stays the same for each observer. The extra light energy in the traveler's account is matched by the body's smaller energy of motion.",
    };
  }
  if (step.instrumentId === "me-02") {
    const tape = tapes.get(step.reveal.id);
    if (
      step.promptId !== "me-02-predict-toward-low-speed" ||
      step.reveal.kind !== "tape" ||
      step.reveal.id !== "toward-low-speed" ||
      !tape ||
      tape.experimentId !== "me-02" ||
      tape.mode !== ME02_TAPE.environment.mode ||
      !checkTapeCompatibility(tape, ME02_TAPE.environment).compatible ||
      tape.events.length === 0
    )
      throw new MassEnergyTourBindingError(
        "mass-energy-tour-tape",
        "The low-speed tour needs its compatible authored teaching tape.",
      );
    const checkedInitial = validateMe02Parameters({ ...ME02_DEFAULTS, ...tape.initialConditions });
    const checkedExample = validateMe02Parameters(me02Example.parameters);
    if (
      checkedInitial.kind !== "accepted" ||
      checkedInitial.data.energyUnit !== "normalized" ||
      checkedExample.kind !== "accepted"
    )
      throw new MassEnergyTourBindingError(
        "mass-energy-tour-tape",
        "The low-speed tape must begin with accepted comparison units.",
      );
    let parameters = checkedInitial.data;
    const speedLabel = (p: Me02Parameters) => `${p.beta * 100} percent of light speed`;
    const actions: TourAction<Me02Parameters>[] = [
      { id: "opening", label: speedLabel(parameters), parameters, tapeActionIndex: 0 },
    ];
    for (const event of tape.events) {
      const checked = validateMe02Parameters({ ...parameters, [event.paramId]: event.value });
      if (
        event.commandClass !== "observer-change" ||
        event.paramId !== "beta" ||
        checked.kind !== "accepted"
      )
        throw new MassEnergyTourBindingError(
          "mass-energy-tour-tape",
          "The low-speed tour can only step through accepted observer-speed controls.",
        );
      parameters = checked.data;
      actions.push({
        id: `action-${event.actionIndex}`,
        label: speedLabel(parameters),
        parameters,
        tapeActionIndex: event.actionIndex,
      });
    }
    const example: PreparedMe02Example = { ...me02Example, parameters: checkedExample.data };
    const owner = createMe02Session("tour-worked-me-02", example);
    return {
      id: "me-02",
      initial: checkedInitial.data,
      example,
      actions,
      revealId: step.reveal.id,
      sourceDigest: example.sourceDigest,
      rowHeading: "Traveler's speed",
      description:
        "Follow the recorded speed controls toward rest. The mass estimate, called the proxy in the table, comes from comparing the drop in energy of motion with the usual slow-motion account. Compare that estimate with the limiting mass decrease in the same units. These are comparison units, not kilograms.",
      columns: [
        {
          quantityId: "finiteSpeedMassProxy",
          label: "Mass estimate at this speed",
          unit: "mass units",
        },
        { quantityId: "inertialMassDecrease", label: "Limiting mass decrease", unit: "mass units" },
        {
          quantityId: "proxyExcessOverLimit",
          label: "How far the estimate exceeds the limit",
          unit: "percent",
          format: "percent",
        },
      ],
      workedRows: actions.map((action) => {
        const applied = owner.apply(action.parameters);
        return tourWorkedRow(action.id, action.label, owner.getSnapshot(), applied);
      }),
      reading:
        "The estimate approaches the same mass decrease as the observer slows down. At rest, the finite-speed comparison is not applicable. The analytic limit remains a separate result; it is not obtained by dividing two zeros. The recorded speed sequence is calculated here with the current model.",
    };
  }
  if (step.instrumentId === "me-03") {
    const reveal = ME03_PRESETS.find((preset) => preset.presetId === step.reveal.id);
    if (
      step.promptId !== "me-03-predict-sealed-box" ||
      step.reveal.kind !== "preset" ||
      reveal?.presetId !== "me-03-sealed-lamp-and-mirror"
    )
      throw new MassEnergyTourBindingError(
        "mass-energy-tour-binding",
        "The sealed-box tour must use its authored lamp-and-mirror prompt and preset.",
      );
    const enclosure: Me03Parameters = { ...ME03_DEFAULTS, ...reveal.parameterValues };
    const initial: Me03Parameters = { ...enclosure, boundary: "body-alone" };
    const actions: readonly TourAction<Me03Parameters>[] = [
      { id: "body-alone", label: "The emitting body alone", parameters: initial },
      { id: reveal.presetId, label: "The whole sealed enclosure", parameters: enclosure },
    ];
    const owner = createMe03Session("tour-worked-me-03", initial);
    return {
      id: "me-03",
      initial,
      actions,
      revealId: reveal.presetId,
      sourceDigest: labDigests["me-03"],
      rowHeading: "What is inside the boundary?",
      description:
        "The lamp emits one joule inside a sealed enclosure. No energy enters or leaves the enclosure. Compare a boundary around the emitting body with one around the body, the light, and everything else inside.",
      columns: [
        { quantityId: "energyChange", label: "Energy change inside this boundary", unit: "joules" },
        {
          quantityId: "massChange",
          label: "Mass inside this boundary",
          unit: "direction of change",
          format: "direction",
        },
        {
          quantityId: "systemEnergyChange",
          label: "Energy change of the whole enclosure",
          unit: "joules",
        },
      ],
      workedRows: actions.map((action) => {
        const applied = owner.apply(action.parameters);
        return tourWorkedRow(action.id, action.label, owner.getSnapshot(), applied);
      }),
      reading:
        "The emitting body loses energy and mass, while the energy stays inside the larger boundary. The sealed enclosure's total energy and mass are unchanged. A negative energy change means energy has left the selected part, not that it has disappeared.",
    };
  }
  return null;
}
