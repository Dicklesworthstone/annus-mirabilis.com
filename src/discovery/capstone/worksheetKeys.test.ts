import assert from "node:assert/strict";
import { it } from "node:test";
import { CAPSTONE_WORKSHEET_KEYS, storageKeyRegistry } from "../../platform/storage/keys.ts";
import { WORKSHEET_LIMITS } from "./worksheetState.ts";

it("all four capstone documents have independent bounded, exportable, clearable registrations", () => {
  assert.equal(Object.keys(CAPSTONE_WORKSHEET_KEYS).length, 4);
  assert.equal(new Set(Object.values(CAPSTONE_WORKSHEET_KEYS)).size, 4);
  for (const key of Object.values(CAPSTONE_WORKSHEET_KEYS)) {
    const registration = storageKeyRegistry.get(key);
    assert.equal(registration?.kind, "document");
    assert.equal(registration?.ownerBeadId, "am-disc-capstones-infra-3352");
    assert.equal(registration?.schemaVersion, 1);
    assert.equal(registration?.exportable, true);
    assert.equal(registration?.clearable, true);
    assert.ok((registration?.maxBytes ?? 0) >= 2 * (WORKSHEET_LIMITS.bytes + key.length));
  }
  assert.equal(storageKeyRegistry.get("am:notebook:v1")?.schemaVersion, 1);
});
