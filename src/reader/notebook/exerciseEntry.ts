import { DISCOVERY_PAPERS, type DiscoveryPaper } from "../../content/schemas/discovery.ts";
import {
  connectionAnswerHref,
  validConnectionAnswerIdentity,
} from "../../discovery/connections/answerLocations.ts";

/** A reader's response and the question's identity, never a saved verdict or executable input. */
export type ExerciseCapture = Readonly<{
  schemaVersion: 1;
  partId: string;
  prompt: string;
  guideRevision: string;
  partKind: "expression" | "numeric";
  definitionKey: string;
  unit: string | null;
}>;

export class ExerciseCaptureError extends TypeError {
  readonly code:
    | "notebook-exercise-shape"
    | "notebook-exercise-accessor"
    | "notebook-exercise-data";
  constructor(code: ExerciseCaptureError["code"], message: string) {
    super(message);
    this.name = "ExerciseCaptureError";
    this.code = code;
  }
}

function boundedText(value: unknown, limit: number): value is string {
  if (typeof value !== "string" || !value.trim() || value.length > limit) return false;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127)
      return false;
  }
  return true;
}

/** Imported responses remain inert text. Restoring one requires an explicit reader action. */
export function parseExerciseCapture(
  input: unknown,
  paper: string,
  answer?: string,
): ExerciseCapture {
  const fields = [
    "schemaVersion",
    "partId",
    "prompt",
    "guideRevision",
    "partKind",
    "definitionKey",
    "unit",
  ];
  if (
    !DISCOVERY_PAPERS.includes(paper as DiscoveryPaper) ||
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
    Reflect.ownKeys(input).length !== fields.length
  )
    throw new ExerciseCaptureError(
      "notebook-exercise-shape",
      "This saved response does not identify a supported guide and exercise.",
    );
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (fields.some((field) => !Object.hasOwn(descriptors[field] ?? {}, "value")))
    throw new ExerciseCaptureError(
      "notebook-exercise-accessor",
      "Saved exercise responses must contain plain data, not accessors.",
    );
  const value = input as Record<string, unknown>;
  if (
    value.schemaVersion !== 1 ||
    !boundedText(value.partId, 160) ||
    !/^[a-z][a-z0-9-]*$/u.test(value.partId) ||
    !boundedText(value.prompt, 4000) ||
    !boundedText(value.guideRevision, 80) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/u.test(value.guideRevision) ||
    !["expression", "numeric"].includes(value.partKind as string) ||
    !validConnectionAnswerIdentity(
      paper,
      value.partId as string,
      value.partKind as ExerciseCapture["partKind"],
    ) ||
    !boundedText(value.definitionKey, 32_000) ||
    (answer !== undefined && !boundedText(answer, value.partKind === "numeric" ? 64 : 200)) ||
    (value.partKind === "expression" ? value.unit !== null : !boundedText(value.unit, 80))
  )
    throw new ExerciseCaptureError(
      "notebook-exercise-data",
      "This saved response has unsupported exercise, answer or revision data.",
    );
  return Object.freeze({
    schemaVersion: 1,
    partId: value.partId,
    prompt: value.prompt,
    guideRevision: value.guideRevision,
    partKind: value.partKind as ExerciseCapture["partKind"],
    definitionKey: value.definitionKey,
    unit: value.unit as string | null,
  });
}

/** Only public exercise identities enter links, never an answer or a private entry id. */
export function exerciseResponseHref(paper: string, capture: ExerciseCapture): string {
  const checked = parseExerciseCapture(capture, paper);
  return (
    connectionAnswerHref(paper, checked.partId, checked.partKind) ??
    `/discover/${paper}/#exercise-${checked.partId}`
  );
}

export function exerciseResponseText(answer: string, capture: ExerciseCapture): string {
  const unit = capture.unit?.replace(/^um$/u, "μm").replaceAll("*", "·");
  return unit ? `${answer} ${unit}` : answer;
}
