/**
 * am-read-return-stack-oxa. `?open=<kind>:<id>` parsing (bounded to 200 characters, invalid
 * values ignored) and StackState <-> history.state serialization. State parameters (Detail,
 * Perspective, notation, unit-layer, selection, forms, lab references) never enter the canonical
 * URL: only `?open=` does, and only one level deep, which is why deeper stacks are not linkable.
 */
import { type ClarificationKindDefinition, getClarificationKind } from "./kinds.ts";
import { type LabReference, pushFrame, type StackFrame, type StackState } from "./stackStore.ts";

export const MAX_OPEN_PARAM_LENGTH = 200;

export type ParsedOpenParam = Readonly<{ kind: string; id: string }>;

/** Splits `kind:id` on the first colon. Neither half may be empty. Returns null for anything
 * else, including a value with no colon at all or one over the length bound. */
export function parseOpenParam(raw: string | null | undefined): ParsedOpenParam | null {
  if (!raw || raw.length > MAX_OPEN_PARAM_LENGTH) return null;
  const sep = raw.indexOf(":");
  if (sep <= 0 || sep === raw.length - 1) return null;
  return Object.freeze({ kind: raw.slice(0, sep), id: raw.slice(sep + 1) });
}

export function serializeOpenParam(kind: string, id: string): string {
  const value = `${kind}:${id}`;
  if (value.length > MAX_OPEN_PARAM_LENGTH)
    throw new RangeError(`?open= value exceeds ${MAX_OPEN_PARAM_LENGTH} characters: "${value}".`);
  return value;
}

export type ResolvedOpenParam<Parsed = unknown> = Readonly<{
  kind: string;
  rawId: string;
  parsedId: Parsed;
  definition: ClarificationKindDefinition<Parsed>;
}>;

/**
 * Resolves a raw `?open=` value against the closed kind registry. Returns null for: an
 * unparseable value, an unregistered kind, or an id the kind's own parser refuses. None of these
 * three cases opens anything or breaks the page -- this bead's "Invalid values" requirement.
 */
export function resolveOpenParam(raw: string | null | undefined): ResolvedOpenParam | null {
  const parsed = parseOpenParam(raw);
  if (!parsed) return null;
  const definition = getClarificationKind(parsed.kind);
  if (!definition) return null;
  const parsedId = definition.parseId(parsed.id);
  if (parsedId === null || parsedId === undefined) return null;
  return Object.freeze({ kind: parsed.kind, rawId: parsed.id, parsedId, definition });
}

// ---- openClarification ----------------------------------------------------------------------

export type ReturnToContext = Readonly<{
  anchor: string;
  face: string;
  detail: number;
  perspective: string | null;
  notation: string | null;
  unitLayer: string | null;
  selectionId: string | null;
  formId: string | null;
  triggerId: string;
  scrollFraction: number;
  lab: LabReference | null;
}>;

export type OpenClarificationInput = Readonly<{
  kind: string;
  id: string;
  question: string;
  returnTo: ReturnToContext;
}>;

export type OpenClarificationOutcome =
  | Readonly<{ status: "unknown-kind"; kind: string }>
  | Readonly<{ status: "parser-rejected"; kind: string; id: string }>
  | Readonly<{
      status: "inline";
      kind: string;
      parsedId: unknown;
      definition: ClarificationKindDefinition;
    }>
  | Readonly<{
      status: "descended";
      state: StackState;
      frame: StackFrame;
      replacedDeepest: boolean;
      definition: ClarificationKindDefinition;
      parsedId: unknown;
    }>;

/**
 * `openClarification({ kind, id, question, returnTo })`: resolves the kind, parses the id, and
 * either pushes exactly one frame (a descending kind) or reports an inline open with no frame (a
 * `descends: false` kind such as `term`). The caller is responsible for the one history entry a
 * descent costs -- this function returns the new StackState but does not touch `history` itself,
 * so it stays testable with no DOM and reusable from both the real reader shell and the no-frame
 * inline path.
 */
export function openClarification(
  stack: StackState,
  input: OpenClarificationInput,
): OpenClarificationOutcome {
  const definition = getClarificationKind(input.kind);
  if (!definition) return { status: "unknown-kind", kind: input.kind };
  const parsedId = definition.parseId(input.id);
  if (parsedId === null || parsedId === undefined)
    return { status: "parser-rejected", kind: input.kind, id: input.id };

  if (!definition.descends) return { status: "inline", kind: input.kind, parsedId, definition };

  const frame: StackFrame = {
    anchor: input.returnTo.anchor,
    face: input.returnTo.face,
    detail: input.returnTo.detail,
    perspective: input.returnTo.perspective,
    notation: input.returnTo.notation,
    unitLayer: input.returnTo.unitLayer,
    selectionId: input.returnTo.selectionId,
    formId: input.returnTo.formId,
    clarification: { kind: input.kind, id: input.id },
    title: definition.title(parsedId),
    question: input.question,
    triggerId: input.returnTo.triggerId,
    scrollFraction: input.returnTo.scrollFraction,
    lab: input.returnTo.lab,
  };
  const { state, replacedDeepest } = pushFrame(stack, frame);
  return {
    status: "descended",
    state,
    frame,
    replacedDeepest,
    definition,
    parsedId,
  };
}

// ---- history.state serialization -----------------------------------------------------------------
// Frames live only in history.state and memory (this bead's Privacy requirement). The shape below
// is what this module writes to history.state; it is untrusted on read (an old build, a browser
// extension, or a hand-edited state object may not match it), so restoration validates every
// field rather than trusting the cast.

export type SerializedStackState = Readonly<{ frames: readonly StackFrame[] }>;

export function serializeStackState(state: StackState): SerializedStackState {
  return Object.freeze({ frames: state.frames });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isLabReference(value: unknown): value is LabReference {
  if (!isPlainRecord(value)) return false;
  return (
    typeof value.instanceId === "string" &&
    typeof value.experimentId === "string" &&
    typeof value.modelIdentity === "string" &&
    typeof value.runId === "string" &&
    typeof value.checkpointDigest === "string" &&
    typeof value.compactTape === "string"
  );
}

function isStackFrame(value: unknown): value is StackFrame {
  if (!isPlainRecord(value)) return false;
  const clarification = value.clarification;
  return (
    typeof value.anchor === "string" &&
    typeof value.face === "string" &&
    typeof value.detail === "number" &&
    (value.perspective === null || typeof value.perspective === "string") &&
    (value.notation === null || typeof value.notation === "string") &&
    (value.unitLayer === null || typeof value.unitLayer === "string") &&
    (value.selectionId === null || typeof value.selectionId === "string") &&
    (value.formId === null || typeof value.formId === "string") &&
    isPlainRecord(clarification) &&
    typeof clarification.kind === "string" &&
    typeof clarification.id === "string" &&
    typeof value.title === "string" &&
    typeof value.question === "string" &&
    typeof value.triggerId === "string" &&
    typeof value.scrollFraction === "number" &&
    Number.isFinite(value.scrollFraction) &&
    (value.lab === null || isLabReference(value.lab))
  );
}

/**
 * Validates and reconstructs a StackState from an untrusted `history.state` payload. Returns null
 * (never throws) for anything that does not match: the caller falls back to an empty stack, the
 * same way src/reader/navigation/state.ts's restoreReaderState falls back to parseReaderLocation.
 */
export function deserializeStackState(input: unknown): StackState | null {
  if (!isPlainRecord(input) || !Array.isArray(input.frames)) return null;
  if (!input.frames.every(isStackFrame)) return null;
  return Object.freeze({ frames: Object.freeze(input.frames.map((f) => Object.freeze({ ...f }))) });
}
