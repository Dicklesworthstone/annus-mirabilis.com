import assert from "node:assert/strict";
import test from "node:test";
import { READING_SETTINGS_PREPAINT } from "../../a11y/readingSettings/prepaint.ts";
import { READER_PREPAINT } from "../../reader/detail/prepaint.ts";
import { INLINE_SCRIPT_REGISTRY } from "./registry.ts";

test("the detail entry is registered with the exact bytes src/app/layout.tsx injects", () => {
  const entry = INLINE_SCRIPT_REGISTRY.find((e) => e.id === "detail");
  assert.ok(entry, 'expected an INLINE_SCRIPT_REGISTRY entry with id "detail"');
  assert.equal(entry.ownerBeadId, "am-read-detail-axis-sfc");
  assert.equal(entry.source, READER_PREPAINT);
  assert.equal(entry.routes, "all");
});

test("the reading-settings entry is registered with the exact bytes src/app/layout.tsx injects", () => {
  const entry = INLINE_SCRIPT_REGISTRY.find((e) => e.id === "reading-settings");
  assert.ok(entry, 'expected an INLINE_SCRIPT_REGISTRY entry with id "reading-settings"');
  assert.equal(entry.ownerBeadId, "am-a11y-reading-only-6wwd");
  assert.equal(entry.source, READING_SETTINGS_PREPAINT);
  assert.equal(entry.routes, "all");
});

test("every registry entry has a well-formed id, a non-empty owner, and non-empty source", () => {
  for (const entry of INLINE_SCRIPT_REGISTRY) {
    assert.match(
      entry.id,
      /^[a-z][a-z0-9-]*$/,
      `entry id "${entry.id}" should be a lower-case slug`,
    );
    assert.ok(entry.ownerBeadId.trim().length > 0, `entry "${entry.id}" has no ownerBeadId`);
    assert.ok(entry.source.trim().length > 0, `entry "${entry.id}" has no source`);
  }
});

test("registry entry ids are unique", () => {
  const ids = INLINE_SCRIPT_REGISTRY.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});
