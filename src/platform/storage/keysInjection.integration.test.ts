import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assertEveryPrePaintKeyIsEmitted,
  constantNameFor,
  GENERATED_OUTPUT_PATH,
  generatePrePaintKeyModule,
} from "../../../scripts/build/injectStorageKeys.ts";
import { READING_SETTINGS_PREPAINT } from "../../a11y/readingSettings/prepaint.ts";
import { THEME_INIT_SOURCE, THEME_STORAGE_KEY } from "../../app/theme/themeInit.inline.ts";
import { READER_PREPAINT } from "../../reader/detail/prepaint.ts";
import { getLogger } from "../../testing/log/logger.ts";
import {
  createKeyRegistry,
  SEED_ENTRIES,
  type SettingRegistration,
  storageKeyRegistry,
} from "./keys.ts";

const logger = getLogger("platform-storage");
const BEAD = "am-plat-local-storage-km8f";

describe("keys injection integration tests", () => {
  test("every prePaint setting has a generated constant matching the module key", () => {
    const prePaintSettings = storageKeyRegistry.prePaintSettings();
    expect(prePaintSettings).toHaveLength(10);

    const generatedSource = generatePrePaintKeyModule();
    for (const setting of prePaintSettings) {
      const constName = constantNameFor(setting.key);
      expect(generatedSource).toContain(
        `export const ${constName} = ${JSON.stringify(setting.key)};`,
      );
    }

    logger.log({
      testId: "prepaint-keys-all-emitted",
      beadId: BEAD,
      outcome: "passed",
      message: "all 10 pre-paint settings are emitted as constants in the generated module",
    });
  });

  test("settings with prePaint false are excluded from generated module", () => {
    const nonPrePaintSettings = storageKeyRegistry
      .settings()
      .filter((setting) => !setting.prePaint);

    expect(nonPrePaintSettings.length).toBeGreaterThanOrEqual(2);
    const nonPrePaintKeys = nonPrePaintSettings.map((s) => s.key);
    expect(nonPrePaintKeys).toContain("am:settings:v1:predictEntry");
    expect(nonPrePaintKeys).toContain("am:settings:v1:glossReasoningWords");

    const generatedSource = generatePrePaintKeyModule();
    for (const key of nonPrePaintKeys) {
      expect(generatedSource).not.toContain(JSON.stringify(key));
    }

    logger.log({
      testId: "non-prepaint-keys-excluded",
      beadId: BEAD,
      outcome: "passed",
      message:
        "predictEntry and glossReasoningWords are strictly excluded from pre-paint injection",
    });
  });

  test("generated on-disk file matches pure generator output byte-for-byte", () => {
    const onDisk = readFileSync(path.join(process.cwd(), GENERATED_OUTPUT_PATH), "utf8");
    const generated = generatePrePaintKeyModule();
    expect(onDisk).toBe(generated);

    logger.log({
      testId: "prepaint-disk-file-in-sync",
      beadId: BEAD,
      outcome: "passed",
      message: "generated/storage/prePaintKeys.ts on disk matches generator output",
    });
  });

  test("theme pre-paint inline script uses the exact registered theme key", () => {
    expect(THEME_STORAGE_KEY).toBe("am:settings:v1:theme");
    expect(THEME_INIT_SOURCE).toContain(JSON.stringify("am:settings:v1:theme"));

    logger.log({
      testId: "theme-inline-key-concordance",
      beadId: BEAD,
      outcome: "passed",
      message: "THEME_INIT_SOURCE embeds the canonical theme key",
    });
  });

  test("reading settings pre-paint inline script embeds the five reading-setting keys", () => {
    const expectedKeys = [
      "am:settings:v1:readingOnly",
      "am:settings:v1:measure",
      "am:settings:v1:typeScale",
      "am:settings:v1:contrast",
      "am:settings:v1:paragraphSpacing",
    ];

    for (const key of expectedKeys) {
      expect(READING_SETTINGS_PREPAINT).toContain(JSON.stringify(key));
    }

    logger.log({
      testId: "reading-settings-inline-keys-concordance",
      beadId: BEAD,
      outcome: "passed",
      message: "READING_SETTINGS_PREPAINT embeds all five reading setting keys",
    });
  });

  test("detail pre-paint inline script embeds the canonical detail key", () => {
    expect(READER_PREPAINT).toContain(JSON.stringify("am:settings:v1:detail"));

    logger.log({
      testId: "detail-inline-key-concordance",
      beadId: BEAD,
      outcome: "passed",
      message: "READER_PREPAINT embeds the canonical detail setting key",
    });
  });

  test("assertEveryPrePaintKeyIsEmitted fails if any prePaint key is omitted", () => {
    const testRegistry = createKeyRegistry([
      ...SEED_ENTRIES,
      {
        key: "am:settings:v1:extraSetting",
        kind: "setting",
        ownerBeadId: "am-test",
        prePaint: true,
        allowedValues: ["x", "y"],
        defaultValue: "x",
        label: "Extra test setting",
        exportable: true,
        clearable: true,
        maxBytes: 64,
        schemaVersion: 1,
      } satisfies SettingRegistration,
    ]);

    const emitted = new Set(
      storageKeyRegistry.prePaintSettings().map((s) => constantNameFor(s.key)),
    );

    expect(() => assertEveryPrePaintKeyIsEmitted(testRegistry, emitted)).toThrow(
      /missing from the injected key set/,
    );

    logger.log({
      testId: "prepaint-omission-guard-fails-loudly",
      beadId: BEAD,
      outcome: "passed",
      message: "assertEveryPrePaintKeyIsEmitted catches un-emitted prePaint keys",
    });
  });
});
