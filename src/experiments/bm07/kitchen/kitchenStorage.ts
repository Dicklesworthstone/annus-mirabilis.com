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

export const KITCHEN_STORAGE_NAMESPACE = "am:kitchen:v1";

export type KeptKitchenObservations = Readonly<{
  schemaVersion: 1;
  /** The accepted document as exportKitchenCsv writes it. */
  csv: string;
  /** Observation rows, for the restore offer. */
  rows: number;
}>;

const KITCHEN_MIGRATION_CHAIN: MigrationChain = createMigrationChain(1, {});

/** The kept observations, or undefined when none are kept or the stored copy cannot be read. */
export function readKeptKitchen(ctx: StorageContext): KeptKitchenObservations | undefined {
  const result = readDocument<KeptKitchenObservations>(
    ctx,
    KITCHEN_STORAGE_NAMESPACE,
    KITCHEN_MIGRATION_CHAIN,
  );
  const value = result.status === "ok" ? result.value : undefined;
  return value && typeof value.csv === "string" && Number.isInteger(value.rows) ? value : undefined;
}

export function keepKitchen(ctx: StorageContext, csv: string, rows: number): WriteResult {
  return writeDocument(ctx, KITCHEN_STORAGE_NAMESPACE, { schemaVersion: 1, csv, rows });
}

export function removeKeptKitchen(ctx: StorageContext): void {
  removeRaw(ctx, KITCHEN_STORAGE_NAMESPACE);
}
