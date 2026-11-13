import { describe, expect, test } from "bun:test";
import { clearNamespaces, clearNamespacesWithReport, exportNamespaces } from "./exportClear.ts";
import { createKeyRegistry, type DocumentRegistration, type SettingRegistration } from "./keys.ts";
import { createStorageContext, readRaw, writeDocument, writeRaw } from "./store.ts";
import { InMemoryStorage, quotaExceededError } from "./testSupport.ts";

const EXPORTABLE_SETTING: SettingRegistration = {
  key: "am:settings:v1:theme",
  kind: "setting",
  ownerBeadId: "am-design-themes-typography-288q",
  exportable: true,
  clearable: true,
  maxBytes: 64,
  schemaVersion: 1,
  label: "Reading theme",
  prePaint: true,
  allowedValues: ["annalen", "kramgasse-night"],
  defaultValue: "annalen",
};

const NON_CLEARABLE_DOCUMENT: DocumentRegistration = {
  key: "am:fixture-permanent:v1",
  kind: "document",
  ownerBeadId: "am-fixture-bead",
  exportable: true,
  clearable: false,
  maxBytes: 1000,
  schemaVersion: 1,
  label: "Permanent fixture",
};

const NOTEBOOK: DocumentRegistration = {
  key: "am:notebook:v1",
  kind: "document",
  ownerBeadId: "am-read-notebook-tde",
  exportable: true,
  clearable: true,
  maxBytes: 64_000,
  schemaVersion: 1,
  label: "Notebook",
};

function contextWithData() {
  const registry = createKeyRegistry([EXPORTABLE_SETTING, NON_CLEARABLE_DOCUMENT, NOTEBOOK]);
  const storage = new InMemoryStorage();
  const ctx = createStorageContext({ registry, getStorage: () => storage });
  writeRaw(ctx, EXPORTABLE_SETTING.key, "kramgasse-night");
  writeDocument(ctx, NOTEBOOK.key, { schemaVersion: 1, entries: ["first note"] });
  writeRaw(ctx, NON_CLEARABLE_DOCUMENT.key, JSON.stringify({ schemaVersion: 1 }));
  return { ctx, storage };
}

describe("exportNamespaces", () => {
  test("produces valid JSON with the setting's raw string and the document parsed", () => {
    const { ctx } = contextWithData();
    const exported = exportNamespaces(ctx);
    expect(() => JSON.stringify(exported)).not.toThrow();
    const byKey = Object.fromEntries(exported.namespaces.map((n) => [n.key, n.value]));
    expect(byKey[EXPORTABLE_SETTING.key]).toBe("kramgasse-night");
    expect(byKey[NOTEBOOK.key]).toEqual({ schemaVersion: 1, entries: ["first note"] });
  });

  test("omits a namespace with nothing stored", () => {
    const registry = createKeyRegistry([EXPORTABLE_SETTING]);
    const ctx = createStorageContext({ registry, getStorage: () => new InMemoryStorage() });
    expect(exportNamespaces(ctx).namespaces).toEqual([]);
  });

  test("an explicit key list restricts the export to those (registered, exportable) namespaces", () => {
    const { ctx } = contextWithData();
    const exported = exportNamespaces(ctx, [EXPORTABLE_SETTING.key]);
    expect(exported.namespaces.map((n) => n.key)).toEqual([EXPORTABLE_SETTING.key]);
  });

  test("complete exports keep the existing interchange fields", () => {
    const { ctx } = contextWithData();
    expect(Object.keys(exportNamespaces(ctx)).sort()).toEqual(["exportedAt", "namespaces"]);
  });

  test("unreadable saved data is identified while readable and corrupt copies remain exportable", () => {
    class PartlyUnreadableStorage extends InMemoryStorage {
      override getItem(key: string): string | null {
        if (key === NOTEBOOK.key) throw new Error("Storage access was blocked.");
        return super.getItem(key);
      }
    }
    const storage = new PartlyUnreadableStorage();
    const registry = createKeyRegistry([EXPORTABLE_SETTING, NON_CLEARABLE_DOCUMENT, NOTEBOOK]);
    const ctx = createStorageContext({ registry, getStorage: () => storage });
    storage.rawSet(EXPORTABLE_SETTING.key, "annalen");
    storage.rawSet(NON_CLEARABLE_DOCUMENT.key, "{original broken JSON");
    storage.rawSet(NOTEBOOK.key, '{"entries":["unreadable saved note"]}');

    const exported = exportNamespaces(ctx);
    expect(exported.unreadableNamespaces).toEqual([{ key: NOTEBOOK.key, label: NOTEBOOK.label }]);
    expect(exported.namespaces).toEqual([
      { key: EXPORTABLE_SETTING.key, label: EXPORTABLE_SETTING.label, value: "annalen" },
      {
        key: NON_CLEARABLE_DOCUMENT.key,
        label: NON_CLEARABLE_DOCUMENT.label,
        value: "{original broken JSON",
      },
    ]);
    expect(exportNamespaces(ctx, [EXPORTABLE_SETTING.key]).unreadableNamespaces).toBeUndefined();
  });

  test("an unavailable saved copy does not prevent exporting in-tab recovery data", () => {
    const registry = createKeyRegistry([NOTEBOOK]);
    const ctx = createStorageContext({
      registry,
      getStorage: () => {
        throw new Error("Storage access was blocked.");
      },
    });
    writeDocument(ctx, NOTEBOOK.key, { entries: ["an unsaved observation"] });

    const exported = exportNamespaces(ctx);
    expect(exported.unreadableNamespaces).toEqual([{ key: NOTEBOOK.key, label: NOTEBOOK.label }]);
    expect(exported.namespaces).toEqual([
      { key: NOTEBOOK.key, label: NOTEBOOK.label, value: { entries: ["an unsaved observation"] } },
    ]);
    expect(JSON.parse(JSON.stringify(exported)).unreadableNamespaces).toEqual(
      exported.unreadableNamespaces,
    );
  });

  test("a quota-failed save exports both the saved notes and the distinct recovery copy", () => {
    const storage = new InMemoryStorage({ throwOnSet: quotaExceededError() });
    const registry = createKeyRegistry([NOTEBOOK]);
    const ctx = createStorageContext({ registry, getStorage: () => storage });
    storage.rawSet(NOTEBOOK.key, JSON.stringify({ notes: ["saved observation"] }));
    expect(writeDocument(ctx, NOTEBOOK.key, { notes: ["new unsaved observation"] }).status).toBe(
      "quota",
    );

    const exported = exportNamespaces(ctx);
    expect(exported.namespaces).toEqual([
      { key: NOTEBOOK.key, label: NOTEBOOK.label, value: { notes: ["saved observation"] } },
    ]);
    expect(exported.recoveryCopies).toEqual([
      { key: NOTEBOOK.key, label: NOTEBOOK.label, value: { notes: ["new unsaved observation"] } },
    ]);
    expect(exported.unreadableNamespaces).toBeUndefined();
    const copy = JSON.stringify(exported);

    expect(clearNamespaces(ctx)).toEqual([NOTEBOOK.key]);
    expect(storage.getItem(NOTEBOOK.key)).toBeNull();
    expect(ctx.fallback.has(NOTEBOOK.key)).toBe(false);
    expect(JSON.parse(copy).recoveryCopies[0].value).toEqual({
      notes: ["new unsaved observation"],
    });
  });

  test("an identical saved and in-tab copy does not change the ordinary export format", () => {
    const { ctx, storage } = contextWithData();
    const raw = JSON.stringify({ notes: ["same observation"] });
    storage.rawSet(NOTEBOOK.key, raw);
    ctx.fallback.set(NOTEBOOK.key, raw);

    expect(Object.keys(exportNamespaces(ctx)).sort()).toEqual(["exportedAt", "namespaces"]);
  });
});

describe("clearNamespaces", () => {
  test("clearing all namespaces removes exactly the clearable ones, leaving the non-clearable document intact", () => {
    const { ctx, storage } = contextWithData();
    const cleared = clearNamespaces(ctx);
    expect(new Set(cleared)).toEqual(new Set([EXPORTABLE_SETTING.key, NOTEBOOK.key]));
    expect(readRaw(ctx, EXPORTABLE_SETTING.key)).toEqual({ status: "missing" });
    expect(readRaw(ctx, NOTEBOOK.key)).toEqual({ status: "missing" });
    // The non-clearable document is untouched.
    expect(storage.rawGet(NON_CLEARABLE_DOCUMENT.key)).toBe(JSON.stringify({ schemaVersion: 1 }));
  });

  test("clearing one explicit namespace removes only that one", () => {
    const { ctx } = contextWithData();
    const cleared = clearNamespaces(ctx, [EXPORTABLE_SETTING.key]);
    expect(cleared).toEqual([EXPORTABLE_SETTING.key]);
    expect(readRaw(ctx, EXPORTABLE_SETTING.key)).toEqual({ status: "missing" });
    expect(readRaw(ctx, NOTEBOOK.key).status).toBe("ok");
  });

  test("requesting to clear a non-clearable namespace is silently a no-op for that key", () => {
    const { ctx } = contextWithData();
    const cleared = clearNamespaces(ctx, [NON_CLEARABLE_DOCUMENT.key]);
    expect(cleared).toEqual([]);
    expect(readRaw(ctx, NON_CLEARABLE_DOCUMENT.key).status).toBe("ok");
  });

  test("partial clearing reports confirmed keys and retains the failed key's recovery copy", () => {
    class PartlyBlockedStorage extends InMemoryStorage {
      override removeItem(key: string): void {
        if (key === NOTEBOOK.key) throw new Error("Removal was blocked.");
        super.removeItem(key);
      }
    }
    const storage = new PartlyBlockedStorage();
    const registry = createKeyRegistry([EXPORTABLE_SETTING, NOTEBOOK]);
    const ctx = createStorageContext({ registry, getStorage: () => storage });
    storage.rawSet(EXPORTABLE_SETTING.key, "annalen");
    storage.rawSet(NOTEBOOK.key, "saved notes");
    ctx.fallback.set(NOTEBOOK.key, "unsaved notes");

    expect(clearNamespacesWithReport(ctx)).toEqual({
      cleared: [EXPORTABLE_SETTING.key],
      failed: [{ key: NOTEBOOK.key, reason: "unavailable" }],
    });
    expect(storage.getItem(EXPORTABLE_SETTING.key)).toBeNull();
    expect(storage.getItem(NOTEBOOK.key)).toBe("saved notes");
    expect(ctx.fallback.get(NOTEBOOK.key)).toBe("unsaved notes");
    expect(clearNamespaces(ctx, [NOTEBOOK.key])).toEqual([]);
  });

  test("a storage backend that ignores removal is not reported as cleared", () => {
    class IgnoredRemovalStorage extends InMemoryStorage {
      override removeItem(_key: string): void {
        // Simulate a storage bridge that returns without removing the saved value.
      }
    }
    const storage = new IgnoredRemovalStorage();
    const registry = createKeyRegistry([NOTEBOOK]);
    const ctx = createStorageContext({ registry, getStorage: () => storage });
    storage.rawSet(NOTEBOOK.key, "saved notes");
    ctx.fallback.set(NOTEBOOK.key, "unsaved notes");

    expect(clearNamespacesWithReport(ctx)).toEqual({
      cleared: [],
      failed: [{ key: NOTEBOOK.key, reason: "still-present" }],
    });
    expect(storage.getItem(NOTEBOOK.key)).toBe("saved notes");
    expect(ctx.fallback.get(NOTEBOOK.key)).toBe("unsaved notes");
  });

  test("a failed removal check retains recovery data even when the removal itself succeeded", () => {
    const storage = new InMemoryStorage({ throwOnGet: new Error("Cannot verify removal.") });
    const registry = createKeyRegistry([NOTEBOOK]);
    const ctx = createStorageContext({ registry, getStorage: () => storage });
    storage.rawSet(NOTEBOOK.key, "saved notes");
    ctx.fallback.set(NOTEBOOK.key, "unsaved notes");

    expect(clearNamespacesWithReport(ctx)).toEqual({
      cleared: [],
      failed: [{ key: NOTEBOOK.key, reason: "unavailable" }],
    });
    expect(storage.rawGet(NOTEBOOK.key)).toBeUndefined();
    expect(ctx.fallback.get(NOTEBOOK.key)).toBe("unsaved notes");
  });

  test("unavailable storage never discards the in-tab copy", () => {
    const registry = createKeyRegistry([NOTEBOOK]);
    const ctx = createStorageContext({
      registry,
      getStorage: () => {
        throw new Error("Storage access was blocked.");
      },
    });
    ctx.fallback.set(NOTEBOOK.key, "unsaved notes");

    expect(clearNamespaces(ctx)).toEqual([]);
    expect(ctx.fallback.get(NOTEBOOK.key)).toBe("unsaved notes");
  });

  test("confirmed clearing removes both copies and ignores duplicate or unregistered requests", () => {
    const { ctx, storage } = contextWithData();
    ctx.fallback.set(NOTEBOOK.key, "unsaved notes");
    storage.rawSet("another-site-data", "keep");

    expect(
      clearNamespacesWithReport(ctx, [
        NOTEBOOK.key,
        NOTEBOOK.key,
        NON_CLEARABLE_DOCUMENT.key,
        "another-site-data",
      ]),
    ).toEqual({ cleared: [NOTEBOOK.key], failed: [] });
    expect(storage.getItem(NOTEBOOK.key)).toBeNull();
    expect(ctx.fallback.has(NOTEBOOK.key)).toBe(false);
    expect(storage.getItem(NON_CLEARABLE_DOCUMENT.key)).not.toBeNull();
    expect(storage.getItem("another-site-data")).toBe("keep");
  });
});
