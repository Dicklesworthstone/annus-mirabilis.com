import { describe, expect, test } from "bun:test";
import {
  createKeyRegistry,
  type DocumentRegistration,
  SETTINGS_KEY_PREFIX,
  type SettingRegistration,
} from "./keys.ts";
import { createMigrationChain } from "./migrations.ts";
import {
  createStorageContext,
  readDocument,
  readRaw,
  readSetting,
  writeDocument,
  writeRaw,
  writeSetting,
} from "./store.ts";
import { InMemoryStorage, quotaExceededError } from "./testSupport.ts";

const FIXTURE_SETTING: SettingRegistration = {
  key: `${SETTINGS_KEY_PREFIX}fixture`,
  kind: "setting",
  ownerBeadId: "am-fixture-bead",
  exportable: true,
  clearable: true,
  maxBytes: 64,
  schemaVersion: 1,
  label: "Fixture setting",
  prePaint: false,
  allowedValues: ["a", "b", "c"],
  defaultValue: "a",
};

const FIXTURE_DOCUMENT: DocumentRegistration = {
  key: "am:fixture-doc:v1",
  kind: "document",
  ownerBeadId: "am-fixture-bead",
  exportable: true,
  clearable: true,
  maxBytes: 4096,
  schemaVersion: 1,
  label: "Fixture document",
};

const QUARANTINE_REGISTRATION: DocumentRegistration = {
  key: "am:quarantine:v1",
  kind: "document",
  ownerBeadId: "am-plat-local-storage-km8f",
  exportable: true,
  clearable: true,
  maxBytes: 128_000,
  schemaVersion: 1,
  label: "Recovered (quarantined) data",
};

const registry = createKeyRegistry([FIXTURE_SETTING, FIXTURE_DOCUMENT, QUARANTINE_REGISTRATION]);

function contextWith(storage: Storage) {
  return createStorageContext({ registry, getStorage: () => storage });
}

describe("readRaw / writeRaw with working storage", () => {
  test("writes then reads back the same value", () => {
    const ctx = contextWith(new InMemoryStorage());
    expect(writeRaw(ctx, FIXTURE_SETTING.key, "hello")).toEqual({ status: "ok" });
    expect(readRaw(ctx, FIXTURE_SETTING.key)).toEqual({ status: "ok", value: "hello" });
  });

  test("reading a key that was never written reports missing", () => {
    const ctx = contextWith(new InMemoryStorage());
    expect(readRaw(ctx, FIXTURE_SETTING.key)).toEqual({ status: "missing" });
  });
});

describe("failure injection: a throwing accessor, a throwing getter, and quota on write", () => {
  test("a storage accessor that throws on any access reports unavailable on read and write, using the session fallback", () => {
    const ctx = contextWith(
      new InMemoryStorage({ throwOnAnyAccess: new Error("blocked: private mode") }),
    );
    expect(writeRaw(ctx, FIXTURE_SETTING.key, "hello")).toEqual({ status: "unavailable" });
    // The session fallback still answers the read even though real storage is unreachable.
    expect(readRaw(ctx, FIXTURE_SETTING.key)).toEqual({ status: "ok", value: "hello" });
  });

  test("a getter that throws reports unavailable on read", () => {
    const storage = new InMemoryStorage({ throwOnGet: new Error("getItem is blocked") });
    const ctx = contextWith(storage);
    expect(readRaw(ctx, FIXTURE_SETTING.key)).toEqual({ status: "unavailable" });
  });

  test("a QuotaExceededError on write reports quota and keeps the value in the session fallback", () => {
    const storage = new InMemoryStorage({ throwOnSet: quotaExceededError() });
    const ctx = contextWith(storage);
    expect(writeRaw(ctx, FIXTURE_SETTING.key, "over quota")).toEqual({ status: "quota" });
    expect(readRaw(ctx, FIXTURE_SETTING.key)).toEqual({ status: "ok", value: "over quota" });
  });

  test("session fallback keeps a setting for the visit when storage is blocked for the whole session", () => {
    const ctx = contextWith(new InMemoryStorage({ throwOnAnyAccess: new Error("blocked") }));
    // The write itself reports "unavailable" (real storage never received it)...
    expect(writeSetting(ctx, FIXTURE_SETTING.key, "b")).toEqual({ status: "unavailable" });
    // ...but the setting still reads back "b" for the rest of this session, from the in-memory fallback.
    expect(readSetting(ctx, FIXTURE_SETTING.key)).toEqual({ status: "ok", value: "b" });
  });

  test("with no prior write and storage blocked for the whole session, a setting reads as its default", () => {
    const ctx = contextWith(new InMemoryStorage({ throwOnAnyAccess: new Error("blocked") }));
    expect(readSetting(ctx, FIXTURE_SETTING.key)).toEqual({
      status: "unavailable",
      value: FIXTURE_SETTING.defaultValue,
    });
  });
});

/** Next.js types `NODE_ENV` as a readonly literal; a mutable view lets tests toggle it and restore it. */
const mutableEnv = process.env as Record<string, string | undefined>;

describe("unregistered keys", () => {
  test("a write to an unregistered key throws outside production", () => {
    const ctx = contextWith(new InMemoryStorage());
    const originalEnv = mutableEnv.NODE_ENV;
    mutableEnv.NODE_ENV = "test";
    try {
      expect(() => writeRaw(ctx, "am:not-registered", "x")).toThrow(/not registered/);
    } finally {
      mutableEnv.NODE_ENV = originalEnv;
    }
  });

  test("a write to an unregistered key is refused (never throws) in production", () => {
    const ctx = contextWith(new InMemoryStorage());
    const originalEnv = mutableEnv.NODE_ENV;
    mutableEnv.NODE_ENV = "production";
    try {
      expect(writeRaw(ctx, "am:not-registered", "x")).toEqual({ status: "unregistered" });
    } finally {
      mutableEnv.NODE_ENV = originalEnv;
    }
  });
});

describe("readSetting / writeSetting", () => {
  test("a stored value outside the allowed set reads as corrupt and falls back to the default", () => {
    const storage = new InMemoryStorage();
    storage.rawSet(FIXTURE_SETTING.key, "not-an-allowed-value");
    const ctx = contextWith(storage);
    expect(readSetting(ctx, FIXTURE_SETTING.key)).toEqual({ status: "corrupt", value: "a" });
  });

  test("writeSetting rejects a value outside the allowed set without touching storage", () => {
    const storage = new InMemoryStorage();
    const ctx = contextWith(storage);
    expect(() => writeSetting(ctx, FIXTURE_SETTING.key, "not-allowed")).toThrow(TypeError);
    expect(storage.rawGet(FIXTURE_SETTING.key)).toBeUndefined();
  });

  test("a missing setting reads as the default with status missing", () => {
    const ctx = contextWith(new InMemoryStorage());
    expect(readSetting(ctx, FIXTURE_SETTING.key)).toEqual({ status: "missing", value: "a" });
  });
});

describe("readDocument / writeDocument", () => {
  const chain = createMigrationChain(1);

  test("round-trips a well-formed document", () => {
    const ctx = contextWith(new InMemoryStorage());
    const doc = { schemaVersion: 1 as const, notes: ["a", "b"] };
    expect(writeDocument(ctx, FIXTURE_DOCUMENT.key, doc)).toEqual({ status: "ok" });
    expect(readDocument(ctx, FIXTURE_DOCUMENT.key, chain)).toEqual({ status: "ok", value: doc });
  });

  test("invalid JSON reads as corrupt", () => {
    const storage = new InMemoryStorage();
    storage.rawSet(FIXTURE_DOCUMENT.key, "{not json");
    const ctx = contextWith(storage);
    expect(readDocument(ctx, FIXTURE_DOCUMENT.key, chain)).toEqual({ status: "corrupt" });
  });

  test("an unmigratable schemaVersion reads as corrupt", () => {
    const storage = new InMemoryStorage();
    storage.rawSet(FIXTURE_DOCUMENT.key, JSON.stringify({ schemaVersion: 999 }));
    const ctx = contextWith(storage);
    expect(readDocument(ctx, FIXTURE_DOCUMENT.key, chain)).toEqual({ status: "corrupt" });
  });

  test("a missing document reads as missing", () => {
    const ctx = contextWith(new InMemoryStorage());
    expect(readDocument(ctx, FIXTURE_DOCUMENT.key, chain)).toEqual({ status: "missing" });
  });
});
