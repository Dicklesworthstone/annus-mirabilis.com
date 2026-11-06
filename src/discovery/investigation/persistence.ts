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
import { QUARANTINE_KEY, quarantine } from "../../platform/storage/quarantine.ts";
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

type DurableInvestigation =
  | Readonly<{ status: "ok"; raw: string | null }>
  | Readonly<{ status: "unavailable" }>;
type InvestigationOpening = Readonly<{
  read: InvestigationRead;
  /** undefined means storage could not be read, not that the saved copy was absent. */
  raw: string | null | undefined;
  protected: boolean;
}>;
export type InvestigationWriteGuard = "current" | "conflict" | "protected" | "unavailable";
export type InvestigationKeepResult = InvestigationSaveStatus | "conflict" | "protected";
export type InvestigationClearResult =
  | Exclude<InvestigationKeepResult, "saved" | "quota">
  | "cleared"
  | "session-only";

/** Compare durable bytes, never writeRaw's session fallback after a failed save. */
function readDurableInvestigation(ctx: StorageContext, key: string): DurableInvestigation {
  const storage = ctx.backend();
  try {
    return storage ? { status: "ok", raw: storage.getItem(key) } : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

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
  return openInvestigation(paper, ctx).read;
}

function openInvestigation(paper: string, ctx: StorageContext): InvestigationOpening {
  const key = investigationKey(paper, ctx);
  if (!key) return { read: { status: "unavailable" }, raw: undefined, protected: false };
  const raw = readRaw(ctx, key);
  if (raw.status !== "ok" || raw.value === undefined)
    return {
      read: { status: raw.status === "missing" ? "missing" : "unavailable" },
      raw: raw.status === "missing" ? null : undefined,
      protected: false,
    };
  const setAside = (reason: string): InvestigationOpening => {
    const result = quarantine(ctx, key, raw.value as string, reason);
    // A failed quarantine write can keep its copy only in the session fallback. Do not remove
    // the durable original until the replacement has actually reached browser storage, and do
    // not remove a newer report another tab wrote while the old bytes were being preserved.
    if (result.quarantined && !ctx.fallback.has(QUARANTINE_KEY)) {
      const saved = readDurableInvestigation(ctx, key);
      if (saved.status === "ok" && saved.raw === raw.value) {
        removeRaw(ctx, key);
        const after = readDurableInvestigation(ctx, key);
        if (after.status === "ok" && after.raw === null)
          return { read: { status: "unreadable" }, raw: null, protected: false };
      }
    }
    return { read: { status: "unreadable" }, raw: raw.value, protected: true };
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
    return {
      read: { status: "ok", report: parseInvestigationReport(document.report) },
      raw: raw.value,
      protected: false,
    };
  } catch (error) {
    return setAside(
      error instanceof InvestigationRefusalError ? error.code : "investigation-report-unreadable",
    );
  }
}

/**
 * Keeps the investigation. A report larger than the key's registered budget is refused as `quota`
 * rather than written and truncated, because the reader's copy in the page and the download are
 * still whole and the workspace says so. Live writers use createInvestigationPersistence to
 * compare the saved copy before calling this write primitive.
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

/** Clear primitive; the mounted writer compares saved bytes before the explicit "start another". */
export function clearStoredInvestigation(
  paper: string,
  ctx: StorageContext = createStorageContext(),
): "cleared" | "unavailable" | "unregistered" {
  const key = investigationKey(paper, ctx);
  if (!key) return "unregistered";
  removeRaw(ctx, key);
  const after = readDurableInvestigation(ctx, key);
  return after.status === "ok" && after.raw === null ? "cleared" : "unavailable";
}

/**
 * One writer for one mounted investigation. Each mutation compares the saved bytes with the
 * copy this writer opened or last saved. A conflict keeps both versions: the other tab's durable
 * report and this tab's report in the pure store, which remains downloadable. A failed save
 * never advances the comparison, and unreadable originals stay protected if quarantine failed.
 *
 * This is an optimistic comparison, not an atomic cross-tab transaction. It also runs at the
 * action itself, since a storage event may not have reached a background tab yet.
 */
export function createInvestigationPersistence(
  paper: string,
  ctx: StorageContext = createStorageContext(),
) {
  const opened = openInvestigation(paper, ctx);
  const key = investigationKey(paper, ctx);
  let expectedRaw = opened.raw;
  let protectedOriginal = opened.protected;
  let conflict = false;

  function check(): InvestigationWriteGuard {
    if (protectedOriginal) return "protected";
    if (conflict) return "conflict";
    if (!key) return "unavailable";
    const saved = readDurableInvestigation(ctx, key);
    if (saved.status !== "ok") return "unavailable";
    // If storage was blocked on arrival, an empty store is safe to populate. Existing data is
    // not ours to overwrite merely because we could not see it when this page opened.
    if (saved.raw !== expectedRaw && !(expectedRaw === undefined && saved.raw === null)) {
      conflict = true;
      return "conflict";
    }
    return "current";
  }

  return Object.freeze({
    key,
    initial: opened.read,
    check,
    /** A valid report for a different task must not be overwritten after restore refuses it. */
    protectOriginal() {
      protectedOriginal = true;
    },
    save(report: InvestigationReport): InvestigationKeepResult {
      const guard = check();
      if (guard !== "current") return guard;
      const outcome = saveStoredInvestigation(paper, report, ctx);
      if (outcome === "saved")
        expectedRaw = JSON.stringify({
          schemaVersion: 1,
          report,
        } satisfies StoredInvestigationDocument);
      return outcome;
    },
    clear(): InvestigationClearResult {
      const guard = check();
      if (guard === "unavailable" && expectedRaw === undefined && key) {
        // Nothing has ever been kept by this writer. The reader can explicitly start another
        // local investigation while storage stays blocked, without touching an unseen original.
        ctx.fallback.delete(key);
        return "session-only";
      }
      if (guard !== "current") return guard;
      const outcome = clearStoredInvestigation(paper, ctx);
      if (outcome === "cleared") expectedRaw = null;
      return outcome;
    },
  });
}
