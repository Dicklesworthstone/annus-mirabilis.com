import {
  assessRelativity,
  isRelativityCardId,
  isRelativityMeasurementId,
  type LengthPrediction,
  RELATIVITY_CARDS,
  type RelativityCardId,
  type RelativityMeasurementId,
} from "./specialRelativityInvestigation.ts";

export const RELATIVITY_SESSION_VERSION = 1;
export const RELATIVITY_NOTE_LIMIT = 8000;
export const RELATIVITY_IMPORT_LIMIT = 64000;
export const RELATIVITY_LINK_LIMIT = 4096;
export type RelativitySession = Readonly<{
  order: readonly RelativityCardId[];
  measurement: RelativityMeasurementId;
  predictions: Readonly<Partial<Record<RelativityMeasurementId, LengthPrediction>>>;
  note: string;
}>;
export type SessionDecode =
  | Readonly<{ kind: "session"; session: RelativitySession }>
  | Readonly<{ kind: "absent" }>
  | Readonly<{ kind: "invalid"; message: string }>;

export function emptyRelativitySession(): RelativitySession {
  return { order: [], measurement: "same-platform-time", predictions: {}, note: "" };
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function invalid(message: string): SessionDecode {
  return { kind: "invalid", message };
}
function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function validOrder(value: unknown): value is RelativityCardId[] {
  return (
    Array.isArray(value) &&
    value.length <= RELATIVITY_CARDS.length &&
    value.every(isRelativityCardId) &&
    new Set(value).size === value.length
  );
}

/** Fail closed on malformed/unknown data, never repair it into an apparently valid argument. */
export function parseRelativitySession(value: unknown): SessionDecode {
  if (
    !record(value) ||
    !hasOnlyKeys(value, ["format", "version", "order", "measurement", "predictions", "note"])
  ) {
    return invalid("This is not a supported relativity investigation record.");
  }
  if (
    value.format !== "annus-mirabilis-relativity-investigation" ||
    value.version !== RELATIVITY_SESSION_VERSION
  ) {
    return invalid("Unsupported investigation format or version; no state was applied.");
  }
  if (!validOrder(value.order))
    return invalid("The card order contains unknown, duplicate or excessive cards.");
  if (!isRelativityMeasurementId(value.measurement)) return invalid("Unknown measurement example.");
  if (typeof value.note !== "string" || value.note.length > RELATIVITY_NOTE_LIMIT) {
    return invalid(`Notes must be text of at most ${RELATIVITY_NOTE_LIMIT} characters.`);
  }
  if (!record(value.predictions))
    return invalid("Predictions must be keyed by measurement example.");
  const predictions: Partial<Record<RelativityMeasurementId, LengthPrediction>> = {};
  for (const [id, prediction] of Object.entries(value.predictions)) {
    if (!isRelativityMeasurementId(id) || (prediction !== "yes" && prediction !== "no")) {
      return invalid("A prediction names an unknown example or answer.");
    }
    predictions[id] = prediction;
  }
  // Copy only admitted fields. Imported assessments, HTML and executable data are never used.
  return {
    kind: "session",
    session: {
      order: [...value.order],
      measurement: value.measurement,
      predictions,
      note: value.note,
    },
  };
}

export function exportRelativitySession(session: RelativitySession): string {
  const payload = {
    format: "annus-mirabilis-relativity-investigation",
    version: RELATIVITY_SESSION_VERSION,
    order: session.order,
    measurement: session.measurement,
    predictions: session.predictions,
    note: session.note,
  };
  const parsed = parseRelativitySession(payload);
  if (parsed.kind !== "session")
    throw new Error(parsed.kind === "invalid" ? parsed.message : "Invalid session.");
  return JSON.stringify(payload, null, 2);
}

export function importRelativitySession(text: string): SessionDecode {
  if (text.length > RELATIVITY_IMPORT_LIMIT)
    return invalid("This investigation file is too large.");
  try {
    return parseRelativitySession(JSON.parse(text));
  } catch {
    return invalid("This file is not valid investigation JSON; no state was applied.");
  }
}

/** Share ONLY public card IDs and the chosen example. Notes and predictions stay private. */
export function encodeRelativityLink(session: RelativitySession): string {
  if (!validOrder(session.order) || !isRelativityMeasurementId(session.measurement))
    throw new Error("Invalid shared investigation.");
  const query = new URLSearchParams();
  query.set("sr", String(RELATIVITY_SESSION_VERSION));
  query.set("cards", session.order.join(","));
  query.set("example", session.measurement);
  return query.toString();
}

export function decodeRelativityLink(search: string): SessionDecode {
  if (search.length > RELATIVITY_LINK_LIMIT) return invalid("This investigation link is too long.");
  const query = new URLSearchParams(search);
  if (!["sr", "cards", "example"].some((key) => query.has(key))) return { kind: "absent" };
  if (
    ["sr", "cards", "example"].some((key) => query.getAll(key).length !== 1) ||
    query.get("sr") !== String(RELATIVITY_SESSION_VERSION)
  ) {
    return invalid("The link has missing, repeated or unsupported investigation parameters.");
  }
  const cards = query.get("cards");
  const order = cards === "" ? [] : cards?.split(",");
  const measurement = query.get("example");
  if (!validOrder(order) || !isRelativityMeasurementId(measurement))
    return invalid("The link contains unknown or duplicate investigation choices.");
  return {
    kind: "session",
    session: { ...emptyRelativitySession(), order: [...order], measurement },
  };
}

/** Derived outcomes are recomputed from current authored dependencies, never stored as authority. */
export function replayRelativitySession(session: RelativitySession) {
  return { session, assessment: assessRelativity(session.order) };
}
