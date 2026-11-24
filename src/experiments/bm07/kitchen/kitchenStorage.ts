/**
 * Kitchen-mode observations kept on this device, only when the reader asks
 * (am-bm-07-kitchen-mode-mays, criterion 7). The document holds the accepted observation CSV:
 * clicks, calibration and metadata, never video. It is registered as `am:kitchen:v1`, so it
 * appears in the saved-data panel and can be exported or cleared there.
 */
import { createMigrationChain, type MigrationChain } from "../../../platform/storage/migrations.ts";
import {
  readDocument,
  removeRaw,
  type StorageContext,
  type WriteResult,
  writeDocument,
} from "../../../platform/storage/store.ts";
import { type KitchenSavedSession, parseKitchenSession } from "./sessionFile.ts";

export const KITCHEN_STORAGE_NAMESPACE = "am:kitchen:v1";

type LegacyKitchenObservations = Readonly<{
  schemaVersion: 1;
  /** The accepted document as exportKitchenCsv writes it. */
  csv: string;
  /** Observation rows, for the restore offer. */
  rows: number;
}>;

/** The old shape remains accepted while callers move to complete scientific sessions. */
export type KeptKitchenObservations = LegacyKitchenObservations | KitchenSavedSession;

const KITCHEN_MIGRATION_CHAIN: MigrationChain = createMigrationChain(2, {
  1: (value) => parseKitchenSession(value),
});

/** The kept observations, or undefined when none are kept or the stored copy cannot be read. */
export function readKeptKitchen(ctx: StorageContext): KitchenSavedSession | undefined {
  const result = readDocument<unknown>(
    ctx,
    KITCHEN_STORAGE_NAMESPACE,
    KITCHEN_MIGRATION_CHAIN,
  );
  if (result.status !== "ok") return undefined;
  try {
    return parseKitchenSession(result.value);
  } catch {
    return undefined;
  }
}

export function keepKitchen(ctx: StorageContext, session: KitchenSavedSession): WriteResult;
export function keepKitchen(ctx: StorageContext, csv: string, rows: number): WriteResult;
export function keepKitchen(
  ctx: StorageContext,
  input: string | KitchenSavedSession,
  rows?: number,
): WriteResult {
  const session = parseKitchenSession(
    typeof input === "string" ? { schemaVersion: 1, csv: input, rows } : input,
  );
  return writeDocument(ctx, KITCHEN_STORAGE_NAMESPACE, session);
}

export function removeKeptKitchen(ctx: StorageContext): void {
  removeRaw(ctx, KITCHEN_STORAGE_NAMESPACE);
}
