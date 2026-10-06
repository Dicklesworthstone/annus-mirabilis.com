import type { Capstone } from "./capstoneSchema.ts";
import { emptyWorksheet, readWorksheet, WORKSHEET_LIMITS, type WorksheetState, worksheetMatches } from "./worksheetState.ts";

export type WorksheetRead = Readonly<{ status: "ok"; raw: string } | { status: "missing" | "unavailable" }>;
export interface WorksheetStorage {
  read(): WorksheetRead;
  write(raw: string): "saved" | "unavailable" | "quota";
  remove(): "removed" | "unavailable";
}
export type WorksheetPersistence = "unopened" | "saved" | "session-only" | "protected" | "conflict";
export type WorksheetSnapshot = Readonly<{
  worksheet: WorksheetState;
  persistence: WorksheetPersistence;
  message: string;
  recoveryRaw: string | null;
}>;
const SESSION = "Your work is available in this tab, but could not be saved on this device. Export it before leaving.";
const PROTECTED = "The saved worksheet is from another version or cannot be read. It is preserved. New work stays in this tab; export it before leaving.";
const CONFLICT = "The saved worksheet changed elsewhere or was cleared. This tab's work is retained without overwriting it. Export this tab before loading the saved worksheet.";

type Definition = Pick<Capstone, "id" | "startOrder" | "claims" | "assumptions">;

/**
 * One capstone's private work. Reads never write. Optimistic saved-byte comparison is not an atomic
 * cross-tab lock: it prevents known stale writes, not two simultaneous writes between the checks.
 */
export function createWorksheetStore(capstone: Definition, storage: WorksheetStorage) {
  let snapshot: WorksheetSnapshot = { worksheet: emptyWorksheet(capstone), persistence: "unopened", message: "", recoveryRaw: null };
  let baseRaw: string | null = null;
  let baseKnown = false;
  const listeners = new Set<() => void>();
  function publish(next: WorksheetSnapshot) {
    snapshot = Object.freeze(next);
    for (const listener of listeners) {
      try { listener(); } catch { /* A detached view cannot interrupt storage or another view. */ }
    }
  }
  function read(): WorksheetRead {
    try { return storage.read(); } catch { return { status: "unavailable" }; }
  }
  function admit(raw: string): WorksheetState | null {
    if (raw.length > WORKSHEET_LIMITS.bytes) return null;
    try {
      const value = readWorksheet(JSON.parse(raw));
      return value && worksheetMatches(value, capstone) ? value : null;
    } catch { return null; }
  }
  function open() {
    if (snapshot.persistence !== "unopened") return;
    const saved = read();
    if (saved.status === "unavailable") {
      publish({ ...snapshot, persistence: "session-only", message: SESSION });
      return;
    }
    baseKnown = true;
    baseRaw = saved.status === "ok" ? saved.raw : null;
    const worksheet = saved.status === "ok" ? admit(saved.raw) : emptyWorksheet(capstone);
    if (!worksheet) {
      publish({ ...snapshot, persistence: "protected", message: PROTECTED, recoveryRaw: baseRaw });
      return;
    }
    publish({ worksheet, persistence: "saved", message: "Changes stay on this device. Export important work as a backup.", recoveryRaw: null });
  }
  function save(worksheet: WorksheetState) {
    if (snapshot.persistence === "protected" || snapshot.persistence === "conflict") {
      publish({ ...snapshot, worksheet });
      return;
    }
    const saved = read();
    if (saved.status === "unavailable") {
      publish({ ...snapshot, worksheet, persistence: "session-only", message: SESSION });
      return;
    }
    const raw = saved.status === "ok" ? saved.raw : null;
    if ((!baseKnown && raw !== null) || (baseKnown && raw !== baseRaw)) {
      publish({ ...snapshot, worksheet, persistence: "conflict", message: CONFLICT, recoveryRaw: raw });
      return;
    }
    baseKnown = true;
    baseRaw = raw;
    const encoded = JSON.stringify(worksheet);
    let outcome: ReturnType<WorksheetStorage["write"]>;
    try { outcome = storage.write(encoded); } catch { outcome = "unavailable"; }
    if (outcome === "saved") baseRaw = encoded;
    publish({ worksheet, persistence: outcome === "saved" ? "saved" : "session-only", message: outcome === "saved" ? "Saved on this device. Export important work as a backup." : SESSION, recoveryRaw: null });
  }
  return Object.freeze({
    open,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    edit(input: WorksheetState): boolean {
      open();
      const worksheet = readWorksheet(input);
      if (!worksheet || !worksheetMatches(worksheet, capstone)) {
        publish({ ...snapshot, message: "That change is too large or incompatible with this capstone. Your previous work is unchanged." });
        return false;
      }
      save(worksheet);
      return true;
    },
    retry() { open(); save(snapshot.worksheet); },
    checkForExternalChange() {
      if (snapshot.persistence === "unopened" || snapshot.persistence === "protected" || snapshot.persistence === "conflict") return;
      const saved = read();
      if (saved.status === "unavailable") return;
      const raw = saved.status === "ok" ? saved.raw : null;
      if ((!baseKnown && raw !== null) || (baseKnown && raw !== baseRaw))
        publish({ ...snapshot, persistence: "conflict", message: CONFLICT, recoveryRaw: raw });
    },
    /** Consent applies only to the saved bytes this tab has seen, never a newly changed document. */
    clearConfirmed(): boolean {
      open();
      const saved = read();
      const raw = saved.status === "ok" ? saved.raw : null;
      if (snapshot.persistence === "conflict" ||
        (saved.status !== "unavailable" && ((!baseKnown && raw !== null) || (baseKnown && raw !== baseRaw)))) {
        publish({ ...snapshot, persistence: "conflict", message: CONFLICT, recoveryRaw: raw });
        return false;
      }
      let removed = false;
      if (saved.status !== "unavailable") {
        try { removed = storage.remove() === "removed"; } catch { /* Keep the saved original and say that clearing failed. */ }
      }
      if (removed) { baseKnown = true; baseRaw = null; }
      publish({
        worksheet: emptyWorksheet(capstone),
        persistence: removed ? "saved" : snapshot.persistence === "protected" ? "protected" : "session-only",
        message: removed ? "This worksheet was cleared. Other capstones are unchanged." : "This tab's worksheet is empty, but the saved copy could not be cleared. It may reappear after reload. Retry clearing when storage is available.",
        recoveryRaw: removed ? null : snapshot.recoveryRaw,
      });
      return true;
    },
    /** An explicit replacement. An unreadable/unavailable saved copy never erases the draft. */
    reloadConfirmed(): boolean {
      open();
      const saved = read();
      const worksheet = saved.status === "missing" ? emptyWorksheet(capstone) : saved.status === "ok" ? admit(saved.raw) : null;
      if (!worksheet) {
        publish({ ...snapshot, message: "The saved worksheet cannot be loaded. This tab's work is unchanged; export it or try again." });
        return false;
      }
      baseKnown = true;
      baseRaw = saved.status === "ok" ? saved.raw : null;
      publish({ worksheet, persistence: "saved", message: "Loaded the saved worksheet. Export important work as a backup.", recoveryRaw: null });
      return true;
    },
  });
}
export type WorksheetStore = ReturnType<typeof createWorksheetStore>;
