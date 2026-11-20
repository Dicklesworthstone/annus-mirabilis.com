/**
 * Storage adapter for Discovery Journey local choices under `am:journeys:v1`.
 * Specification: am-disc-journey-framework-umbg, am-plat-local-storage-km8f
 *
 * The optional ForkChoice island uses this document on all four discovery journeys. Reads
 * validate imported data; writes change one choice without replacing the other forks' choices.
 * Choices are written only after an explicit selection or clear; unreadable data is preserved
 * through the storage layer's quarantine.
 */

import {
  createMigrationChain,
  type MigrationChain,
  migrateDocument,
} from "../platform/storage/migrations.ts";
import { QUARANTINE_KEY, quarantine } from "../platform/storage/quarantine.ts";
import {
  type ReadResult,
  removeRaw,
  type StorageContext,
  type WriteStatus,
  writeRaw,
} from "../platform/storage/store.ts";

export const JOURNEY_STORAGE_NAMESPACE = "am:journeys:v1";

export interface JourneyStateDocument {
  readonly schemaVersion: 1;
  readonly choices: Readonly<Record<string, string>>;
}

export const JOURNEY_MIGRATION_CHAIN: MigrationChain = createMigrationChain(1, {});

export const DEFAULT_JOURNEY_STATE: JourneyStateDocument = {
  schemaVersion: 1,
  choices: {},
};

export type JourneyReadResult = ReadResult<JourneyStateDocument> &
  Readonly<{ pending?: readonly string[]; conflicts?: readonly string[] }>;
export type JourneyWriteStatus = WriteStatus | "conflict";
export type JourneyWriteResult = Readonly<{ status: JourneyWriteStatus }>;

type DurableJourney = Readonly<{
  status: ReadResult["status"];
  raw: string | null | undefined;
  value: JourneyStateDocument;
  writable: boolean;
}>;
type PendingChoice = {
  before: string | undefined;
  after: string | undefined;
  known: boolean;
  baseExisted: boolean;
  conflict: boolean;
};
type JourneySession = {
  known?: DurableJourney;
  latest?: DurableJourney;
  pending: Map<string, PendingChoice>;
};
const sessions = new WeakMap<StorageContext, JourneySession>();
function sessionFor(ctx: StorageContext): JourneySession {
  let session = sessions.get(ctx);
  if (!session) {
    session = { pending: new Map() };
    sessions.set(ctx, session);
  }
  return session;
}
function choiceAt(document: JourneyStateDocument, id: string): string | undefined {
  return Object.hasOwn(document.choices, id) ? document.choices[id] : undefined;
}
function readDurableBytes(ctx: StorageContext): string | null | undefined {
  try {
    return ctx.backend()?.getItem(JOURNEY_STORAGE_NAMESPACE);
  } catch {
    return undefined;
  }
}

function isJourneyState(value: unknown): value is JourneyStateDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const document = value as Record<string, unknown>;
  const choices = document.choices;
  return (
    document.schemaVersion === 1 &&
    choices !== null &&
    typeof choices === "object" &&
    !Array.isArray(choices) &&
    Object.entries(choices).every(
      ([id, choice]) =>
        id.length > 0 &&
        id.length <= 256 &&
        typeof choice === "string" &&
        choice.length > 0 &&
        choice.length <= 256,
    )
  );
}

function readDurableJourney(ctx: StorageContext): DurableJourney {
  const raw = readDurableBytes(ctx);
  if (raw === undefined || raw === null)
    return {
      status: raw === null ? "missing" : "unavailable",
      raw,
      value: DEFAULT_JOURNEY_STATE,
      writable: raw === null,
    };
  try {
    const document: unknown = migrateDocument(JOURNEY_MIGRATION_CHAIN, JSON.parse(raw));
    if (isJourneyState(document)) return { status: "ok", raw, value: document, writable: true };
  } catch {
    // Invalid JSON and versions this edition cannot read are preserved by the same path below.
  }
  const held = quarantine(ctx, JOURNEY_STORAGE_NAMESPACE, raw, "journey-choices-unreadable");
  if (held.quarantined && !ctx.fallback.has(QUARANTINE_KEY) && readDurableBytes(ctx) === raw) {
    removeRaw(ctx, JOURNEY_STORAGE_NAMESPACE);
    if (readDurableBytes(ctx) === null)
      return { status: "corrupt", raw: null, value: DEFAULT_JOURNEY_STATE, writable: true };
  }
  return { status: "corrupt", raw, value: DEFAULT_JOURNEY_STATE, writable: false };
}

/**
 * Read durable choices even while this page has unsaved work. Pending changes overlay only their
 * own forks. Disjoint edits combine; competing edits stay in this page and leave the other tab's
 * saved choice untouched until the reader explicitly chooses again at that fork.
 */
export function readJourneyState(ctx: StorageContext): JourneyReadResult {
  const session = sessionFor(ctx);
  const saved = readDurableJourney(ctx);
  session.latest = saved;
  if (saved.writable) session.known = saved;
  const basis = saved.writable ? saved.value : (session.known?.value ?? DEFAULT_JOURNEY_STATE);
  const choices = new Map(Object.entries(basis.choices));
  for (const [id, change] of session.pending) {
    if (saved.writable) {
      const current = choiceAt(saved.value, id);
      if (current === change.after) {
        session.pending.delete(id);
        continue;
      }
      change.conflict =
        change.conflict ||
        (change.known ? current !== change.before : current !== undefined) ||
        (saved.raw === null && change.baseExisted);
    }
    if (change.after === undefined) choices.delete(id);
    else choices.set(id, change.after);
  }
  const value: JourneyStateDocument = { schemaVersion: 1, choices: Object.fromEntries(choices) };
  const pending = [...session.pending.keys()];
  const conflicts = [...session.pending].filter(([, change]) => change.conflict).map(([id]) => id);
  if (pending.length) ctx.fallback.set(JOURNEY_STORAGE_NAMESPACE, JSON.stringify(value));
  else ctx.fallback.delete(JOURNEY_STORAGE_NAMESPACE);
  return {
    status: saved.status,
    value,
    ...(pending.length ? { pending, conflicts } : {}),
  };
}

/** A queued clear still requires consent even if another tab has already saved newer bytes. */
export function notifyJourneyStorageClear(ctx: StorageContext): void {
  for (const change of sessionFor(ctx).pending.values()) change.conflict = true;
}

function writeJourneyState(ctx: StorageContext): JourneyWriteResult {
  const registration = ctx.registry.get(JOURNEY_STORAGE_NAMESPACE);
  if (
    registration?.kind !== "document" ||
    registration.ownerBeadId !== "am-disc-journey-framework-umbg"
  ) {
    return { status: "unregistered" };
  }
  const current = readJourneyState(ctx);
  const session = sessionFor(ctx);
  if (current.conflicts?.length) return { status: "conflict" };
  // A successful write is unsafe when the current durable contents could not be read.
  if (!session.latest?.writable) return { status: "unavailable" };
  if (!session.pending.size) return { status: "ok" };
  const document = current.value ?? DEFAULT_JOURNEY_STATE;
  const raw = JSON.stringify(document);
  // The same UTF-16 accounting as the registered storage layer's size display.
  if ((JOURNEY_STORAGE_NAMESPACE.length + raw.length) * 2 > registration.maxBytes) {
    ctx.fallback.set(JOURNEY_STORAGE_NAMESPACE, raw);
    return { status: "quota" };
  }
  const result = writeRaw(ctx, JOURNEY_STORAGE_NAMESPACE, raw);
  if (result.status === "ok") {
    session.pending.clear();
    session.known = { status: "ok", raw, value: document, writable: true };
  }
  return result;
}

function changeJourneyChoice(
  ctx: StorageContext,
  elementId: string,
  choice: string | undefined,
): JourneyWriteResult {
  readJourneyState(ctx);
  const session = sessionFor(ctx);
  const baseline = session.known;
  // A new explicit choice resolves this fork against the version the reader can now read.
  // It grants no permission to overwrite competing changes at any other fork.
  session.pending.set(elementId, {
    before: baseline ? choiceAt(baseline.value, elementId) : undefined,
    after: choice,
    known: baseline !== undefined,
    baseExisted: baseline !== undefined && baseline.raw !== null,
    conflict: false,
  });
  return writeJourneyState(ctx);
}

/**
 * Saves a single choice (e.g. stage prediction or fork branch choice) under its element id.
 */
export function saveJourneyChoice(
  ctx: StorageContext,
  elementId: string,
  choiceId: string,
): JourneyWriteResult {
  return changeJourneyChoice(ctx, elementId, choiceId);
}

/** Clears only this stage or fork. A failed save keeps that clear in this page's memory. */
export function clearJourneyChoice(ctx: StorageContext, elementId: string): JourneyWriteResult {
  return changeJourneyChoice(ctx, elementId, undefined);
}

/** Retry pending edits without treating a newly changed saved choice as consent to replace it. */
export function retryJourneyChoices(ctx: StorageContext): JourneyWriteResult {
  return writeJourneyState(ctx);
}

/**
 * Retrieves a saved choice for a specific stage or fork.
 */
export function getJourneyChoice(ctx: StorageContext, elementId: string): string | undefined {
  const state = readJourneyState(ctx).value;
  return state && Object.hasOwn(state.choices, elementId) ? state.choices[elementId] : undefined;
}
