/**
 * The six command classes (am-rt-command-classes-dzp). Only the classification type lives
 * here for now: the full command envelope, controller, and per-class invariant enforcement
 * belong to that bead and are out of scope for am-rt-control-tapes-0gc, which needs just this
 * type to tag tape events so a change of description never reads back as a change of world.
 *
 * setup-change: initial physical conditions or governing model change; a new identified run.
 * physical-intervention: conditions change after a specified model time.
 * observer-change: coordinate frame, origin, orientation, or observer description changes;
 *   physical worldlines, events, and trial identity stay fixed.
 * measurement-change: sampling, projection, exposure, or calibration changes under an admitted
 *   observation model; the latent trajectory stays fixed.
 * estimator-change: the statistic, fitted model, or inference assumption changes; the selected
 *   observation data and provenance stay fixed.
 * presentation-change: camera, labels, layout, colors, or explanation selection changes;
 *   every scientific state and data identity stays fixed, and it never reaches a worker.
 */
export const COMMAND_CLASSES = [
  "setup-change",
  "physical-intervention",
  "observer-change",
  "measurement-change",
  "estimator-change",
  "presentation-change",
] as const;

export type CommandClass = (typeof COMMAND_CLASSES)[number];

/**
 * What each command class means, in a reader's words (am-2rl9).
 *
 * The six ids are the runtime's vocabulary and a reader should never be shown one bare. A teaching
 * tape's walkthrough printed "(measurement-change)" beside every step it described, which says
 * nothing to anyone who has not read AGENTS.md's runtime contract.
 *
 * These phrases are that contract's own distinctions, not new ones, and the distinction they carry
 * is the point of having classes at all: an observer change re-describes the world and never
 * restarts it, a measurement change alters how it is watched and not what happens, a presentation
 * change alters neither. A reader who takes only that away from a tape has taken the right thing.
 *
 * ONE LIST. This sits beside COMMAND_CLASSES so a second copy cannot drift from it, and
 * commandClassInWords is exhaustive over the union, so adding a class without a phrase will not
 * compile.
 */
export const COMMAND_CLASS_IN_WORDS: Readonly<Record<CommandClass, string>> = Object.freeze({
  "setup-change": "changes what the run starts from",
  "physical-intervention": "acts on the world partway through",
  "observer-change": "describes the same world from somewhere else",
  "measurement-change": "changes how it is watched, not what happens",
  "estimator-change": "changes how the numbers are read",
  "presentation-change": "changes only what is drawn",
});

/** The phrase for a class, or undefined for a string that is not one. */
export function commandClassInWords(value: string): string | undefined {
  return isCommandClass(value) ? COMMAND_CLASS_IN_WORDS[value] : undefined;
}

export function isCommandClass(value: unknown): value is CommandClass {
  return typeof value === "string" && (COMMAND_CLASSES as readonly string[]).includes(value);
}

/** Presentation changes never enter a scientific digest (am-rt-command-classes-dzp requirement 3). */
export function isDigestExcludedClass(commandClass: CommandClass): boolean {
  return commandClass === "presentation-change";
}

/**
 * Command envelope (am-rt-command-classes-dzp requirement 2).
 * `{ commandId, instanceId, actionIndex, class, payload }`.
 */
export type CommandEnvelope<
  TClass extends CommandClass = CommandClass,
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> = Readonly<{
  commandId: string;
  instanceId: string;
  actionIndex: number;
  class: TClass;
  payload: TPayload;
}>;

export type SetupChangePayload = Readonly<{
  parameters?: Readonly<Record<string, number | string | boolean>>;
  modelId?: string;
  fallbackReason?: string;
  seed?: string;
  [key: string]: unknown;
}>;

export type PhysicalInterventionPayload = Readonly<{
  parameters: Readonly<Record<string, number | string | boolean>>;
  atSimulatedTime: number;
  [key: string]: unknown;
}>;

export type ObserverChangePayload = Readonly<{
  parameters?: Readonly<Record<string, number | string | boolean>>;
  frameId?: string;
  velocityRatio?: number;
  originOffset?: readonly [number, number, number];
  [key: string]: unknown;
}>;

export type MeasurementChangePayload = Readonly<{
  parameters?: Readonly<Record<string, number | string | boolean>>;
  exposureTime?: number;
  localizationError?: number;
  observationInterval?: number;
  samplingCadence?: number;
  [key: string]: unknown;
}>;

export type EstimatorChangePayload = Readonly<{
  parameters?: Readonly<Record<string, number | string | boolean>>;
  estimatorId?: string;
  method?: string;
  assumptions?: readonly string[];
  [key: string]: unknown;
}>;

export type PresentationChangePayload = Readonly<{
  parameters?: Readonly<Record<string, number | string | boolean>>;
  cameraPosition?: readonly [number, number, number];
  labels?: Readonly<Record<string, string>>;
  colorMap?: string;
  drawnParticleCount?: number;
  viewMode?: string;
  [key: string]: unknown;
}>;

export type TypedCommand =
  | CommandEnvelope<"setup-change", SetupChangePayload>
  | CommandEnvelope<"physical-intervention", PhysicalInterventionPayload>
  | CommandEnvelope<"observer-change", ObserverChangePayload>
  | CommandEnvelope<"measurement-change", MeasurementChangePayload>
  | CommandEnvelope<"estimator-change", EstimatorChangePayload>
  | CommandEnvelope<"presentation-change", PresentationChangePayload>;
