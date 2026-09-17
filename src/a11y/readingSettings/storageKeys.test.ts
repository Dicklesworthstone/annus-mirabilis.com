import { describe, expect, test } from "bun:test";
import { storageKeyRegistry } from "../../platform/storage/keys.ts";
import { createStorageContext, writeSetting } from "../../platform/storage/store.ts";
import { getLogger } from "../../testing/log/logger.ts";
import { readingOnlyPrePaintRows } from "./prepaint.ts";
import { READING_SETTINGS_OWNER, READING_SETTINGS_STORAGE_KEYS } from "./schema.ts";

const logger = getLogger("a11y-reading-only");
const BEAD = "am-a11y-reading-only-6wwd";

describe("reading settings storage keys", () => {
  test("the five key names are exactly as registered, owned by this bead", () => {
    const keys = Object.values(READING_SETTINGS_STORAGE_KEYS);
    expect(keys).toHaveLength(5);
    for (const key of keys) {
      const entry = storageKeyRegistry.get(key);
      expect(entry?.kind).toBe("setting");
      if (entry?.kind === "setting") {
        expect(entry.ownerBeadId).toBe(READING_SETTINGS_OWNER);
        expect(entry.prePaint).toBe(true);
      }
    }
    logger.log({
      testId: "storage-five-keys",
      beadId: BEAD,
      outcome: "passed",
      message: "five registered keys, this bead owns them",
    });
  });

  test("the pre-paint script and the panel read the same key names", () => {
    const fromRows = readingOnlyPrePaintRows()
      .map((row) => row.key)
      .sort();
    const fromPanel = Object.values(READING_SETTINGS_STORAGE_KEYS).slice().sort();
    expect(fromRows).toEqual(fromPanel);
    logger.log({
      testId: "storage-prepaint-panel-same-keys",
      beadId: BEAD,
      outcome: "passed",
      message: "pre-paint rows match panel keys",
    });
  });

  test("a write outside the settings namespace fails; the forbidden second spelling is not a key", () => {
    const ctx = createStorageContext({ getStorage: () => new MapStorage() });
    expect(() => writeSetting(ctx, "am:reading:readingOnly", "on")).toThrow();
    expect(storageKeyRegistry.has("am:reading:readingOnly")).toBe(false);
    writeSetting(ctx, READING_SETTINGS_STORAGE_KEYS.readingOnly, "on");
    logger.log({
      testId: "storage-no-second-spelling",
      beadId: BEAD,
      outcome: "passed",
      message: "am:reading:readingOnly is not a registered key",
    });
  });
});

class MapStorage implements Storage {
  private readonly map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}
