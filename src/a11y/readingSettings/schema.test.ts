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

  test("valid values parse; untested combinations are refused", () => {
    expect(parseReadingOnly("on")).toBe(true);
    expect(parseReadingOnly("off")).toBe(false);
    expect(parseMeasure("narrow")).toBe("narrow");
    expect(parseMeasure("wide")).toBe("wide");
    expect(parseTypeScale("150")).toBe("150");
    expect(parseContrast("high")).toBe("high");
    expect(parseParagraphSpacing("relaxed")).toBe("relaxed");
    expect(() => parseMeasure("full-bleed")).toThrow(/not in the tested set/);
    expect(() => parseTypeScale("200")).toThrow(/not in the tested set/);
    expect(() => parseContrast("max")).toThrow(/not in the tested set/);
    expect(() => parseParagraphSpacing("roomy")).toThrow(/not in the tested set/);
    expect(() => parseReadingOnly("maybe")).toThrow(/must be on or off/);
    passed("schema-untested-refused", "untested combinations throw");
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
