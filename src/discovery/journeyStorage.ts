/**
 * Storage adapter for Discovery Journey local choices under `am:journeys:v1`.
 * Specification: am-disc-journey-framework-umbg, am-plat-local-storage-km8f
 */

import { createMigrationChain, type MigrationChain } from "../platform/storage/migrations.ts";
import {
  type ReadResult,
  readDocument,
  type StorageContext,
  writeDocument,
  type WriteResult,
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

/**
 * Reads the journey state document, returning the stored document or a clean default state.
 */
export function readJourneyState(ctx: StorageContext): ReadResult<JourneyStateDocument> {
  const result = readDocument<JourneyStateDocument>(
    ctx,
    JOURNEY_STORAGE_NAMESPACE,
    JOURNEY_MIGRATION_CHAIN,
  );
  if (result.status === "ok" && result.value) {
    return result;
  }
  return {
    status: result.status,
    value: DEFAULT_JOURNEY_STATE,
  };
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
  return writeDocument(ctx, JOURNEY_STORAGE_NAMESPACE, updated);
}

/**
 * Retrieves a saved choice for a specific stage or fork.
 */
export function getJourneyChoice(ctx: StorageContext, elementId: string): string | undefined {
  const state = readJourneyState(ctx).value;
  return state?.choices[elementId];
}
