import { parseKitchenCsv } from "./csv.ts";
import { KITCHEN_OPTIONS, type KitchenOptions } from "./definition.ts";
import {
  closed,
  KITCHEN_PROTOCOL,
  textDigest,
  validateKitchenOptions,
} from "./protocol.ts";
import { KITCHEN_LIMITS } from "./schema.ts";
import type { KitchenAccepted } from "./session.ts";

export const KITCHEN_SESSION_FORMAT = "annus-kitchen-session";
/** A bounded JSON file; the existing CSV limit and storage namespace budget are unchanged. */
export const KITCHEN_SESSION_FILE_BYTES = 2_200_000;

export type KitchenSessionOrigin = Readonly<{
  modelVersion: string;
  sourceDigest: string;
  sourceId: string;
  documentDigest: string;
}>;

export type KitchenSavedSession = Readonly<{
  schemaVersion: 2;
  format: typeof KITCHEN_SESSION_FORMAT;
  csv: string;
  rows: number;
  options: KitchenOptions;
  /** Old observation-only saves did not record their evaluator or analysis choices. */
  origin: KitchenSessionOrigin | null;
}>;

export type KitchenSessionPreview = Readonly<{
  session: KitchenSavedSession;
  compatibility: "same-evaluator" | "changed-evaluator" | "legacy-observations";
  notice: string;
}>;

export class KitchenSessionFileError extends TypeError {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "KitchenSessionFileError";
    this.code = code;
  }
}

function refuse(message: string): never {
  throw new KitchenSessionFileError("kitchen-session-invalid", message);
}

function record(input: unknown, keys: readonly string[]): Record<string, unknown> {
  try {
    closed(input, keys);
  } catch {
    refuse("The saved session has an unsupported field or document structure.");
  }
  return input;
}

function boundedText(text: unknown): asserts text is string {
  if (
    typeof text !== "string" ||
    text.length > KITCHEN_SESSION_FILE_BYTES ||
    new TextEncoder().encode(text).byteLength > KITCHEN_SESSION_FILE_BYTES
  )
    refuse(
      "Choose a kitchen session file no larger than 2.2 MB. Your current analysis is unchanged.",
    );
}

function originOf(input: unknown): KitchenSessionOrigin | null {
  if (input === null) return null;
  const value = record(input, ["modelVersion", "sourceDigest", "sourceId", "documentDigest"]);
  if (
    typeof value.modelVersion !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(value.modelVersion) ||
    typeof value.sourceDigest !== "string" ||
    !/^source:sha256:[a-f0-9]{64}$/.test(value.sourceDigest) ||
    typeof value.sourceId !== "string" ||
    !/^sha256:[a-f0-9]{64}$/.test(value.sourceId) ||
    typeof value.documentDigest !== "string" ||
    !/^sha256:[a-f0-9]{64}$/.test(value.documentDigest)
  )
    refuse("The saved session must identify its model, evaluator and observation file.");
  return Object.freeze({
    modelVersion: value.modelVersion,
    sourceDigest: value.sourceDigest,
    sourceId: value.sourceId,
    documentDigest: value.documentDigest,
  });
}

function optionsOf(input: unknown): KitchenOptions {
  const value = record(input, ["track", "axis", "coverage", "constantSet"]);
  // Check primitive kinds before the owner's validator, so a supplied object cannot execute
  // custom string conversion while an import is only being inspected.
  if (
    typeof value.track !== "string" ||
    typeof value.axis !== "string" ||
    typeof value.coverage !== "number" ||
    typeof value.constantSet !== "string"
  )
    refuse("The saved analysis choices must name a track, coordinate, coverage and constant set.");
  try {
    return validateKitchenOptions(value);
  } catch {
    refuse("The saved analysis choices are outside the kitchen laboratory's supported ranges.");
  }
}

/** Closed, bounded data admission only. No worker, inference, storage write or network access. */
export function parseKitchenSession(input: unknown): KitchenSavedSession {
  if (!input || typeof input !== "object") refuse("Choose a saved kitchen session document.");
  const version = Object.getOwnPropertyDescriptor(input, "schemaVersion");
  if (!version || !Object.hasOwn(version, "value"))
    refuse("The saved session has no supported schema version.");
  const legacy = version.value === 1;
  if (!legacy && version.value !== 2) refuse("This kitchen session version is not supported.");
  const value = record(
    input,
    legacy
      ? ["schemaVersion", "csv", "rows"]
      : ["schemaVersion", "format", "csv", "rows", "options", "origin"],
  );
  if (!legacy && value.format !== KITCHEN_SESSION_FORMAT)
    refuse("Choose a kitchen session file. An exported analysis receipt cannot restore a session.");
  if (
    typeof value.csv !== "string" ||
    value.csv.length > KITCHEN_LIMITS.bytes ||
    !Number.isSafeInteger(value.rows) ||
    Number(value.rows) < 1 ||
    Number(value.rows) > KITCHEN_LIMITS.rows
  )
    refuse("The saved session needs a bounded observation CSV and its complete row count.");
  let rows: number;
  try {
    rows = parseKitchenCsv(value.csv).points.length;
  } catch {
    refuse(
      "The saved observation CSV could not be read. The existing analysis remains available.",
    );
  }
  if (rows !== value.rows) refuse("The saved row count does not match the observation CSV.");
  const options = legacy ? KITCHEN_OPTIONS : optionsOf(value.options);
  const origin = legacy ? null : originOf(value.origin);
  if (
    origin === null &&
    Object.entries(KITCHEN_OPTIONS).some(
      ([key, setting]) => options[key as keyof KitchenOptions] !== setting,
    )
  )
    refuse("An observation-only save must explicitly use the original default analysis choices.");
  if (origin !== null && !options.track)
    refuse("An accepted session must identify the particle track that was analyzed.");
  const session: KitchenSavedSession = Object.freeze({
    schemaVersion: 2,
    format: KITCHEN_SESSION_FORMAT,
    csv: value.csv,
    rows,
    options,
    origin,
  });
  boundedText(JSON.stringify(session));
  return session;
}

/** Verify the observation identity before showing an actionable restore preview. */
export async function prepareKitchenSession(
  input: unknown,
  currentSourceDigest: string,
): Promise<KitchenSessionPreview> {
  const session = parseKitchenSession(input);
  if (!/^source:sha256:[a-f0-9]{64}$/.test(currentSourceDigest))
    refuse("The current kitchen evaluator has no source identity; no restore was prepared.");
  if (session.origin && (await textDigest(session.csv)) !== session.origin.documentDigest)
    refuse("The saved observations do not match their recorded identity. Nothing was restored.");
  const compatibility =
    session.origin === null
      ? "legacy-observations"
      : session.origin.sourceDigest === currentSourceDigest &&
          session.origin.modelVersion === KITCHEN_PROTOCOL
        ? "same-evaluator"
        : "changed-evaluator";
  const notice =
    compatibility === "legacy-observations"
      ? "This older save contains observations only. Its analysis choices and evaluator were not recorded. Confirmation uses the first particle track, x coordinate, 95% coverage and the file's gas-constant declaration."
      : compatibility === "changed-evaluator"
        ? "The evaluator has changed since this session was saved. Confirmation analyzes the saved observations and choices with the current evaluator as a new calculation."
        : "The evaluator matches this saved session. Confirmation performs a fresh calculation from its observations and analysis choices.";
  return Object.freeze({ session, compatibility, notice });
}

/** Capture only a complete, coherent accepted bundle; unfinished controls never enter the file. */
export async function captureKitchenSession(
  accepted: KitchenAccepted,
  sourceDigest: string,
): Promise<KitchenSavedSession> {
  const { snapshot, report } = accepted;
  if (
    snapshot.experimentId !== "bm-07-kitchen" ||
    !snapshot.final ||
    snapshot.parameters.sourceId !== accepted.sourceId ||
    snapshot.parameters.documentDigest !== accepted.documentDigest ||
    Object.entries(report.options).some(([key, value]) => snapshot.parameters[key] !== value) ||
    !report.tracks.some((track) => track.key === report.selectedTrack) ||
    (report.options.track !== "" && report.options.track !== report.selectedTrack)
  )
    refuse("Save a complete accepted kitchen analysis whose observations and choices agree.");
  const { session } = await prepareKitchenSession(
    {
      schemaVersion: 2,
      format: KITCHEN_SESSION_FORMAT,
      csv: accepted.csv,
      rows: accepted.document.points.length,
      options: { ...report.options, track: report.selectedTrack },
      origin: {
        modelVersion: KITCHEN_PROTOCOL,
        sourceDigest,
        sourceId: accepted.sourceId,
        documentDigest: accepted.documentDigest,
      },
    },
    sourceDigest,
  );
  return session;
}

export function kitchenSessionJson(session: KitchenSavedSession): string {
  const text = `${JSON.stringify(parseKitchenSession(session), null, 2)}\n`;
  boundedText(text);
  return text;
}

export async function readKitchenSessionFile(
  text: string,
  currentSourceDigest: string,
): Promise<KitchenSessionPreview> {
  boundedText(text);
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    refuse("The selected file is not a readable kitchen session JSON document.");
  }
  return prepareKitchenSession(input, currentSourceDigest);
}
