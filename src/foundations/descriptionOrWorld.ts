/**
 * The "change the description, keep the world" comparison of foundation:conservation-symmetry
 * (am-found-linear-geometry-7w15), in the runtime's own command-class vocabulary
 * (src/experiments/commands/types.ts). One experiment, the mass paper's body sending two equal
 * pulses of light, and seven changes a reader might make to it. Each change is classified, and the
 * page says what it alters and what it leaves alone. Pure and throw-free.
 */
import { COMMAND_CLASSES, type CommandClass } from "../experiments/commands/types.ts";

export { COMMAND_CLASSES };

/** A change of description leaves the experiment's world alone; a change of world does not. */
export type ChangeKind = "description" | "world";

/** The runtime's rule: only a setup change or a physical intervention changes the world. */
export function kindOf(commandClass: CommandClass): ChangeKind {
  return commandClass === "setup-change" || commandClass === "physical-intervention"
    ? "world"
    : "description";
}

/** The speed of the moving observer, as a fraction of c. */
const OBSERVER_SPEED = 0.6;
const GAMMA = 1 / Math.sqrt(1 - OBSERVER_SPEED ** 2);

/**
 * The two pulses' energies seen by the moving observer, as fractions of the total L, from the
 * mass paper's (L/2)γ(1 ∓ (v/c) cos φ) along the motion and against it: 0.25 and 1 at 0.6c.
 */
export const MOVING_PULSES = {
  forward: 0.5 * GAMMA * (1 - OBSERVER_SPEED),
  backward: 0.5 * GAMMA * (1 + OBSERVER_SPEED),
} as const;

/** An energy as a fraction of L: "0.25L", or plain "L" for the whole of it. */
const L = (fraction: number) => {
  const rounded = Number(fraction.toFixed(2));
  return rounded === 1 ? "L" : `${rounded}L`;
};

export interface ChangeCase {
  readonly id: string;
  readonly label: string;
  readonly commandClass: CommandClass;
  /** Whether the measured outcome differs after the change. */
  readonly outcomeChanges: boolean;
  readonly changes: string;
  readonly stays: string;
}

export const CHANGE_CASES: readonly ChangeCase[] = [
  {
    id: "moving-observer",
    label: "Describe it from a frame moving at 0.6c along the pulses",
    commandClass: "observer-change",
    outcomeChanges: false,
    changes: `The numbers: the pulses carry ${L(MOVING_PULSES.forward)} and ${L(MOVING_PULSES.backward)} instead of 0.5L each, ${L(MOVING_PULSES.forward + MOVING_PULSES.backward)} in all.`,
    stays:
      "The events, the body, and the fact that each frame's energy balance holds before and after the emission.",
  },
  {
    id: "relabel-axes",
    label: "Call the old y axis x, and the old x axis y",
    commandClass: "observer-change",
    outcomeChanges: false,
    changes: "The names of the components: what was the x component is now written y.",
    stays: "Every event and every energy.",
  },
  {
    id: "turn-apparatus",
    label: "Turn the whole apparatus so the pulses go along y instead of x",
    commandClass: "setup-change",
    outcomeChanges: false,
    changes: "The experiment itself: this is a new run, set up differently.",
    stays:
      "The outcome. The body still loses L to two equal pulses, because turning the apparatus is a symmetry of the experiment.",
  },
  {
    id: "heat-body",
    label: "Heat the body halfway through, before it emits",
    commandClass: "physical-intervention",
    outcomeChanges: true,
    changes: "The world after the heating: the body holds more energy when it emits.",
    stays: "Everything that happened before the heating.",
  },
  {
    id: "slow-detector",
    label: "Record the pulses with a detector that averages over a longer time",
    commandClass: "measurement-change",
    outcomeChanges: false,
    changes: "The readings: a slower detector smooths each pulse into a longer, lower signal.",
    stays: "The pulses themselves and the energy they carry.",
  },
  {
    id: "fit-energy",
    label: "Estimate the pulse energy by fitting several readings instead of taking one",
    commandClass: "estimator-change",
    outcomeChanges: false,
    changes: "The estimate and its uncertainty.",
    stays: "The readings it is computed from, and where they came from.",
  },
  {
    id: "recolour",
    label: "Draw the pulses in another colour",
    commandClass: "presentation-change",
    outcomeChanges: false,
    changes: "Only the picture.",
    stays: "Every number and every event.",
  },
];

export const CLASS_WORDS: Readonly<Record<CommandClass, string>> = {
  "setup-change": "a setup change",
  "physical-intervention": "a physical intervention",
  "observer-change": "an observer change",
  "measurement-change": "a measurement change",
  "estimator-change": "an estimator change",
  "presentation-change": "a presentation change",
};
