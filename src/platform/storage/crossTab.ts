/**
 * Cross-tab synchronization: a settings change in one tab must update the others without a
 * reload. The browser's native `storage` event already fires only in *other* tabs (never the
 * tab that made the write), so this module is a thin, typed, injectable-target wrapper rather
 * than new signaling machinery.
 *
 * NO PRODUCTION CALLER, AND DELEGATING THE TWO LIVE SITES TO IT WOULD MAKE BOTH WORSE
 * (am-50bk triage, 2026-10-24). Two modules listen for `storage` themselves, and neither wants
 * what this offers:
 *
 *   `src/discovery/capstone/CapstoneWorksheet.tsx` registers `storage` as one of THREE equal
 *   triggers beside `pageshow` and `focus`, and ignores the event payload entirely -- it calls
 *   `checkForExternalChange()` and re-reads the store. A typed `CrossTabChange` is of no use to a
 *   listener that does not look at the key.
 *
 *   `src/reader/notebook/browser.ts` registers `storage` among a dozen window and element
 *   listeners under one teardown closure. Routing one of them through a separate unsubscribe
 *   function would split a coherent lifecycle for no gain.
 *
 * So this is not the `alignmentHighlight.ts` case, where an island reimplemented a pure module's
 * logic and the duplication was real. Here the wrapper's value is the filtered, typed payload, and
 * the payload is the part nobody needs. Wiring it would be forcing a fit. If a third site appears
 * that does care which key changed, this is the module for it, already tested.
 */

export interface CrossTabChange {
  readonly key: string;
  readonly newValue: string | null;
  readonly oldValue: string | null;
}

export interface CrossTabEventTarget {
  addEventListener(type: "storage", listener: (event: StorageEvent) => void): void;
  removeEventListener(type: "storage", listener: (event: StorageEvent) => void): void;
}

/**
 * Subscribes to native `storage` events and returns an unsubscribe function. `event.key === null`
 * signals a whole-storage `clear()` from another tab rather than one key changing, and is not
 * forwarded as a `CrossTabChange` (callers that care about a full clear can pass their own
 * target and inspect the raw event themselves).
 */
export function subscribeCrossTab(
  listener: (change: CrossTabChange) => void,
  target: CrossTabEventTarget,
): () => void {
  function handleStorageEvent(event: StorageEvent): void {
    if (event.key === null) return;
    listener({ key: event.key, newValue: event.newValue, oldValue: event.oldValue });
  }
  target.addEventListener("storage", handleStorageEvent);
  return () => target.removeEventListener("storage", handleStorageEvent);
}
