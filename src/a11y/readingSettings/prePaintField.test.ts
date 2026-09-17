import { describe, expect, test } from "bun:test";
import { generatePrePaintKeyModule } from "../../../scripts/build/injectStorageKeys.ts";
import {
  createKeyRegistry,
  SEED_ENTRIES,
  type SettingRegistration,
  storageKeyRegistry,
} from "../../platform/storage/keys.ts";
import { getLogger } from "../../testing/log/logger.ts";
import { READING_SETTINGS_OWNER, READING_SETTINGS_STORAGE_KEYS } from "./schema.ts";

const logger = getLogger("a11y-reading-only");
const BEAD = "am-a11y-reading-only-6wwd";

describe("prePaint field on the five reading-settings keys", () => {
  test("each of the five keys carries prePaint: true and appears in the injected set", () => {
    const owned = storageKeyRegistry
      .prePaintSettings()
      .filter((entry) => entry.ownerBeadId === READING_SETTINGS_OWNER);
    expect(owned).toHaveLength(5);
    for (const entry of owned) {
      expect(entry.prePaint).toBe(true);
    }
    const source = generatePrePaintKeyModule();
    expect(source).toContain("STORAGE_KEY_READING_ONLY");
    expect(source).toContain("STORAGE_KEY_MEASURE");
    expect(source).toContain("STORAGE_KEY_TYPE_SCALE");
    expect(source).toContain("STORAGE_KEY_CONTRAST");
    expect(source).toContain("STORAGE_KEY_PARAGRAPH_SPACING");
    for (const key of Object.values(READING_SETTINGS_STORAGE_KEYS)) {
      expect(source).toContain(JSON.stringify(key));
    }
    logger.log({
      testId: "prepaint-field-five-true",
      beadId: BEAD,
      outcome: "passed",
      message: "injected set contains all five keys",
    });
  });

  test("flipping one key to prePaint: false drops exactly that key from the emitted set", () => {
    const flipped = createKeyRegistry(
      SEED_ENTRIES.map((entry) => {
        if (entry.key === READING_SETTINGS_STORAGE_KEYS.measure && entry.kind === "setting") {
          return { ...entry, prePaint: false } satisfies SettingRegistration;
        }
        return entry;
      }),
    );
    const source = generatePrePaintKeyModule(flipped);
    expect(source).not.toContain("STORAGE_KEY_MEASURE");
    expect(source).toContain("STORAGE_KEY_READING_ONLY");
    expect(source).toContain("STORAGE_KEY_TYPE_SCALE");
    expect(source).toContain("STORAGE_KEY_CONTRAST");
    expect(source).toContain("STORAGE_KEY_PARAGRAPH_SPACING");
    logger.log({
      testId: "prepaint-field-flip-drops-exactly-one",
      beadId: BEAD,
      outcome: "passed",
      message: "flipping measure to prePaint false drops only STORAGE_KEY_MEASURE",
    });
  });
});
