import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SEED_ENTRIES, type SettingRegistration } from "../../platform/storage/keys.ts";
import { DETAIL_STORAGE_KEY } from "../navigation/state.ts";
import { READER_PREPAINT } from "./prepaint.ts";

const DETAIL_DIR = path.dirname(fileURLToPath(import.meta.url));

describe("detailKeyInjection.integration (am-read-detail-axis-sfc)", () => {
  test("src/platform/storage/keys.ts registers am:settings:v1:detail with owner am-read-detail-axis-sfc", () => {
    const entry = SEED_ENTRIES.find(
      (e) => e.ownerBeadId === "am-read-detail-axis-sfc" && e.kind === "setting",
    ) as SettingRegistration | undefined;
    expect(entry).toBeDefined();
    expect(entry?.key).toBe("am:settings:v1:detail");
    expect(entry?.prePaint).toBe(true);
    expect(entry?.allowedValues).toEqual(["0", "1", "2"]);
    expect(entry?.defaultValue).toBe("1");
    expect(entry?.key).toBe(DETAIL_STORAGE_KEY);
  });

  test("the compiled inline script READER_PREPAINT contains exactly the registered am:settings:v1:detail key", () => {
    expect(READER_PREPAINT).toContain(JSON.stringify(DETAIL_STORAGE_KEY));
    expect(READER_PREPAINT).toContain('"am:settings:v1:detail"');
  });

  test("no second spelling of the detail settings key appears anywhere in src/reader/detail/", () => {
    const suspiciousKeyPatterns = [
      /am:detail\b/i,
      /am:settings:detail\b/i,
      /am:settings:v1:detail-level\b/i,
    ];
    const files = readdirSync(DETAIL_DIR).filter(
      (name) =>
        (name.endsWith(".ts") || name.endsWith(".tsx")) &&
        name !== "detailKeyInjection.integration.test.ts",
    );

    for (const file of files) {
      const content = readFileSync(path.join(DETAIL_DIR, file), "utf8");
      for (const pattern of suspiciousKeyPatterns) {
        expect(pattern.test(content)).toBe(false);
      }
    }
  });
});
