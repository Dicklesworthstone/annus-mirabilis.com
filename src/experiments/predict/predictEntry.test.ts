import assert from "node:assert/strict";
import test from "node:test";
import { createStorageContext } from "../../platform/storage/store.ts";
import { InMemoryStorage } from "../../platform/storage/testSupport.ts";
import {
  PREDICT_ENTRY_KEY,
  resolveEffectivePredictEntry,
  resolveGlobalPredictEntry,
  writeGlobalPredictEntry,
} from "./predictEntry.ts";

function contextWith(storage: Storage) {
  return createStorageContext({ getStorage: () => storage });
}

test("a single registered key name is shared by the panel and the store", () => {
  assert.equal(PREDICT_ENTRY_KEY, "am:settings:v1:predictEntry");
  // The real seeded registry (src/platform/storage/keys.ts) must already own this key,
  // so a panel and this module can never drift onto two different spellings.
  const ctx = contextWith(new InMemoryStorage());
  assert.ok(ctx.registry.has(PREDICT_ENTRY_KEY));
});

test("the three values round-trip", () => {
  const ctx = contextWith(new InMemoryStorage());
  for (const choice of ["predict-first", "worked-example-first", "explore-directly"] as const) {
    writeGlobalPredictEntry(ctx, choice);
    assert.deepEqual(resolveGlobalPredictEntry(ctx), { choice, source: "global" });
  }
});

test("the boolean migration in both directions", () => {
  const storageTrue = new InMemoryStorage();
  storageTrue.setItem(PREDICT_ENTRY_KEY, "true");
  assert.deepEqual(resolveGlobalPredictEntry(contextWith(storageTrue)), {
    choice: "predict-first",
    source: "global",
  });

  const storageFalse = new InMemoryStorage();
  storageFalse.setItem(PREDICT_ENTRY_KEY, "false");
  assert.deepEqual(resolveGlobalPredictEntry(contextWith(storageFalse)), {
    choice: "explore-directly",
    source: "global",
  });
});

test("a corrupt value falls back to predict-first, reported as the default source", () => {
  const storage = new InMemoryStorage();
  storage.setItem(PREDICT_ENTRY_KEY, "sometimes");
  assert.deepEqual(resolveGlobalPredictEntry(contextWith(storage)), {
    choice: "predict-first",
    source: "default",
  });
});

test("a missing value falls back to predict-first, reported as the default source", () => {
  const ctx = contextWith(new InMemoryStorage());
  assert.deepEqual(resolveGlobalPredictEntry(ctx), { choice: "predict-first", source: "default" });
});

test("a throwing storage accessor leaves predict-first in effect for the session, reported distinctly", () => {
  const throwing = new InMemoryStorage({ throwOnAnyAccess: new Error("storage is disabled") });
  const ctx = contextWith(throwing);
  assert.deepEqual(resolveGlobalPredictEntry(ctx), {
    choice: "predict-first",
    source: "session-fallback",
  });
});

test("the per-instrument override beats the global choice", () => {
  const storage = new InMemoryStorage();
  storage.setItem(PREDICT_ENTRY_KEY, "explore-directly");
  const ctx = contextWith(storage);
  assert.deepEqual(resolveEffectivePredictEntry(ctx, "predict-first"), {
    choice: "predict-first",
    source: "instrument",
  });
  // Clearing the override (passing undefined) restores the global choice.
  assert.deepEqual(resolveEffectivePredictEntry(ctx, undefined), {
    choice: "explore-directly",
    source: "global",
  });
});
