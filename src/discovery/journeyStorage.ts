/**
 * Storage adapter for Discovery Journey local choices under `am:journeys:v1`.
 * Specification: am-disc-journey-framework-umbg, am-plat-local-storage-km8f
 *
 * NO PRODUCTION MODULE IMPORTS THIS, AND THE KEY IT OWNS IS PROMISED TO A READER (am-50bk,
 * triaged 2026-10-24). This is the only module in the tree that can write `am:journeys:v1`.
 * Nothing calls it: `Fork.tsx` and `Branch.tsx` hold no state at all, and no page under
 * `src/app/discover/` persists anything. So the key is never written.
 *
 * The consequence is visible to a reader rather than only to this file.
 * `src/platform/storage/keys.ts` registers `am:journeys:v1` as exportable and clearable and
 * describes it as "Your choices and progress in Discover", and `/your-data` renders that registry
 * through `DataPanel.tsx`. A reader is therefore offered a category of their own data that is
 * always empty, and `readerData.test.ts` already asserts the key is absent from the stored set
 * while present in the registry, which is the condition written down from the other side.
 *
 * The repair is to make the journeys persist a fork choice, which is a feature of
 * am-disc-journey-framework-umbg, the bead the key itself names as owner, and not a wiring change
 * that belongs here. Until then this module is the capability and the promise is unmet.
 */

import { createMigrationChain, type MigrationChain } from "../platform/storage/migrations.ts";
import {
  type ReadResult,
  readDocument,
  type StorageContext,
  type WriteResult,
  writeDocument,
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
