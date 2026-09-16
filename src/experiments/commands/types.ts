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

export function isCommandClass(value: unknown): value is CommandClass {
  return typeof value === "string" && (COMMAND_CLASSES as readonly string[]).includes(value);
}

/** Presentation changes never enter a scientific digest (am-rt-command-classes-dzp requirement 3). */
export function isDigestExcludedClass(commandClass: CommandClass): boolean {
  return commandClass === "presentation-change";
}
