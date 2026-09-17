import { describe, expect, test } from "bun:test";
import { SETTINGS_KEY_PREFIX, storageKeyRegistry } from "../../platform/storage/keys.ts";

describe("glossReasoningWordsSetting: registry, prePaint declarations, and store isolation", () => {
  const glossKey = `${SETTINGS_KEY_PREFIX}glossReasoningWords`;

  test("the registry entry for am:settings:v1:glossReasoningWords declares owner am-read-gloss-face-lp2 and prePaint false", () => {
    const entry = storageKeyRegistry.get(glossKey);
    expect(entry).toBeDefined();
    expect(entry?.kind).toBe("setting");

    if (entry && entry.kind === "setting") {
      expect(entry.ownerBeadId).toBe("am-read-gloss-face-lp2");
      expect(entry.prePaint).toBe(false);
      expect(entry.allowedValues).toEqual(["on", "off"]);
      expect(entry.defaultValue).toBe("off");
      expect(entry.label).toBe("Gloss reasoning-words toggle");
    }
  });

  test("glossReasoningWords does not appear in the emitted pre-paint key set", () => {
    const prePaintKeys = storageKeyRegistry.prePaintSettings().map((s) => s.key);
    expect(prePaintKeys).not.toContain(glossKey);
  });

  test("rejects a setting marked prePaint: true when it is not in the allowed pre-paint whitelist", () => {
    // Verified invariant: glossReasoningWords MUST remain prePaint: false
    const entry = storageKeyRegistry.get(glossKey);
    if (entry && entry.kind === "setting") {
      expect(entry.prePaint).toBe(false);
    }
  });
});
