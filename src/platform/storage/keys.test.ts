import { describe, expect, test } from "bun:test";
import {
  createKeyRegistry,
  type DocumentRegistration,
  DuplicateKeyRegistrationError,
  InvalidKeyRegistrationError,
  SEED_ENTRIES,
  SETTINGS_KEY_PREFIX,
  type SettingRegistration,
  storageKeyRegistry,
} from "./keys.ts";

function fixtureSetting(overrides: Partial<SettingRegistration> = {}): SettingRegistration {
  return {
    key: `${SETTINGS_KEY_PREFIX}fixture`,
    kind: "setting",
    ownerBeadId: "am-fixture-bead",
    exportable: true,
    clearable: true,
    maxBytes: 64,
    schemaVersion: 1,
    label: "Fixture setting",
    prePaint: false,
    allowedValues: ["a", "b"],
    defaultValue: "a",
    ...overrides,
  };
}

function fixtureDocument(overrides: Partial<DocumentRegistration> = {}): DocumentRegistration {
  return {
    key: "am:fixture:v1",
    kind: "document",
    ownerBeadId: "am-fixture-bead",
    exportable: true,
    clearable: true,
    maxBytes: 1000,
    schemaVersion: 1,
    label: "Fixture document",
    ...overrides,
  };
}

describe("createKeyRegistry", () => {
  test("every registration in the real seed set carries all required fields", () => {
    for (const entry of SEED_ENTRIES) {
      expect(entry.key.length).toBeGreaterThan(0);
      expect(entry.ownerBeadId.length).toBeGreaterThan(0);
      expect(entry.label.length).toBeGreaterThan(0);
      expect(Number.isInteger(entry.schemaVersion)).toBe(true);
      expect(typeof entry.exportable).toBe("boolean");
      expect(typeof entry.clearable).toBe("boolean");
      expect(entry.maxBytes).toBeGreaterThan(0);
      if (entry.kind === "setting") {
        expect(typeof entry.prePaint).toBe("boolean");
        expect(entry.allowedValues.length).toBeGreaterThan(0);
        expect(entry.allowedValues).toContain(entry.defaultValue);
      }
    }
  });

  test("a duplicate key fails registry construction", () => {
    expect(() => createKeyRegistry([fixtureSetting(), fixtureSetting()])).toThrow(
      DuplicateKeyRegistrationError,
    );
  });

  test("every setting key uses the am:settings:v1: prefix", () => {
    expect(() => createKeyRegistry([fixtureSetting({ key: "am:bad:v1:fixture" })])).toThrow(
      InvalidKeyRegistrationError,
    );
    for (const entry of storageKeyRegistry.settings())
      expect(entry.key.startsWith(SETTINGS_KEY_PREFIX)).toBe(true);
  });

  test("every setting must declare at least one allowed value, and the default must be among them", () => {
    expect(() => createKeyRegistry([fixtureSetting({ allowedValues: [] })])).toThrow(
      InvalidKeyRegistrationError,
    );
    expect(() => createKeyRegistry([fixtureSetting({ defaultValue: "not-allowed" })])).toThrow(
      InvalidKeyRegistrationError,
    );
  });

  test("the registry rejects a non-positive maxBytes and a non-positive schemaVersion", () => {
    expect(() => createKeyRegistry([fixtureDocument({ maxBytes: 0 })])).toThrow(
      InvalidKeyRegistrationError,
    );
    expect(() => createKeyRegistry([fixtureDocument({ schemaVersion: 0 })])).toThrow(
      InvalidKeyRegistrationError,
    );
  });
});

describe("the real storage key registry", () => {
  test("has exactly twelve settings", () => {
    expect(storageKeyRegistry.settings().length).toBe(12);
  });

  test("the ten pre-paint settings are exactly the reading-only, perspective, theme, and detail keys", () => {
    const prePaintKeys = storageKeyRegistry
      .prePaintSettings()
      .map((e) => e.key)
      .sort();
    const expected = [
      "am:settings:v1:theme",
      "am:settings:v1:detail",
      "am:settings:v1:perspective",
      "am:settings:v1:notation",
      "am:settings:v1:units",
      "am:settings:v1:readingOnly",
      "am:settings:v1:measure",
      "am:settings:v1:typeScale",
      "am:settings:v1:contrast",
      "am:settings:v1:paragraphSpacing",
    ].sort();
    expect(prePaintKeys).toEqual(expected);
    expect(prePaintKeys.length).toBe(10);
  });

  test("predictEntry and glossReasoningWords each have exactly one owner, declared allowed values, and are excluded from the pre-paint set", () => {
    const predictEntry = storageKeyRegistry.get(
      "am:settings:v1:predictEntry",
    ) as SettingRegistration;
    const glossReasoningWords = storageKeyRegistry.get(
      "am:settings:v1:glossReasoningWords",
    ) as SettingRegistration;
    expect(predictEntry.ownerBeadId).toBe("am-inst-predict-mode-ti7m");
    expect(predictEntry.allowedValues).toEqual([
      "predict-first",
      "worked-example-first",
      "explore-directly",
    ]);
    expect(predictEntry.prePaint).toBe(false);
    expect(glossReasoningWords.ownerBeadId).toBe("am-read-gloss-face-lp2");
    expect(glossReasoningWords.allowedValues).toEqual(["on", "off"]);
    expect(glossReasoningWords.prePaint).toBe(false);

    const prePaintKeys = storageKeyRegistry.prePaintSettings().map((e) => e.key);
    expect(prePaintKeys).not.toContain("am:settings:v1:predictEntry");
    expect(prePaintKeys).not.toContain("am:settings:v1:glossReasoningWords");
  });

  test("seeds the four named document namespaces, one owner each", () => {
    const documents = storageKeyRegistry.documents();
    const byKey = Object.fromEntries(documents.map((d) => [d.key, d.ownerBeadId]));
    expect(byKey["am:notebook:v1"]).toBe("am-read-notebook-tde");
    expect(byKey["am:tours:v1"]).toBe("am-tours-infra-g518");
    expect(byKey["am:predictions:v1"]).toBe("am-inst-predict-mode-ti7m");
    expect(byKey["am:clarity:v1"]).toBe("am-plat-clarity-signal-nlwr");
  });

  test("has() and get() agree on membership", () => {
    for (const entry of storageKeyRegistry.all()) {
      expect(storageKeyRegistry.has(entry.key)).toBe(true);
      expect(storageKeyRegistry.get(entry.key)).toEqual(entry);
    }
    expect(storageKeyRegistry.has("am:settings:v1:doesNotExist")).toBe(false);
  });
});
