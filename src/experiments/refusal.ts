/**
 * The coded refusal an experiment raises at RUNTIME, as against the ones a schema raises while
 * validating a record.
 *
 * am-p465. The owner ruled kebab-case refusal codes everywhere and the conversion of the codes
 * already written in the other form. The experiments layer had no coded runtime class at all:
 * session and definition code threw `new TypeError("Unknown shelf instrument or mode.")` and
 * `new Error(\`Avogadro publication refused: \${reason}\`)`, which carry no code, so
 * refusalRatchet cannot see them and the bare-throw census counts every one.
 *
 * WHY NOT AN EXISTING CLASS. ExperimentValidationError lives in src/content/schemas/experiment.ts
 * and prefixes its message `[ExperimentSchema] root: ...`; it is for records failing their schema,
 * not for a live session refusing to publish a snapshot. SessionValidationError belongs to the
 * comprehension study. TapeValidationError and U64ValidationError are their own domains. Reusing
 * any of them would put a false entity in the message of every refusal in this layer.
 *
 * The code is the stable identity; the message is for a person. Both are required, and the code
 * is kebab-case so the coded scanner reads it by construction rather than by a list it maintains.
 */
export class ExperimentRuntimeError extends Error {
  readonly code: string;
  readonly experimentId: string;

  constructor(code: string, message: string, experimentId = "experiment") {
    super(`[${experimentId}] ${message} (${code})`);
    this.name = "ExperimentRuntimeError";
    this.code = code;
    this.experimentId = experimentId;
  }
}
