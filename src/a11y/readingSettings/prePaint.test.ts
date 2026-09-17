import { afterEach, describe, expect, test } from "bun:test";
import { getLogger } from "../../testing/log/logger.ts";
import {
  applyReadingSettingsPrepaint,
  READING_SETTINGS_PREPAINT,
  readingOnlyPrePaintRows,
  TABLE,
} from "./prepaint.ts";
import { READING_SETTINGS_STORAGE_KEYS } from "./schema.ts";

const logger = getLogger("a11y-reading-only");
const BEAD = "am-a11y-reading-only-6wwd";

const originals = {
  document: (globalThis as { document?: unknown }).document,
  localStorage: (globalThis as { localStorage?: unknown }).localStorage,
};

type Dataset = Record<string, string | undefined>;

function stub(stored: Record<string, string | null> = {}): { dataset: Dataset } {
  const dataset: Dataset = {};
  (globalThis as { document: unknown }).document = { documentElement: { dataset } };
  (globalThis as { localStorage: unknown }).localStorage = {
    getItem: (key: string) => stored[key] ?? null,
  };
  return { dataset };
}

afterEach(() => {
  (globalThis as { document: unknown }).document = originals.document;
  (globalThis as { localStorage: unknown }).localStorage = originals.localStorage;
});

describe("applyReadingSettingsPrepaint", () => {
  test("writes defaults when storage is empty", () => {
    const { dataset } = stub();
    applyReadingSettingsPrepaint(TABLE);
    expect(dataset.readingOnly).toBe("off");
    expect(dataset.measure).toBe("default");
    expect(dataset.typeScale).toBe("100");
    expect(dataset.contrast).toBe("default");
    expect(dataset.paragraphSpacing).toBe("default");
    logger.log({
      testId: "prepaint-defaults",
      beadId: BEAD,
      outcome: "passed",
      message: "empty storage paints defaults",
    });
  });

  test("applies stored values that are in the allowed set", () => {
    const { dataset } = stub({
      [READING_SETTINGS_STORAGE_KEYS.readingOnly]: "on",
      [READING_SETTINGS_STORAGE_KEYS.measure]: "wide",
      [READING_SETTINGS_STORAGE_KEYS.typeScale]: "150",
      [READING_SETTINGS_STORAGE_KEYS.contrast]: "high",
      [READING_SETTINGS_STORAGE_KEYS.paragraphSpacing]: "relaxed",
    });
    applyReadingSettingsPrepaint(TABLE);
    expect(dataset.readingOnly).toBe("on");
    expect(dataset.measure).toBe("wide");
    expect(dataset.typeScale).toBe("150");
    expect(dataset.contrast).toBe("high");
    expect(dataset.paragraphSpacing).toBe("relaxed");
    logger.log({
      testId: "prepaint-stored",
      beadId: BEAD,
      outcome: "passed",
      extra: { readingOnly: "on", typeScale: "150" },
      message: "stored values applied before paint",
    });
  });

  test("an untested stored value falls back to the default rather than being written raw", () => {
    const { dataset } = stub({
      [READING_SETTINGS_STORAGE_KEYS.typeScale]: "200",
    });
    applyReadingSettingsPrepaint(TABLE);
    expect(dataset.typeScale).toBe("100");
    logger.log({
      testId: "prepaint-untested-fallback",
      beadId: BEAD,
      outcome: "passed",
      message: "untested stored typeScale is not painted",
    });
  });

  test("never throws when localStorage access throws; defaults still apply", () => {
    const dataset: Dataset = {};
    (globalThis as { document: unknown }).document = { documentElement: { dataset } };
    (globalThis as { localStorage: unknown }).localStorage = new Proxy(
      {},
      {
        get() {
          throw new Error("storage blocked");
        },
      },
    );
    expect(() => applyReadingSettingsPrepaint(TABLE)).not.toThrow();
    expect(dataset.readingOnly).toBe("off");
    expect(dataset.measure).toBe("default");
    logger.log({
      testId: "prepaint-storage-throws",
      beadId: BEAD,
      outcome: "passed",
      extra: { storageState: "blocked" },
      message: "blocked storage keeps session defaults",
    });
  });

  test("never throws when document is missing", () => {
    (globalThis as { document: unknown }).document = undefined;
    (globalThis as { localStorage: unknown }).localStorage = { getItem: () => null };
    expect(() => applyReadingSettingsPrepaint(TABLE)).not.toThrow();
    logger.log({
      testId: "prepaint-no-document",
      beadId: BEAD,
      outcome: "passed",
      message: "missing document is not a throw",
    });
  });
});

describe("READING_SETTINGS_PREPAINT", () => {
  test("is a self-contained IIFE that embeds the registry rows, not a hand-copied key list", () => {
    expect(READING_SETTINGS_PREPAINT.startsWith("(function applyReadingSettingsPrepaint(")).toBe(
      true,
    );
    expect(READING_SETTINGS_PREPAINT.trimEnd().endsWith(");")).toBe(true);
    expect(READING_SETTINGS_PREPAINT).not.toContain("TABLE");
    expect(READING_SETTINGS_PREPAINT).not.toContain("import ");
    for (const key of Object.values(READING_SETTINGS_STORAGE_KEYS)) {
      expect(READING_SETTINGS_PREPAINT).toContain(JSON.stringify(key));
    }
    for (const row of readingOnlyPrePaintRows()) {
      expect(READING_SETTINGS_PREPAINT).toContain(JSON.stringify(row.key));
    }
    logger.log({
      testId: "prepaint-iife-embeds-registry-keys",
      beadId: BEAD,
      outcome: "passed",
      message: "IIFE embeds registry keys",
    });
  });

  test("executing the derived source matches calling the function", () => {
    const { dataset } = stub({
      [READING_SETTINGS_STORAGE_KEYS.readingOnly]: "on",
    });
    new Function(READING_SETTINGS_PREPAINT)();
    expect(dataset.readingOnly).toBe("on");
    logger.log({
      testId: "prepaint-iife-executes",
      beadId: BEAD,
      outcome: "passed",
      extra: { readingOnly: "on" },
      message: "derived source paints the same attributes",
    });
  });
});
