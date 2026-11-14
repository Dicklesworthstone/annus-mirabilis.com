import { DISCOVERY_PAPERS, type DiscoveryPaper } from "../../content/schemas/discovery.ts";
import {
  connectionAnswerHref,
  validConnectionAnswerIdentity,
} from "../../discovery/connections/answerLocations.ts";
import { revisitHrefFromPrompt } from "../../discovery/revisit/links.ts";

/** The question as it stood when the reader chose to save an explanation. */
export type TeachBackCapture = Readonly<{
  schemaVersion: 1;
  promptId: string;
  prompt: string;
  guideRevision: string;
}>;

export class TeachBackCaptureError extends TypeError {
  readonly code:
    | "notebook-teachback-shape"
    | "notebook-teachback-accessor"
    | "notebook-teachback-data";
  constructor(code: TeachBackCaptureError["code"], message: string) {
    super(message);
    this.name = "TeachBackCaptureError";
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

/** Saved wording is inert text. Unknown fields and future payloads are preserved by refusal. */
export function parseTeachBackCapture(input: unknown, paper: string): TeachBackCapture {
  const fields = ["schemaVersion", "promptId", "prompt", "guideRevision"];
  if (
    !DISCOVERY_PAPERS.includes(paper as DiscoveryPaper) ||
    !input ||
    typeof input !== "object" ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
    Reflect.ownKeys(input).length !== fields.length
  )
    throw new TeachBackCaptureError(
      "notebook-teachback-shape",
      "This saved explanation does not identify a supported guide and question.",
    );
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (fields.some((field) => !Object.hasOwn(descriptors[field] ?? {}, "value")))
    throw new TeachBackCaptureError(
      "notebook-teachback-accessor",
      "Saved explanations must contain plain data, not accessors.",
    );
  const value = input as Record<string, unknown>;
  if (
    value.schemaVersion !== 1 ||
    !boundedText(value.promptId, 160) ||
    !/^[a-z][a-z0-9-]*$/u.test(value.promptId) ||
    !validConnectionAnswerIdentity(paper, value.promptId as string, "explanation") ||
    !boundedText(value.prompt, 4000) ||
    !boundedText(value.guideRevision, 80) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/u.test(value.guideRevision)
  )
    throw new TeachBackCaptureError(
      "notebook-teachback-data",
      "This saved explanation has unsupported question or revision data.",
    );
  return Object.freeze({
    schemaVersion: 1,
    promptId: value.promptId,
    prompt: value.prompt,
    guideRevision: value.guideRevision,
  });
}

/** A public question address only; neither the answer nor the private entry id enters the URL. */
export function teachBackHref(paper: string, input: TeachBackCapture): string {
  const capture = parseTeachBackCapture(input, paper);
  return (
    connectionAnswerHref(paper, capture.promptId, "explanation") ??
    revisitHrefFromPrompt(paper, capture.promptId) ??
    `/discover/${paper}/#explanation-${capture.promptId}`
  );
}
