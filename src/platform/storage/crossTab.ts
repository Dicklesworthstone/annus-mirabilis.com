/**
 * Cross-tab synchronization: a settings change in one tab must update the others without a
 * reload. The browser's native `storage` event already fires only in *other* tabs (never the
 * tab that made the write), so this module is a thin, typed, injectable-target wrapper rather
 * than new signaling machinery.
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
