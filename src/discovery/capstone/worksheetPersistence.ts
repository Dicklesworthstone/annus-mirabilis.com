import { CAPSTONE_WORKSHEET_KEYS } from "../../platform/storage/keys.ts";
import { createStorageContext, type StorageContext, writeRaw } from "../../platform/storage/store.ts";
import type { WorksheetStorage } from "./worksheetStore.ts";

/** The global registry makes these private documents visible to site-wide export and clear. */
export function createBrowserWorksheetStorage(
  paper: string,
  context: StorageContext = createStorageContext(),
): WorksheetStorage {
  const key = Object.hasOwn(CAPSTONE_WORKSHEET_KEYS, paper)
    ? CAPSTONE_WORKSHEET_KEYS[paper as keyof typeof CAPSTONE_WORKSHEET_KEYS] : undefined;
  const registration = key ? context.registry.get(key) : undefined;
  if (!key || registration?.kind !== "document" || registration.ownerBeadId !== "am-disc-capstones-infra-3352")
    return { read: () => ({ status: "unavailable" }), write: () => "unavailable", remove: () => "unavailable" };
  return {
    read() {
      const backend = context.backend();
      if (!backend) return { status: "unavailable" };
      try {
        // A real deletion must not be hidden by a session fallback, or old work could reappear.
        const raw = backend.getItem(key);
        return raw === null ? { status: "missing" } : { status: "ok", raw };
      } catch { return { status: "unavailable" }; }
    },
    write(raw) {
      if ((key.length + raw.length) * 2 > registration.maxBytes) return "quota";
      const result = writeRaw(context, key, raw);
      return result.status === "ok" ? "saved" : result.status === "quota" ? "quota" : "unavailable";
    },
    remove() {
      context.fallback.delete(key);
      const backend = context.backend();
      if (!backend) return "unavailable";
      try {
        backend.removeItem(key);
        return backend.getItem(key) === null ? "removed" : "unavailable";
      } catch { return "unavailable"; }
    },
  };
}
