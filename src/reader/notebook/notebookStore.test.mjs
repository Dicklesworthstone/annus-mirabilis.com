import assert from "node:assert/strict";
import test from "node:test";
import { createNotebookStore } from "./notebookStore.ts";
import { emptyNotebook, NOTEBOOK_KEY } from "./schema.ts";
import { exportNotebookHtml, exportNotebookJson } from "./export.ts";
const frame = { paper: "brownian-motion", anchor: "arg-bm-observable", view: "reading", detail: 1, lens: "paper", open: "" };
const entry = (id = "n1", text = "Private question") => ({ id, text, kind: "note", frame, title: "The observable", createdAt: "2026-09-17T14:00:00.000Z" });
const place = { frame, title: "The observable", recap: "The mean square adds.", recapKind: "authored-recap" };
function backend(raw = null) {
  let value = raw;
  return { maxBytes: 64000, mode: "ok", reads: 0, writes: 0, preserved: [],
    read() { this.reads++; return this.mode === "blocked" ? { status: "unavailable" } : value === null ? { status: "missing" } : { status: "ok", value }; },
    write(document) { this.writes++; if (this.mode !== "ok") return { status: this.mode === "blocked" ? "unavailable" : "quota" }; value = JSON.stringify(document); return { status: "ok" }; },
    decode: JSON.parse, preserve(raw) { this.preserved.push(raw); }, discardFallback() {},
    raw: () => value, replace: (text) => { value = text; } };
}
test("construction does not read browser storage; open is idempotent", () => {
  const io = backend(), store = createNotebookStore(io); assert.equal(io.reads, 0);
  store.open(); store.open(); assert.equal(io.reads, 1); assert.equal(io.writes, 0);
});
test("add, reload, edit and remove use a single document", () => {
  const io = backend(), store = createNotebookStore(io); assert.equal(store.add(entry()).ok, true);
  const next = createNotebookStore(io); next.open(); assert.equal(next.getSnapshot().document.entries[0].text, "Private question");
  next.updateText("n1", "Revised question"); assert.equal(JSON.parse(io.raw()).entries[0].text, "Revised question");
  next.remove("n1"); assert.deepEqual(JSON.parse(io.raw()).entries, []);
});
for (const mode of ["blocked", "quota"]) test(`${mode} keeps all new session notes, even when old saved bytes remain`, () => {
  const io = backend(), store = createNotebookStore(io); store.add(entry()); const old = io.raw(); io.mode = mode;
  store.add(entry("n2")); store.updateText("n2", "still here");
  assert.equal(store.getSnapshot().persistence, "session-only"); assert.equal(io.raw(), old);
  assert.equal(store.getSnapshot().document.entries.length, 2);
  assert.match(exportNotebookJson(store.getSnapshot().document), /still here/);
  io.mode = "ok"; store.retry(); assert.equal(store.getSnapshot().persistence, "saved");
  assert.equal(JSON.parse(io.raw()).entries.length, 2);
});
for (const raw of ['{broken', JSON.stringify({ ...emptyNotebook(), schemaVersion: 9 }), JSON.stringify({ ...emptyNotebook(), extra: true })])
  test(`unreadable original is protected: ${raw.slice(0, 20)}`, () => {
    const io = backend(raw), store = createNotebookStore(io); store.open(); store.add(entry()); store.remember(place); store.retry();
    assert.equal(store.getSnapshot().persistence, "protected"); assert.equal(io.raw(), raw);
    assert.equal(store.getSnapshot().recoveryRaw, raw); assert.deepEqual(io.preserved, [raw]);
    store.clearConfirmed(); assert.deepEqual(JSON.parse(io.raw()), emptyNotebook());
  });
test("structural rejection and size rejection preserve the existing notebook", () => {
  const io = backend(), store = createNotebookStore(io); store.add(entry()); const before = io.raw();
  assert.equal(store.add(entry("n2", "x".repeat(4001))).ok, false);
  assert.equal(store.add(entry()).ok, false); assert.equal(io.raw(), before);
  io.maxBytes = 100; assert.equal(store.add(entry("n2")).ok, false); assert.equal(io.raw(), before);
});
test("a second tab's write is never silently overwritten", () => {
  const io = backend(), first = createNotebookStore(io), second = createNotebookStore(io);
  first.open(); second.open(); first.add(entry("first")); const saved = io.raw(); second.add(entry("second"));
  assert.equal(second.getSnapshot().persistence, "conflict"); assert.equal(io.raw(), saved);
  assert.equal(second.getSnapshot().document.entries[0].id, "second");
  assert.equal(second.clearConfirmed().ok, false);
  second.reloadConfirmed(); assert.equal(second.getSnapshot().document.entries[0].id, "first");
});
test("external clear is detected and does not resurrect deleted data", () => {
  const io = backend(), store = createNotebookStore(io); store.add(entry()); io.replace(null);
  store.checkForExternalChange(); assert.equal(store.getSnapshot().persistence, "conflict");
  store.remember(place); assert.equal(io.raw(), null);
});
test("remembering a frame is idempotent, exported and clearable without changing settings", () => {
  const io = backend(), store = createNotebookStore(io); store.remember(place); const writes = io.writes;
  store.remember(place); assert.equal(io.writes, writes);
  const next = createNotebookStore(io); next.open(); assert.deepEqual(next.getSnapshot().document.lastPlace, place);
  next.forgetPlace(); assert.equal(next.getSnapshot().document.lastPlace, null);
  next.clearConfirmed(); assert.deepEqual(JSON.parse(io.raw()), emptyNotebook());
});
test("clear failure is visibly session-only, never claimed as a persistent deletion", () => {
  const io = backend(), store = createNotebookStore(io); store.add(entry()); io.mode = "quota"; store.clearConfirmed();
  assert.equal(store.getSnapshot().persistence, "session-only"); assert.equal(JSON.parse(io.raw()).entries.length, 1);
});
test("subscriber failures and unsubscribe do not break saving", () => {
  const store = createNotebookStore(backend()); let calls = 0;
  const off = store.subscribe(() => { calls++; }); store.subscribe(() => { throw Error("view detached"); });
  store.add(entry()); off(); const before = calls; store.add(entry("n2")); assert.equal(calls, before);
});
test("JSON export round trips exactly, including Unicode and negative-looking text", () => {
  const store = createNotebookStore(backend()); store.add(entry("n1", "λₓ\n=HYPERLINK('private')")); store.remember(place);
  assert.deepEqual(JSON.parse(exportNotebookJson(store.getSnapshot().document)), store.getSnapshot().document);
});
test("readable export escapes hostile content and makes no executable or remote asset", () => {
  const store = createNotebookStore(backend()); store.add(entry("n1", '<img src="https://evil.test">\n<script>alert(1)</script>'));
  const html = exportNotebookHtml(store.getSnapshot().document);
  assert.ok(html.includes("&lt;script&gt;")); assert.ok(!html.includes("<script")); assert.ok(!html.includes("<img"));
  assert.match(html, /default-src 'none'/); assert.match(html, /https:\/\/annus-mirabilis.com\/papers\/brownian-motion\/#arg-bm-observable/);
});
test("notebook namespace is the already registered owner key", () => { assert.equal(NOTEBOOK_KEY, "am:notebook:v1"); });
