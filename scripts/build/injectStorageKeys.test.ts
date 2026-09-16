import { describe, expect, test } from "bun:test";
import { createKeyRegistry, type SettingRegistration } from "../../src/platform/storage/keys.ts";
import {
  assertEveryPrePaintKeyIsEmitted,
  constantNameFor,
  generatePrePaintKeyModule,
} from "./injectStorageKeys.ts";

function prePaintSetting(suffix: string, prePaint: boolean): SettingRegistration {
  return {
    key: `am:settings:v1:${suffix}`,
    kind: "setting",
    ownerBeadId: "am-fixture-bead",
    exportable: true,
    clearable: true,
    maxBytes: 64,
    schemaVersion: 1,
    label: suffix,
    prePaint,
    allowedValues: ["a", "b"],
    defaultValue: "a",
  };
}

describe("constantNameFor", () => {
  test("maps camelCase key suffixes to SCREAMING_SNAKE_CASE constant names", () => {
    expect(constantNameFor("am:settings:v1:theme")).toBe("STORAGE_KEY_THEME");
    expect(constantNameFor("am:settings:v1:paragraphSpacing")).toBe(
      "STORAGE_KEY_PARAGRAPH_SPACING",
    );
    expect(constantNameFor("am:settings:v1:typeScale")).toBe("STORAGE_KEY_TYPE_SCALE");
    expect(constantNameFor("am:settings:v1:readingOnly")).toBe("STORAGE_KEY_READING_ONLY");
  });
});

describe("generatePrePaintKeyModule against the real registry", () => {
  test("emits exactly the ten settings registered with prePaint: true", () => {
    const source = generatePrePaintKeyModule();
    const names = [...source.matchAll(/export const (\w+) = /g)].map((m) => m[1]);
    expect(names.length).toBe(10);
    expect(names).toContain("STORAGE_KEY_THEME");
    expect(names).toContain("STORAGE_KEY_READING_ONLY");
    expect(names).toContain("STORAGE_KEY_PARAGRAPH_SPACING");
  });

  test("never emits the two non-pre-paint settings", () => {
    const source = generatePrePaintKeyModule();
    expect(source).not.toContain("predictEntry");
    expect(source).not.toContain("glossReasoningWords");
  });

  test("every emitted line is a well-formed exported string constant", () => {
    const source = generatePrePaintKeyModule();
    const codeLines = source.split("\n").filter((line) => line.startsWith("export const"));
    for (const line of codeLines) {
      expect(line).toMatch(/^export const STORAGE_KEY_[A-Z_]+ = "am:settings:v1:[a-zA-Z]+";$/);
    }
  });
});

describe("assertEveryPrePaintKeyIsEmitted", () => {
  test("passes when every prePaint:true entry's constant name is present", () => {
    const registry = createKeyRegistry([
      prePaintSetting("alpha", true),
      prePaintSetting("beta", false),
    ]);
    expect(() =>
      assertEveryPrePaintKeyIsEmitted(registry, new Set(["STORAGE_KEY_ALPHA"])),
    ).not.toThrow();
  });

  test("fails naming a prePaint:true entry the emitted set omits", () => {
    const registry = createKeyRegistry([
      prePaintSetting("alpha", true),
      prePaintSetting("gamma", true),
    ]);
    expect(() => assertEveryPrePaintKeyIsEmitted(registry, new Set(["STORAGE_KEY_ALPHA"]))).toThrow(
      /gamma/,
    );
  });
});
