import { describe, expect, test } from "bun:test";
import {
  KITCHEN_STORAGE_NAMESPACE,
  keepKitchen,
  readKeptKitchen,
  removeKeptKitchen,
} from "../experiments/bm07/kitchen/kitchenStorage.ts";
import { storageKeyRegistry } from "../platform/storage/keys.ts";
import { createStorageContext } from "../platform/storage/store.ts";
import { InMemoryStorage, quotaExceededError } from "../platform/storage/testSupport.ts";

/**
 * am-bm-07-kitchen-mode-mays, criterion 7: kept kitchen observations go to the registered
 * am:kitchen:v1 document, exportable and clearable, and only when the reader asks (dbcd3777).
 */
describe("kitchen observations kept on this device", () => {
  const csv = "schema_version,kind,object_id\n2,particle,p1\n";

  test("am:kitchen:v1 is a registered, exportable, clearable document owned by the kitchen bead", () => {
    const entry = storageKeyRegistry.get(KITCHEN_STORAGE_NAMESPACE);
    expect(entry?.kind).toBe("document");
    expect(entry?.ownerBeadId).toBe("am-bm-07-kitchen-mode-mays");
    if (entry?.kind !== "document") throw new TypeError("am:kitchen:v1 must be a document");
    expect(entry.exportable).toBe(true);
    expect(entry.clearable).toBe(true);
    expect(entry.maxBytes).toBeGreaterThanOrEqual(2 * 1024 * 1024);
    expect(entry.label).toContain("never video");
  });

  test("keep, read back, and remove round-trip the CSV and its row count", () => {
    const storage = new InMemoryStorage();
    const ctx = createStorageContext({ getStorage: () => storage });
    expect(readKeptKitchen(ctx)).toBeUndefined();
    expect(keepKitchen(ctx, csv, 1).status).toBe("ok");
    expect(storage.getItem(KITCHEN_STORAGE_NAMESPACE)).toContain("particle");
    expect(readKeptKitchen(ctx)).toEqual({ schemaVersion: 1, csv, rows: 1 });
    removeKeptKitchen(ctx);
    expect(readKeptKitchen(ctx)).toBeUndefined();
    expect(storage.getItem(KITCHEN_STORAGE_NAMESPACE)).toBeNull();
  });

  test("a full store reports quota and keeps nothing; a malformed copy reads as nothing kept", () => {
    const full = new InMemoryStorage({ throwOnSet: quotaExceededError() });
    const ctx = createStorageContext({ getStorage: () => full });
    expect(keepKitchen(ctx, csv, 1).status).toBe("quota");
    const odd = new InMemoryStorage();
    odd.setItem(
      KITCHEN_STORAGE_NAMESPACE,
      JSON.stringify({ schemaVersion: 1, csv: 42, rows: "x" }),
    );
    expect(readKeptKitchen(createStorageContext({ getStorage: () => odd }))).toBeUndefined();
  });
});
