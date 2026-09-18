import { describe, expect, test } from "bun:test";
import { getLogger } from "../../testing/log/logger.ts";
import {
  FORBIDDEN_COPY,
  MEASURE_VALUES,
  PARAGRAPH_SPACING_VALUES,
  parseContrast,
  parseMeasure,
  parseParagraphSpacing,
  parseReadingOnly,
  parseReadingSettings,
  parseTypeScale,
  READING_SETTING_LABELS,
  READING_SETTINGS_DEFAULTS,
  READING_SETTINGS_STORAGE_KEYS,
  ReadingSettingsError,
  readingOnlyStorageValue,
  TYPE_SCALE_VALUES,
} from "./schema.ts";

const logger = getLogger("a11y-reading-only");
const BEAD = "am-a11y-reading-only-6wwd";

function passed(testId: string, message: string): void {
  logger.log({ testId, beadId: BEAD, outcome: "passed", message });
}

describe("reading settings schema (am-a11y-reading-only-6wwd)", () => {
  test("defaults are the tested off/default/100 set", () => {
    expect(READING_SETTINGS_DEFAULTS).toEqual({
      readingOnly: false,
      measure: "default",
      typeScale: "100",
      contrast: "default",
      paragraphSpacing: "default",
    });
    passed("schema-defaults", "defaults match the tested set");
  });

  describe("invalid-reading-only (schema.ts:85)", () => {
    test("reject: throws invalid-reading-only for non-boolean/non-on-off string", () => {
      let caught: unknown;
      try {
        parseReadingOnly("maybe");
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ReadingSettingsError);
      expect((caught as ReadingSettingsError).code).toBe("invalid-reading-only");
    });

    test("accept: parses boolean and on/off strings", () => {
      expect(parseReadingOnly("on")).toBe(true);
      expect(parseReadingOnly(true)).toBe(true);
      expect(parseReadingOnly("off")).toBe(false);
      expect(parseReadingOnly(false)).toBe(false);
      expect(parseReadingOnly(null)).toBe(false);
      expect(parseReadingOnly(undefined)).toBe(false);
    });
  });

  describe("untested-measure (schema.ts:94)", () => {
    test("reject: throws untested-measure for unapproved measure", () => {
      let caught: unknown;
      try {
        parseMeasure("full-bleed");
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ReadingSettingsError);
      expect((caught as ReadingSettingsError).code).toBe("untested-measure");
    });

    test("accept: parses valid measure values", () => {
      expect(parseMeasure("narrow")).toBe("narrow");
      expect(parseMeasure("default")).toBe("default");
      expect(parseMeasure("wide")).toBe("wide");
      expect(parseMeasure(undefined)).toBe("default");
    });
  });

  describe("untested-type-scale (schema.ts:106)", () => {
    test("reject: throws untested-type-scale for unapproved typeScale", () => {
      let caught: unknown;
      try {
        parseTypeScale("200");
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ReadingSettingsError);
      expect((caught as ReadingSettingsError).code).toBe("untested-type-scale");
    });

    test("accept: parses valid typeScale values", () => {
      expect(parseTypeScale("100")).toBe("100");
      expect(parseTypeScale("112")).toBe("112");
      expect(parseTypeScale("125")).toBe("125");
      expect(parseTypeScale("150")).toBe("150");
      expect(parseTypeScale(150)).toBe("150");
      expect(parseTypeScale(undefined)).toBe("100");
    });
  });

  describe("untested-contrast (schema.ts:117)", () => {
    test("reject: throws untested-contrast for unapproved contrast", () => {
      let caught: unknown;
      try {
        parseContrast("max");
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ReadingSettingsError);
      expect((caught as ReadingSettingsError).code).toBe("untested-contrast");
    });

    test("accept: parses valid contrast values", () => {
      expect(parseContrast("default")).toBe("default");
      expect(parseContrast("high")).toBe("high");
      expect(parseContrast(undefined)).toBe("default");
    });
  });

  describe("untested-paragraph-spacing (schema.ts:128)", () => {
    test("reject: throws untested-paragraph-spacing for unapproved paragraphSpacing", () => {
      let caught: unknown;
      try {
        parseParagraphSpacing("roomy");
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ReadingSettingsError);
      expect((caught as ReadingSettingsError).code).toBe("untested-paragraph-spacing");
    });

    test("accept: parses valid paragraphSpacing values", () => {
      expect(parseParagraphSpacing("default")).toBe("default");
      expect(parseParagraphSpacing("relaxed")).toBe("relaxed");
      expect(parseParagraphSpacing(undefined)).toBe("default");
    });
  });

  test("labels are about the page, never the reader", () => {
    const blob = JSON.stringify(READING_SETTING_LABELS).toLowerCase();
    for (const word of FORBIDDEN_COPY) {
      expect(blob).not.toContain(word);
    }
    expect(READING_SETTING_LABELS.readingOnlyHelp).toContain("Keep every explanation");
    passed("schema-neutral-labels", "no learning-style or special-font copy");
  });

  test("parseReadingSettings freezes a complete record", () => {
    const parsed = parseReadingSettings({
      readingOnly: "on",
      measure: "narrow",
      typeScale: 125,
      contrast: "high",
      paragraphSpacing: "relaxed",
    });
    expect(parsed.readingOnly).toBe(true);
    expect(parsed.measure).toBe("narrow");
    expect(parsed.typeScale).toBe("125");
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(readingOnlyStorageValue(true)).toBe("on");
    expect(MEASURE_VALUES).toEqual(["narrow", "default", "wide"]);
    expect(TYPE_SCALE_VALUES).toEqual(["100", "112", "125", "150"]);
    expect(PARAGRAPH_SPACING_VALUES).toEqual(["default", "relaxed"]);
    passed("schema-parse-record", "complete frozen record");
  });

  test("storage key names are the five registered am:settings:v1: keys", () => {
    expect(Object.values(READING_SETTINGS_STORAGE_KEYS)).toEqual([
      "am:settings:v1:readingOnly",
      "am:settings:v1:measure",
      "am:settings:v1:typeScale",
      "am:settings:v1:contrast",
      "am:settings:v1:paragraphSpacing",
    ]);
    passed("schema-key-names", "five registered keys");
  });
});
