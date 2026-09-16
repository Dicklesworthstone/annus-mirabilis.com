import { describe, expect, test } from "bun:test";
import { createKeyRegistry, type DocumentRegistration } from "./keys.ts";
import {
  clearQuarantine,
  isQuarantineFull,
  listQuarantine,
  QUARANTINE_KEY,
  QUARANTINE_MAX_ENTRIES,
  quarantine,
} from "./quarantine.ts";
import { createStorageContext } from "./store.ts";
import { InMemoryStorage } from "./testSupport.ts";

const QUARANTINE_REGISTRATION: DocumentRegistration = {
  key: QUARANTINE_KEY,
  kind: "document",
  ownerBeadId: "am-plat-local-storage-km8f",
  exportable: true,
  clearable: true,
  maxBytes: 128_000,
  schemaVersion: 1,
  label: "Recovered (quarantined) data",
};

function context() {
  const storage = new InMemoryStorage();
  return createStorageContext({
    registry: createKeyRegistry([QUARANTINE_REGISTRATION]),
    getStorage: () => storage,
  });
}

describe("quarantine", () => {
  test("preserves the original key, raw value, and reason", () => {
    const ctx = context();
    const outcome = quarantine(ctx, "am:notebook:v1", "{not json", "invalid-json");
    expect(outcome).toEqual({ quarantined: true, full: false });
    const entries = listQuarantine(ctx);
    expect(entries.length).toBe(1);
    const [entry] = entries;
    expect(entry?.originalKey).toBe("am:notebook:v1");
    expect(entry?.rawValue).toBe("{not json");
    expect(entry?.reason).toBe("invalid-json");
    expect(typeof entry?.quarantinedAt).toBe("string");
  });

  test("accumulates multiple entries across calls", () => {
    const ctx = context();
    quarantine(ctx, "a", "raw-a", "reason-a");
    quarantine(ctx, "b", "raw-b", "reason-b");
    expect(listQuarantine(ctx).map((e) => e.originalKey)).toEqual(["a", "b"]);
  });

  test("a full quarantine reports full and never discards or overwrites an existing entry", () => {
    const ctx = context();
    for (let i = 0; i < QUARANTINE_MAX_ENTRIES; i++) {
      expect(quarantine(ctx, `key-${i}`, `raw-${i}`, "reason")).toEqual({
        quarantined: true,
        full: false,
      });
    }
    expect(isQuarantineFull(ctx)).toBe(true);
    const beforeOverflow = listQuarantine(ctx);
    expect(quarantine(ctx, "one-too-many", "raw", "reason")).toEqual({
      quarantined: false,
      full: true,
    });
    expect(listQuarantine(ctx)).toEqual(beforeOverflow);
  });

  test("clearQuarantine empties the entry list", () => {
    const ctx = context();
    quarantine(ctx, "a", "raw-a", "reason-a");
    clearQuarantine(ctx);
    expect(listQuarantine(ctx)).toEqual([]);
    expect(isQuarantineFull(ctx)).toBe(false);
  });

  test("a corrupted quarantine document itself is treated as empty rather than throwing", () => {
    const storage = new InMemoryStorage();
    storage.rawSet(QUARANTINE_KEY, "{not json at all");
    const ctx = createStorageContext({
      registry: createKeyRegistry([QUARANTINE_REGISTRATION]),
      getStorage: () => storage,
    });
    expect(listQuarantine(ctx)).toEqual([]);
  });
});
