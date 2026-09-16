import { describe, expect, test } from "bun:test";
import { createKeyRegistry, type DocumentRegistration, type SettingRegistration } from "./keys.ts";
import { estimateBytes, estimateNamespaceSize, estimateTotalSize } from "./size.ts";
import { createStorageContext, writeRaw } from "./store.ts";
import { InMemoryStorage } from "./testSupport.ts";

const SMALL_LIMIT_SETTING: SettingRegistration = {
  key: "am:settings:v1:fixture",
  kind: "setting",
  ownerBeadId: "am-fixture-bead",
  exportable: true,
  clearable: true,
  maxBytes: 10,
  schemaVersion: 1,
  label: "Fixture",
  prePaint: false,
  allowedValues: ["short", "a-much-longer-value-than-ten-bytes"],
  defaultValue: "short",
};

const DOCUMENT: DocumentRegistration = {
  key: "am:fixture-doc:v1",
  kind: "document",
  ownerBeadId: "am-fixture-bead",
  exportable: true,
  clearable: true,
  maxBytes: 1000,
  schemaVersion: 1,
  label: "Fixture document",
};

describe("estimateBytes", () => {
  test("is UTF-16 code units times two for the key plus the value", () => {
    expect(estimateBytes("ab", "cd")).toBe((2 + 2) * 2);
    expect(estimateBytes("", "")).toBe(0);
  });
});

describe("estimateNamespaceSize", () => {
  test("reports zero bytes for a namespace with nothing stored", () => {
    const registry = createKeyRegistry([SMALL_LIMIT_SETTING]);
    const ctx = createStorageContext({ registry, getStorage: () => new InMemoryStorage() });
    expect(estimateNamespaceSize(ctx, SMALL_LIMIT_SETTING.key)).toEqual({
      namespace: SMALL_LIMIT_SETTING.key,
      bytes: 0,
      maxBytes: 10,
      overLimit: false,
    });
  });

  test("flags overLimit once the stored value exceeds maxBytes", () => {
    const registry = createKeyRegistry([SMALL_LIMIT_SETTING]);
    const storage = new InMemoryStorage();
    const ctx = createStorageContext({ registry, getStorage: () => storage });
    writeRaw(ctx, SMALL_LIMIT_SETTING.key, "a-much-longer-value-than-ten-bytes");
    const size = estimateNamespaceSize(ctx, SMALL_LIMIT_SETTING.key);
    expect(size.overLimit).toBe(true);
    expect(size.bytes).toBe(
      estimateBytes(SMALL_LIMIT_SETTING.key, "a-much-longer-value-than-ten-bytes"),
    );
  });

  test("throws for an unregistered namespace", () => {
    const registry = createKeyRegistry([SMALL_LIMIT_SETTING]);
    const ctx = createStorageContext({ registry, getStorage: () => new InMemoryStorage() });
    expect(() => estimateNamespaceSize(ctx, "am:not-registered")).toThrow();
  });
});

describe("estimateTotalSize", () => {
  test("returns one entry per registered namespace", () => {
    const registry = createKeyRegistry([SMALL_LIMIT_SETTING, DOCUMENT]);
    const ctx = createStorageContext({ registry, getStorage: () => new InMemoryStorage() });
    const sizes = estimateTotalSize(ctx);
    expect(sizes.map((s) => s.namespace).sort()).toEqual(
      [DOCUMENT.key, SMALL_LIMIT_SETTING.key].sort(),
    );
  });
});
