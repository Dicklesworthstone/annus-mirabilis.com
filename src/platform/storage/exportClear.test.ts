import { describe, expect, test } from "bun:test";
import { clearNamespaces, exportNamespaces } from "./exportClear.ts";
import { createKeyRegistry, type DocumentRegistration, type SettingRegistration } from "./keys.ts";
import { createStorageContext, readRaw, writeDocument, writeRaw } from "./store.ts";
import { InMemoryStorage } from "./testSupport.ts";

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
});
