/**
 * Keeps one discovery investigation per paper on the reader's own device, and reads it back.
 *
 * Specification: am-rc1001-bridge-plan-pcjk.27, plan 6.8 and 14.5 ("the earlier prediction is
 * preserved locally so the changed understanding is visible without scoring").
 *
 * The split with `core.ts` is deliberate and is the reason this file exists at all: core's own
 * docblock says "no DOM, React, storage, clocks, network, or replay execution lives on this path",
 * so the store stays a pure state machine and every byte that touches `localStorage` is here.
 * Core owns admitting a report (`parseInvestigationReport`); this owns where it is kept.
 *
 * Nothing is uploaded, and nothing is written without the reader pressing a button first: the
 * writes follow `begin`, `capture` and `explain`.
 */

import { INVESTIGATION_KEYS } from "../../platform/storage/keys.ts";
import {
  createMigrationChain,
  type MigrationChain,
  migrateDocument,
  UnmigratableVersionError,
} from "../../platform/storage/migrations.ts";
import { quarantine } from "../../platform/storage/quarantine.ts";
import {
  createStorageContext,
  readRaw,
  removeRaw,
  type StorageContext,
  writeRaw,
} from "../../platform/storage/store.ts";
import {
  InvestigationRefusalError,
  type InvestigationReport,
  parseInvestigationReport,
} from "./core.ts";

/** The bead that owns this key family in `src/platform/storage/keys.ts`. */
export const INVESTIGATION_KEY_OWNER = "am-rc1001-bridge-plan-pcjk.27";

export interface StoredInvestigationDocument {
  readonly schemaVersion: 1;
  readonly report: InvestigationReport;
}

export const INVESTIGATION_MIGRATION_CHAIN: MigrationChain = createMigrationChain(1, {});

export type InvestigationReadStatus = "ok" | "missing" | "unavailable" | "unreadable";
export type InvestigationRead = Readonly<{
  status: InvestigationReadStatus;
  report?: InvestigationReport;
}>;
export type InvestigationSaveStatus = "saved" | "unavailable" | "quota" | "unregistered";

/**
 * The registered key for a paper, or `undefined`. The owner check is not ceremony: it is what
 * makes a key family moved to another bead fail here rather than write into someone else's
 * namespace, which is the one-owner-per-key rule the registry exists to keep.
 */
export function investigationKey(paper: string, ctx: StorageContext): string | undefined {
  if (!Object.hasOwn(INVESTIGATION_KEYS, paper)) return undefined;
  const key = INVESTIGATION_KEYS[paper as keyof typeof INVESTIGATION_KEYS];
  const registration = ctx.registry.get(key);
  if (registration?.kind !== "document" || registration.ownerBeadId !== INVESTIGATION_KEY_OWNER)
    return undefined;
  return key;
}

/**
 * Reads the kept investigation. Bytes this edition cannot read are moved to `am:quarantine:v1`
 * with the refusal that rejected them, never discarded, and only then removed from their own key
 * so a returning reader is not quarantining the same bytes on every visit. When quarantine is
 * full the original stays exactly where it is.
 */
export function readStoredInvestigation(
  paper: string,
  ctx: StorageContext = createStorageContext(),
): InvestigationRead {
  const key = investigationKey(paper, ctx);
  if (!key) return { status: "unavailable" };
  const raw = readRaw(ctx, key);
  if (raw.status !== "ok" || raw.value === undefined)
    return { status: raw.status === "missing" ? "missing" : "unavailable" };
  const setAside = (reason: string): InvestigationRead => {
    if (quarantine(ctx, key, raw.value as string, reason).quarantined) removeRaw(ctx, key);
    return { status: "unreadable" };
  };
  let document: StoredInvestigationDocument;
  try {
    document = migrateDocument<StoredInvestigationDocument>(
      INVESTIGATION_MIGRATION_CHAIN,
      JSON.parse(raw.value),
    );
  } catch (error) {
    return setAside(
      error instanceof UnmigratableVersionError ? error.message : "investigation-invalid-json",
    );
  }
  try {
    return { status: "ok", report: parseInvestigationReport(document.report) };
  } catch (error) {
    return setAside(
      error instanceof InvestigationRefusalError ? error.code : "investigation-report-unreadable",
    );
  }
}

/**
 * Keeps the investigation. A report larger than the key's registered budget is refused as `quota`
 * rather than written and truncated, because the reader's copy in the page and the download are
 * still whole and the workspace says so.
 */
export function saveStoredInvestigation(
  paper: string,
  report: InvestigationReport,
  ctx: StorageContext = createStorageContext(),
): InvestigationSaveStatus {
  const key = investigationKey(paper, ctx);
  const registration = key ? ctx.registry.get(key) : undefined;
  if (!key || registration?.kind !== "document") return "unregistered";
  const raw = JSON.stringify({ schemaVersion: 1, report } satisfies StoredInvestigationDocument);
  // UTF-16 code units, which is how browsers actually charge localStorage quota (storage/size.ts).
  if ((key.length + raw.length) * 2 > registration.maxBytes) return "quota";
  const result = writeRaw(ctx, key, raw);
  if (result.status === "ok") return "saved";
  return result.status === "quota" || result.status === "unregistered"
    ? result.status
    : "unavailable";
}

/** Forgets the kept investigation, for the reader's own explicit "start another". */
export function clearStoredInvestigation(
  paper: string,
  ctx: StorageContext = createStorageContext(),
): void {
  const key = investigationKey(paper, ctx);
  if (key) removeRaw(ctx, key);
}
