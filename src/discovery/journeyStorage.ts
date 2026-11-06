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
  readRaw,
  removeRaw,
  type StorageContext,
  type WriteResult,
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

// If quarantine itself cannot be saved, keep the unreadable durable original. A new choice
// still works in memory, but must not overwrite the only retained copy of the earlier data.
const preserveOriginal = new WeakSet<StorageContext>();

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

/**
 * Reads the journey state document, returning the stored document or a clean default state.
 */
export function readJourneyState(ctx: StorageContext): ReadResult<JourneyStateDocument> {
  // A quota failure can leave older bytes on disk. The current page must keep the most recent
  // choice, including a clear, rather than resurrecting that older document on its next read.
  const temporary = ctx.fallback.get(JOURNEY_STORAGE_NAMESPACE);
  const result =
    temporary === undefined
      ? readRaw(ctx, JOURNEY_STORAGE_NAMESPACE)
      : { status: "ok" as const, value: temporary };
  if (result.status !== "ok" || result.value === undefined) {
    if (result.status === "missing") preserveOriginal.delete(ctx);
    return { status: result.status, value: DEFAULT_JOURNEY_STATE };
  }
  try {
    const document: unknown = migrateDocument(JOURNEY_MIGRATION_CHAIN, JSON.parse(result.value));
    if (isJourneyState(document)) {
      if (temporary === undefined) preserveOriginal.delete(ctx);
      return { status: "ok", value: document };
    }
  } catch {
    // Invalid JSON and versions this edition cannot read are preserved by the same path below.
  }
  const held = quarantine(
    ctx,
    JOURNEY_STORAGE_NAMESPACE,
    result.value,
    "journey-choices-unreadable",
  );
  if (held.quarantined && !ctx.fallback.has(QUARANTINE_KEY)) {
    removeRaw(ctx, JOURNEY_STORAGE_NAMESPACE);
    preserveOriginal.delete(ctx);
  } else {
    preserveOriginal.add(ctx);
  }
  return { status: "corrupt", value: DEFAULT_JOURNEY_STATE };
}

function writeJourneyState(ctx: StorageContext, document: JourneyStateDocument): WriteResult {
  const registration = ctx.registry.get(JOURNEY_STORAGE_NAMESPACE);
  if (
    registration?.kind !== "document" ||
    registration.ownerBeadId !== "am-disc-journey-framework-umbg"
  ) {
    return { status: "unregistered" };
  }
  const raw = JSON.stringify(document);
  if (preserveOriginal.has(ctx)) {
    ctx.fallback.set(JOURNEY_STORAGE_NAMESPACE, raw);
    return { status: "unavailable" };
  }
  // The same UTF-16 accounting as the registered storage layer's size display.
  if ((JOURNEY_STORAGE_NAMESPACE.length + raw.length) * 2 > registration.maxBytes) {
    ctx.fallback.set(JOURNEY_STORAGE_NAMESPACE, raw);
    return { status: "quota" };
  }
  return writeRaw(ctx, JOURNEY_STORAGE_NAMESPACE, raw);
}

/**
 * Saves a single choice (e.g. stage prediction or fork branch choice) under its element id.
 */
export function saveJourneyChoice(
  ctx: StorageContext,
  elementId: string,
  choiceId: string,
): WriteResult {
  const current = readJourneyState(ctx).value ?? DEFAULT_JOURNEY_STATE;
  const updated: JourneyStateDocument = {
    schemaVersion: 1,
    choices: {
      ...current.choices,
      [elementId]: choiceId,
    },
  };
  return writeJourneyState(ctx, updated);
}

/** Clears only this stage or fork. A failed save keeps that clear in this page's memory. */
export function clearJourneyChoice(ctx: StorageContext, elementId: string): WriteResult {
  const current = readJourneyState(ctx).value ?? DEFAULT_JOURNEY_STATE;
  const choices = { ...current.choices };
  delete choices[elementId];
  return writeJourneyState(ctx, { schemaVersion: 1, choices });
}

/**
 * Retrieves a saved choice for a specific stage or fork.
 */
export function getJourneyChoice(ctx: StorageContext, elementId: string): string | undefined {
  const state = readJourneyState(ctx).value;
  return state && Object.hasOwn(state.choices, elementId) ? state.choices[elementId] : undefined;
}
