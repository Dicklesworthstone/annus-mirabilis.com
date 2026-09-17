import type { DiscoveryJourney, DiscoveryPaper } from "../content/schemas/discovery.ts";

export const NOTE_TEXT_LIMIT = 1200;
export const NOTE_ATTEMPT_LIMIT = 8;
export const NOTE_FILE_LIMIT = 128_000;
export type NoteManifest = Readonly<{
  paper: DiscoveryPaper;
  revision: string;
  stages: readonly Readonly<{
    id: string;
    title: string;
    alternatives: readonly Readonly<{ id: string; title: string }>[];
  }>[];
}>;
export type NoteAttempt = Readonly<{
  prediction: string;
  alternativeId: string | null;
  observation: string;
}>;
export type NoteEntry = Readonly<{ stageId: string; attempts: readonly NoteAttempt[] }>;
export type DiscoveryNotebook = Readonly<{
  kind: "discovery-notes";
  schemaVersion: 1;
  paper: DiscoveryPaper;
  journeyRevision: string;
  entries: readonly NoteEntry[];
}>;
export class NotebookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotebookError";
  }
}
const fail = (message: string): never => {
  throw new NotebookError(message);
};
export function noteManifest(journey: DiscoveryJourney): NoteManifest {
  return Object.freeze({
    paper: journey.paper,
    revision: journey.revision,
    stages: Object.freeze(
      journey.stages.map((s) =>
        Object.freeze({
          id: s.id,
          title: s.title,
          alternatives: Object.freeze(
            s.alternatives.map((a) => Object.freeze({ id: a.id, title: a.title })),
          ),
        }),
      ),
    ),
  });
}
export function emptyNotebook(manifest: NoteManifest): DiscoveryNotebook {
  return Object.freeze({
    kind: "discovery-notes",
    schemaVersion: 1,
    paper: manifest.paper,
    journeyRevision: manifest.revision,
    entries: Object.freeze([]),
  });
}
function record(input: unknown, fields: readonly string[]): Record<string, unknown> {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(input))
  )
    return fail("Expected a notes record.");
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(input).length !== fields.length) fail("Unexpected or missing notes fields.");
  for (const key of fields) {
    const d = descriptors[key];
    if (!d?.enumerable || !Object.hasOwn(d, "value"))
      fail("Notes must contain plain data, not accessors.");
  }
  return input as Record<string, unknown>;
}
function array(input: unknown, maximum: number): readonly unknown[] {
  if (!Array.isArray(input) || input.length > maximum)
    return fail("Notes exceed the entry budget.");
  const copy = [];
  for (let i = 0; i < input.length; i++) {
    const d = Object.getOwnPropertyDescriptor(input, i);
    if (!d || !Object.hasOwn(d, "value"))
      return fail("Sparse notes and accessors are not admitted.");
    copy.push(d.value);
  }
  return copy;
}
function hasDisallowedControlChars(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (
      code <= 0x08 ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f
    ) {
      return true;
    }
  }
  return false;
}
function text(input: unknown): string {
  if (
    typeof input !== "string" ||
    input.length > NOTE_TEXT_LIMIT ||
    hasDisallowedControlChars(input)
  )
    return fail(`Each note must be text of at most ${NOTE_TEXT_LIMIT} characters.`);
  return input;
}
function stage(manifest: NoteManifest, stageId: string) {
  return (
    manifest.stages.find((s) => s.id === stageId) ??
    fail("This step does not belong to this guide.")
  );
}
/** Full validation/copy at every import and mutation boundary. No imported answer is executed. */
export function validateNotebook(input: unknown, manifest: NoteManifest): DiscoveryNotebook {
  const r = record(input, ["kind", "schemaVersion", "paper", "journeyRevision", "entries"]);
  if (r.kind !== "discovery-notes" || r.schemaVersion !== 1)
    fail("This is not a supported discovery-notes file.");
  if (r.paper !== manifest.paper) fail("These notes belong to a different paper.");
  if (r.journeyRevision !== manifest.revision)
    fail(
      "These notes use a different guide revision. Export them before replacing them; they were not relabeled.",
    );
  const seen = new Set<string>();
  const entries = array(r.entries, manifest.stages.length).map((raw): NoteEntry => {
    const e = record(raw, ["stageId", "attempts"]);
    if (typeof e.stageId !== "string") return fail("Missing step identity.");
    const step = stage(manifest, e.stageId);
    if (seen.has(step.id)) fail("A step appears more than once in these notes.");
    seen.add(step.id);
    const attempts = array(e.attempts, NOTE_ATTEMPT_LIMIT).map((raw): NoteAttempt => {
      const a = record(raw, ["prediction", "alternativeId", "observation"]);
      if (a.alternativeId !== null && !step.alternatives.some((v) => v.id === a.alternativeId))
        fail("The recorded alternative does not belong to this step.");
      const prediction = text(a.prediction);
      if (!prediction.trim() && a.alternativeId === null)
        fail("Record a prediction or a tentative alternative first.");
      return Object.freeze({
        prediction,
        alternativeId: a.alternativeId as string | null,
        observation: text(a.observation),
      });
    });
    if (attempts.length === 0) fail("An empty step entry is not a recorded prediction.");
    return Object.freeze({ stageId: step.id, attempts: Object.freeze(attempts) });
  });
  // Canonical guide order makes exports stable regardless of the reader's traversal order.
  entries.sort(
    (a, b) =>
      manifest.stages.findIndex((s) => s.id === a.stageId) -
      manifest.stages.findIndex((s) => s.id === b.stageId),
  );
  const result: DiscoveryNotebook = Object.freeze({
    ...emptyNotebook(manifest),
    entries: Object.freeze(entries),
  });
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > NOTE_FILE_LIMIT)
    fail("Notes exceed the export size budget. Save a copy and start a new notebook.");
  return result;
}
export function decodeNotebook(raw: string, manifest: NoteManifest): DiscoveryNotebook {
  if (
    typeof raw !== "string" ||
    raw.length > NOTE_FILE_LIMIT ||
    new TextEncoder().encode(raw).byteLength > NOTE_FILE_LIMIT
  )
    fail("The notes file is too large.");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return fail("The notes file is not valid JSON.");
  }
  return validateNotebook(value, manifest);
}
export function encodeNotebook(doc: DiscoveryNotebook, manifest: NoteManifest): string {
  // Compact JSON is the bounded storage and interchange format. Browser exports add no hidden metadata.
  return JSON.stringify(validateNotebook(doc, manifest));
}
export function recordPrediction(
  doc: DiscoveryNotebook,
  manifest: NoteManifest,
  stageId: string,
  prediction: string,
  alternativeId: string | null,
): DiscoveryNotebook {
  const checked = validateNotebook(doc, manifest);
  stage(manifest, stageId);
  const previous = checked.entries.find((e) => e.stageId === stageId);
  if ((previous?.attempts.length ?? 0) >= NOTE_ATTEMPT_LIMIT)
    fail(
      `This step already has ${NOTE_ATTEMPT_LIMIT} attempts. Export your notes before starting over.`,
    );
  const entry = {
    stageId,
    attempts: [...(previous?.attempts ?? []), { prediction, alternativeId, observation: "" }],
  };
  return validateNotebook(
    { ...checked, entries: [...checked.entries.filter((e) => e.stageId !== stageId), entry] },
    manifest,
  );
}
export function recordObservation(
  doc: DiscoveryNotebook,
  manifest: NoteManifest,
  stageId: string,
  attemptIndex: number,
  observation: string,
): DiscoveryNotebook {
  const checked = validateNotebook(doc, manifest);
  const entry = checked.entries.find((e) => e.stageId === stageId);
  if (!Number.isSafeInteger(attemptIndex) || attemptIndex < 0 || !entry?.attempts[attemptIndex])
    fail("Choose a recorded prediction before attaching an observation.");
  return validateNotebook(
    {
      ...checked,
      entries: checked.entries.map((e) =>
        e.stageId !== stageId
          ? e
          : {
              ...e,
              attempts: e.attempts.map((a, i) => (i !== attemptIndex ? a : { ...a, observation })),
            },
      ),
    },
    manifest,
  );
}
/** File reads are asynchronous. A local edit, clear or newer import supersedes an older read. */
export function createImportGuard() {
  let generation = 0;
  return Object.freeze({
    begin: () => ++generation,
    invalidate: () => {
      generation++;
    },
    current: (token: number) => token === generation,
  });
}
