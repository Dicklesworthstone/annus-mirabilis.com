import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createBm01ComparisonSession } from "../../experiments/bm01/comparisonSession.ts";
import { createStorageContext } from "../../platform/storage/store.ts";
import { exportNotebookHtml, exportNotebookJson } from "./export.ts";
import { createNotebookStore } from "./notebookStore.ts";
import { predictionForAccepted, predictionIntent } from "./predictionIntent.ts";
import { replayCompatibility } from "./replayCompatibility.ts";
import { verifyReplayEvidence } from "./replayEntry.ts";
import { makeReplayEntry } from "./saveReplay.ts";
import { emptyNotebook, NOTEBOOK_KEY, notebookFrameHref, parseNotebookEntry } from "./schema.ts";
import { createNotebookStorage } from "./storage.ts";

const example = JSON.parse(
  await readFile(new URL("../../generated/bm01-comparison.json", import.meta.url), "utf8"),
);
const state = createBm01ComparisonSession("storage-evidence", example, () => {
  throw Error("No worker");
}).getServerSnapshot();
const input = {
  state,
  passage: { contentRevision: "a".repeat(64), translationRevision: null },
  before: "Before <script>secret()</script>",
  after: "After λₓ",
  notes: "Private note",
  prediction: "smaller",
};
const entry = await makeReplayEntry(input, "replay-example", "2026-09-17T10:00:00.000Z");
function storage() {
  const map = new Map();
  let mode = "ok";
  const backend = {
    get length() {
      if (mode === "blocked") throw Error("blocked");
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem(key, value) {
      if (mode === "quota") throw new DOMException("Full", "QuotaExceededError");
      map.set(key, value);
    },
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  };
  const ctx = createStorageContext({ getStorage: () => backend });
  return {
    ctx,
    map,
    setMode: (v) => {
      mode = v;
    },
    store: () => createNotebookStore(createNotebookStorage(ctx)),
  };
}
test("replay and legacy entries share the registered persistent document and reload exactly", async () => {
  const io = storage(),
    store = io.store();
  assert.equal(store.add(entry).ok, true);
  assert.deepEqual([...io.map.keys()], [NOTEBOOK_KEY]);
  const legacy = {
    id: "note",
    kind: "note",
    frame: entry.frame,
    title: "Old note",
    text: "Legacy",
    createdAt: entry.createdAt,
  };
  assert.equal(store.add(legacy).ok, true);
  const next = io.store();
  next.open();
  assert.deepEqual(next.getSnapshot().document.entries, [entry, parseNotebookEntry(legacy)]);
  assert.ok(await verifyReplayEvidence(next.getSnapshot().document.entries[0].replay));
});
for (const mode of ["quota", "blocked"])
  test(`${mode} retains replay evidence, words and exports in the existing session fallback`, async () => {
    const io = storage(),
      store = io.store();
    io.setMode(mode);
    assert.equal(store.add(entry).ok, true);
    assert.equal(store.getSnapshot().persistence, "session-only");
    assert.equal(io.map.has(NOTEBOOK_KEY), false);
    assert.equal(
      JSON.parse(exportNotebookJson(store.getSnapshot().document)).entries[0].replay
        .explanationAfter,
      "After λₓ",
    );
    io.setMode("ok");
    assert.equal(store.retry().ok, true);
    assert.equal(store.getSnapshot().persistence, "saved");
  });
test("editing explanations never rewrites accepted outputs, tape or checkpoint", async () => {
  const io = storage(),
    store = io.store();
  store.add(entry);
  assert.equal(
    store.updateReplayWords(entry.id, { before: "Changed words", after: "More words", notes: "" })
      .ok,
    true,
  );
  const saved = store.getSnapshot().document.entries[0];
  assert.deepEqual(saved.replay.tape, entry.replay.tape);
  assert.deepEqual(saved.replay.variant, entry.replay.variant);
  assert.ok(await verifyReplayEvidence(saved.replay));
  assert.equal(saved.text, "");
  assert.equal(
    store.updateReplayWords(entry.id, { before: "x".repeat(10001), after: "", notes: "" }).ok,
    false,
  );
  assert.equal(store.getSnapshot().document.entries[0], saved);
});
test("UTF-8 entry budget refuses large Unicode text without truncating", () => {
  const large = {
    ...entry,
    replay: {
      ...entry.replay,
      explanationBefore: "界".repeat(10000),
      explanationAfter: "界".repeat(10000),
    },
    text: "界".repeat(10000),
  };
  assert.throws(() => parseNotebookEntry(large), /64 KiB/);
});
test("unknown replay versions protect their original bytes", () => {
  const io = storage(),
    future = JSON.parse(JSON.stringify(entry));
  future.replay.schemaVersion = 99;
  const original = JSON.stringify({ ...emptyNotebook(), entries: [future] });
  io.map.set(NOTEBOOK_KEY, original);
  const store = io.store();
  store.open();
  assert.equal(store.getSnapshot().persistence, "protected");
  assert.equal(store.getSnapshot().recoveryRaw, original);
  store.add(entry);
  assert.equal(io.map.get(NOTEBOOK_KEY), original);
});
test("JSON import deduplicates and HTML includes all provenance without running or leaking notes", () => {
  const io = storage(),
    store = io.store();
  store.add(entry);
  assert.equal(
    store.importConfirmed(JSON.parse(exportNotebookJson(store.getSnapshot().document))).ok,
    true,
  );
  assert.equal(store.getSnapshot().document.entries.length, 1);
  const html = exportNotebookHtml(store.getSnapshot().document);
  for (const text of [
    "What you saw on",
    entry.replay.baseline.identity.sourceDigest,
    "saved-scalar-comparison",
    "explanationBefore",
    "acceptedCheckpoint",
    "After λₓ",
  ])
    assert.ok(html.includes(text), text);
  assert.ok(html.includes("&lt;script&gt;secret()&lt;/script&gt;"));
  assert.ok(!html.includes("<script"));
  assert.ok(!notebookFrameHref(entry.frame).includes("secret"));
});
test("another tab cannot silently overwrite a saved replay", () => {
  const io = storage(),
    first = io.store(),
    second = io.store();
  first.open();
  second.open();
  first.add(entry);
  const original = io.map.get(NOTEBOOK_KEY);
  second.add({ ...entry, id: "another" });
  assert.equal(second.getSnapshot().persistence, "conflict");
  assert.equal(io.map.get(NOTEBOOK_KEY), original);
});
test("retired and split passage anchors use the shared alias resolver", () => {
  const cat = {
    identity: entry.replay.baseline.identity,
    passages: { "new-argument": input.passage, "other-argument": input.passage },
    aliases: [
      {
        retiredId: "arg-bm-observable",
        kind: "split",
        replacementIds: ["new-argument", "other-argument"],
        reason: "Split for clarity",
        date: "2026-09-17",
        editor: "Test fixture",
      },
    ],
  };
  const resolved = replayCompatibility(entry.replay, entry.frame.anchor, cat);
  assert.equal(resolved.anchor, "new-argument");
  assert.match(resolved.aliasMessage, /first of 2/);
});
test("prediction belongs only to the next matching accepted request, not earlier numbers", () => {
  const requested = { ...state.variant.parameters };
  const intent = predictionIntent("smaller", state, requested);
  assert.equal(predictionForAccepted(intent, state), null);
  const accepted = {
    ...state,
    variantSnapshot: {
      ...state.variantSnapshot,
      actionIndex: state.variantSnapshot.actionIndex + 1,
    },
  };
  assert.equal(predictionForAccepted(intent, accepted), "smaller");
  assert.equal(predictionForAccepted(intent, { ...accepted, pending: true }), null);
  assert.equal(
    predictionForAccepted(intent, {
      ...accepted,
      baseline: { ...accepted.baseline, snapshotVersion: 999 },
    }),
    null,
  );
  assert.equal(
    predictionForAccepted(intent, {
      ...accepted,
      variant: { ...accepted.variant, parameters: { ...requested, a: requested.a * 2 } },
    }),
    null,
  );
  assert.equal(predictionForAccepted(null, accepted), null);
});
