import assert from "node:assert/strict";
import test from "node:test";
import { createNotebookStore } from "./notebookStore.ts";
import { emptyNotebook, NOTEBOOK_LIMITS, parseNotebookDocument } from "./schema.ts";

const frame = {
  paper: "brownian-motion",
  anchor: "arg-bm-observable",
  view: "reading",
  detail: 1,
  lens: "paper",
  open: "",
};
const entry = (id, text = id) => ({
  id,
  kind: "note",
  frame,
  title: "The observable",
  text,
  createdAt: "2026-09-17T14:00:00.000Z",
});
const doc = (entries = []) => parseNotebookDocument({ ...emptyNotebook(), entries });
const reviewed = (result) => {
  assert.equal(result.ok, true, result.message);
  return result.review;
};
function backend(initial = doc()) {
  let raw = JSON.stringify(initial);
  return {
    maxBytes: 2_000_000,
    writes: 0,
    reads: 0,
    mode: "ok",
    onRead: null,
    read() {
      this.reads++;
      this.onRead?.(this.reads);
      if (this.mode === "unavailable" || this.mode === "corrupt") return { status: this.mode };
      return raw === null ? { status: "missing" } : { status: "ok", value: raw };
    },
    write(document) {
      this.writes++;
      if (this.mode !== "ok") return { status: this.mode };
      raw = JSON.stringify(document);
      return { status: "ok" };
    },
    decode: JSON.parse,
    preserve() {},
    discardFallback() {},
    raw: () => raw,
    replace(value) {
      raw = value;
    },
  };
}

test("reviewed file import preserves local edits, saves copies, and round trips through the real schema", () => {
  const io = backend(doc([entry("a", "local")])),
    store = createNotebookStore(io);
  const imported = doc([entry("a", "incoming"), entry("b")]);
  const preview = reviewed(store.previewImport(imported));
  assert.equal(io.writes, 0);
  assert.equal(store.commitMerge(preview).ok, true);
  const saved = parseNotebookDocument(JSON.parse(io.raw()));
  assert.deepEqual(
    saved.entries.map((e) => e.text),
    ["local", "incoming", "b"],
  );
  assert.equal(store.getSnapshot().persistence, "saved");
  const repeated = reviewed(store.previewImport(imported));
  assert.equal(repeated.plan.duplicates, 2);
  assert.equal(repeated.plan.added, 0);
  assert.equal(store.commitMerge(repeated).ok, true);
  assert.deepEqual(parseNotebookDocument(JSON.parse(io.raw())), saved);
});

test("the unreviewed legacy import still refuses edited entries without writing", () => {
  const io = backend(doc([entry("a", "local")])),
    store = createNotebookStore(io);
  const before = io.raw();
  assert.equal(store.importConfirmed(doc([entry("a", "incoming"), entry("b")])).ok, false);
  assert.equal(io.raw(), before);
  assert.equal(io.writes, 0);
});

test("two real stores reconcile divergent edits without reloading away either tab's work", () => {
  const io = backend(doc([entry("a", "original")]));
  const first = createNotebookStore(io),
    second = createNotebookStore(io);
  first.open();
  second.open();
  first.updateText("a", "saved in first tab");
  second.updateText("a", "retained in second tab");
  second.add(entry("second-only"));
  assert.equal(second.getSnapshot().persistence, "conflict");
  const writes = io.writes;
  const review = reviewed(second.previewSavedMerge());
  assert.equal(io.writes, writes);
  assert.equal(second.commitMerge(review).ok, true);
  assert.equal(second.getSnapshot().persistence, "saved");
  assert.deepEqual(
    JSON.parse(io.raw()).entries.map((e) => e.text),
    ["retained in second tab", "second-only", "saved in first tab"],
  );
  first.checkForExternalChange();
  assert.equal(first.getSnapshot().persistence, "conflict");
});

test("a changed local document rejects confirmation without writing or discarding its new note", () => {
  const io = backend(),
    store = createNotebookStore(io);
  const preview = reviewed(store.previewImport(doc([entry("incoming")])));
  store.add(entry("local-new"));
  const raw = io.raw(),
    writes = io.writes;
  assert.equal(store.commitMerge(preview).ok, false);
  assert.equal(io.raw(), raw);
  assert.equal(io.writes, writes);
  assert.equal(store.getSnapshot().document.entries[0].id, "local-new");
});

test("the final saved-byte lease catches a change after controller preflight and before write", () => {
  const io = backend(doc([entry("local")])),
    store = createNotebookStore(io);
  store.open();
  io.replace(JSON.stringify(doc([entry("remote")])));
  const preview = reviewed(store.previewSavedMerge());
  const raceAt = io.reads + 2;
  const latest = JSON.stringify(doc([entry("new-remote")]));
  io.onRead = (read) => {
    if (read === raceAt) io.replace(latest);
  };
  const got = store.commitMerge(preview);
  assert.equal(got.ok, false);
  assert.match(got.message, /changed|unavailable/);
  assert.equal(io.writes, 0);
  assert.equal(io.raw(), latest);
  assert.deepEqual(
    store.getSnapshot().document.entries.map((e) => e.id),
    ["local"],
  );
});

test("a quota failure keeps the complete union in memory and retries against the reviewed saved base", () => {
  const io = backend(doc([entry("local")])),
    store = createNotebookStore(io);
  store.open();
  io.replace(JSON.stringify(doc([entry("remote")])));
  store.checkForExternalChange();
  const savedBefore = io.raw();
  const preview = reviewed(store.previewSavedMerge());
  io.mode = "quota";
  assert.equal(store.commitMerge(preview).ok, true);
  assert.equal(store.getSnapshot().persistence, "session-only");
  assert.deepEqual(
    store.getSnapshot().document.entries.map((e) => e.id),
    ["local", "remote"],
  );
  assert.equal(io.raw(), savedBefore);
  io.mode = "ok";
  assert.equal(store.retry().ok, true);
  assert.equal(store.getSnapshot().persistence, "saved");
  assert.deepEqual(
    JSON.parse(io.raw()).entries.map((e) => e.id),
    ["local", "remote"],
  );
});

test("an external clear requires an explicit reviewed save; preview and cancel do not resurrect it", () => {
  const io = backend(doc([entry("local")])),
    store = createNotebookStore(io);
  store.open();
  io.replace(null);
  store.checkForExternalChange();
  const first = reviewed(store.previewSavedMerge());
  assert.equal(first.savedWasCleared, true);
  store.cancelMerge(first);
  assert.equal(store.commitMerge(first).ok, false);
  assert.equal(io.raw(), null);
  const second = reviewed(store.previewSavedMerge());
  assert.equal(store.commitMerge(second).ok, true);
  assert.equal(JSON.parse(io.raw()).entries[0].id, "local");
});

test("byte limits are rechecked after review and preserve both originals on rejection", () => {
  const io = backend(doc([entry("local")])),
    store = createNotebookStore(io);
  const preview = reviewed(store.previewImport(doc([entry("incoming", "x".repeat(4000))])));
  const before = io.raw();
  io.maxBytes = 1000;
  assert.equal(store.commitMerge(preview).ok, false);
  assert.equal(io.raw(), before);
  assert.equal(io.writes, 0);
  assert.equal(store.getSnapshot().document.entries.length, 1);
});

test("entry capacity can be resolved in preview without increasing schema limits", () => {
  const io = backend(
    doc(Array.from({ length: NOTEBOOK_LIMITS.entries }, (_, i) => entry(`n${i}`))),
  );
  const store = createNotebookStore(io);
  const first = reviewed(store.previewImport(doc([entry("n0", "changed")])));
  assert.equal(first.plan.withinLimit, false);
  assert.equal(store.commitMerge(first).ok, false);
  assert.equal(io.writes, 0);
  const revised = reviewed(store.reviseMerge(first, new Map([["n0", "keep-current"]])));
  assert.equal(store.commitMerge(revised).ok, true);
  assert.equal(JSON.parse(io.raw()).entries.length, NOTEBOOK_LIMITS.entries);
});

test("notebook-merge-saved-unavailable: unreadable storage is never treated as an empty notebook", () => {
  for (const mode of ["corrupt", "unavailable"]) {
    const io = backend(doc([entry("local")])),
      store = createNotebookStore(io);
    store.open();
    io.mode = mode;
    assert.equal(store.previewSavedMerge().ok, false);
    assert.equal(io.writes, 0);
    assert.equal(store.getSnapshot().document.entries[0].id, "local");
  }
});

test("notebook-merge-saved-too-large: oversized saved bytes are refused without overwriting", () => {
  const io = backend(doc([entry("local")])),
    store = createNotebookStore(io);
  store.open();
  const raw = JSON.stringify(doc([entry("remote", "x".repeat(4000))]));
  io.replace(raw);
  io.maxBytes = 1000;
  const result = store.previewSavedMerge();
  assert.equal(result.ok, false);
  assert.match(result.message, /byte limit/);
  assert.equal(io.raw(), raw);
  assert.equal(io.writes, 0);
});

test("unsupported saved originals stay protected while a reviewed file import can be retained in the tab", () => {
  const io = backend();
  const unknown = JSON.stringify({ ...emptyNotebook(), schemaVersion: 9 });
  io.replace(unknown);
  const store = createNotebookStore(io);
  store.add(entry("local"));
  assert.equal(store.getSnapshot().persistence, "protected");
  assert.equal(store.previewSavedMerge().ok, false);
  const imported = reviewed(store.previewImport(doc([entry("incoming")])));
  assert.equal(store.commitMerge(imported).ok, true);
  assert.equal(store.getSnapshot().persistence, "protected");
  assert.equal(store.getSnapshot().document.entries.length, 2);
  assert.equal(store.getSnapshot().recoveryRaw, unknown);
  assert.equal(io.raw(), unknown);
  assert.equal(io.writes, 0);
});

test("malformed and duplicate-id imports cannot obtain a review capability", () => {
  const io = backend(doc([entry("local")])),
    store = createNotebookStore(io);
  for (const input of [
    { ...emptyNotebook(), extra: "unvalidated" },
    { ...emptyNotebook(), entries: [entry("same"), entry("same", "other")] },
    {
      ...emptyNotebook(),
      entries: [{ ...entry("x"), frame: { ...frame, anchor: '" onfocus=alert(1)' } }],
    },
  ])
    assert.equal(store.previewImport(input).ok, false);
  assert.equal(io.writes, 0);
  assert.equal(store.getSnapshot().document.entries[0].id, "local");
});
