import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { mountNotebookMergePanel } from "./mergePanel.ts";
import { createNotebookStore } from "./notebookStore.ts";
import { emptyNotebook, NOTEBOOK_LIMITS } from "./schema.ts";

// A deliberately small DOM boundary double for the imperative island. EventTarget/AbortSignal
// are real; layout, native focus behavior, and browser accessibility are NOT measured by this lane.
class ElementDouble extends EventTarget {
  constructor(tag, owner) { super(); this.tag = tag; this.owner = owner; this.children = []; this.parent = null; this.attributes = new Map(); this.style = {}; this.checked = false; this.disabled = false; this.open = false; this.id = ""; this._text = ""; }
  set textContent(value) { this._text = value; for (const c of this.children) c.parent = null; this.children = []; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(""); }
  set innerHTML(_value) { assert.fail("Private notebook data must not be inserted as HTML."); }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  prepend(child) { child.parent = this; this.children.unshift(child); }
  replaceChildren(...children) { this.textContent = ""; this.append(...children); }
  setAttribute(key, value) { this.attributes.set(key, value); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  querySelector(tag) { return descendants(this).find((element) => element.tag === tag) ?? null; }
  focus() { this.owner.activeElement = this; }
  click() { if (!this.disabled) this.dispatchEvent(new Event("click")); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this); this.parent = null; }
}
function descendants(root) { return root.children.flatMap((child) => [child, ...descendants(child)]); }
let oldDocument;
beforeEach(() => {
  oldDocument = globalThis.document;
  globalThis.document = { activeElement: null, createElement(tag) { return new ElementDouble(tag, this); } };
});
afterEach(() => { if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument; });
const frame = { paper: "brownian-motion", anchor: "arg-bm-observable", view: "reading", detail: 1, lens: "paper", open: "" };
const entry = (id, text = id) => ({ id, kind: "note", frame, title: "My reading", text, createdAt: "2026-09-17T14:00:00.000Z" });
const doc = (entries = []) => ({ ...emptyNotebook(), entries });
function mount(current, incoming, source = "file") {
  let raw = JSON.stringify(current), writes = 0, applied = 0, cancelled = 0;
  const store = createNotebookStore({
    maxBytes: 4_000_000,
    read: () => raw === null ? { status: "missing" } : { status: "ok", value: raw },
    write(value) { writes++; raw = JSON.stringify(value); return { status: "ok" }; },
    decode: JSON.parse, preserve() {}, discardFallback() {},
  });
  store.open();
  if (source === "saved") { raw = incoming === null ? null : JSON.stringify(incoming); store.checkForExternalChange(); }
  const prepared = source === "saved" ? store.previewSavedMerge() : store.previewImport(incoming);
  assert.equal(prepared.ok, true, prepared.message);
  const host = document.createElement("div");
  const panel = mountNotebookMergePanel(host, store, prepared.review, () => { applied++; panel.dispose(); }, () => { cancelled++; panel.dispose(); });
  return {
    host, store, panel,
    get writes() { return writes; }, get applied() { return applied; }, get cancelled() { return cancelled; },
    raw: () => raw,
    buttons: () => descendants(host).filter((e) => e.tag === "button"),
    button(label) { const found = this.buttons().find((e) => e.textContent === label); assert.ok(found, label); return found; },
    choices: () => descendants(host).filter((e) => e.tag === "input" && e.type === "checkbox"),
    alert: () => descendants(host).find((e) => e.getAttribute("role") === "alert")?.textContent ?? "",
  };
}

test("opening a merge displays both versions as inert text and never commits", () => {
  const privateText = '<img src="https://evil.test"><script>bad()</script>';
  const h = mount(doc([entry("a", "local")]), doc([entry("a", privateText)]));
  assert.equal(h.writes, 0);
  assert.ok(h.host.textContent.includes("local"));
  assert.ok(h.host.textContent.includes(privateText));
  assert.equal(descendants(h.host).filter((e) => e.tag === "img" || e.tag === "script").length, 0);
  assert.equal(h.choices()[0].checked, true);
  assert.equal(h.buttons().every((b) => b.type === "button"), true);
  h.panel.dispose();
});

test("a per-entry choice changes only the preview until confirmation", () => {
  const h = mount(doc([entry("a", "local")]), doc([entry("a", "incoming"), entry("new")]));
  const choice = h.choices()[0];
  choice.checked = false; choice.dispatchEvent(new Event("change"));
  assert.equal(h.writes, 0);
  assert.match(h.host.textContent, /1 incoming versions left out/);
  h.button("Confirm reviewed import").click();
  assert.equal(h.applied, 1);
  assert.deepEqual(JSON.parse(h.raw()).entries.map((e) => e.text), ["local", "new"]);
});

test("confirming the default keeps both versions and then disposes its listeners", () => {
  const h = mount(doc([entry("a", "local")]), doc([entry("a", "incoming")]));
  const confirm = h.button("Confirm reviewed import");
  confirm.click(); confirm.click();
  assert.equal(h.writes, 1);
  assert.equal(h.applied, 1);
  assert.deepEqual(JSON.parse(h.raw()).entries.map((e) => e.text), ["local", "incoming"]);
});

test("cancel invalidates even a retained old confirm control", () => {
  const h = mount(doc([entry("a")]), doc([entry("b")]));
  const confirm = h.button("Confirm reviewed import");
  h.button("Cancel merge").click(); confirm.click();
  assert.equal(h.cancelled, 1);
  assert.equal(h.writes, 0);
  assert.equal(h.host.children.length, 0);
});

test("stale confirmation reports failure, refreshes, and preserves intervening local work", () => {
  const h = mount(doc([entry("a", "local")]), doc([entry("a", "incoming")]));
  h.store.updateText("a", "a new local edit");
  const writes = h.writes;
  h.button("Confirm reviewed import").click();
  assert.equal(h.writes, writes);
  assert.match(h.alert(), /changed after this preview/);
  h.button("Refresh merge preview").click();
  assert.ok(h.host.textContent.includes("a new local edit"));
  h.button("Confirm reviewed import").click();
  assert.deepEqual(JSON.parse(h.raw()).entries.map((e) => e.text), ["a new local edit", "incoming"]);
});

test("choosing a resolution keeps the opened conflict and requests focus on the same choice", () => {
  const h = mount(doc([entry("a", "local")]), doc([entry("a", "incoming")]));
  const disclosure = descendants(h.host).find((e) => e.tag === "details");
  disclosure.open = true;
  const first = h.choices()[0]; first.checked = false; first.dispatchEvent(new Event("change"));
  assert.equal(descendants(h.host).find((e) => e.tag === "details").open, true);
  assert.equal(document.activeElement, h.choices()[0]);
  assert.equal(h.writes, 0);
  h.panel.dispose();
});

test("an over-capacity review disables confirm and a keep-current choice restores capacity", () => {
  const current = doc(Array.from({ length: NOTEBOOK_LIMITS.entries }, (_, i) => entry(`n${i}`)));
  const h = mount(current, doc([entry("n0", "incoming edit")]));
  assert.equal(h.button("Confirm reviewed import").disabled, true);
  h.button("Confirm reviewed import").click();
  assert.equal(h.writes, 0);
  const choice = h.choices()[0]; choice.checked = false; choice.dispatchEvent(new Event("change"));
  assert.equal(h.button("Confirm reviewed import").disabled, false);
  h.button("Confirm reviewed import").click();
  assert.equal(JSON.parse(h.raw()).entries.length, NOTEBOOK_LIMITS.entries);
});

test("an external clear is named before a reader can explicitly save retained notes", () => {
  const h = mount(doc([entry("local")]), null, "saved");
  assert.match(h.host.textContent, /saved notebook was cleared/);
  assert.match(h.host.textContent, /save this tab's retained entries again/);
  assert.equal(h.raw(), null);
  h.button("Confirm merge and save combined notebook").click();
  assert.equal(JSON.parse(h.raw()).entries[0].id, "local");
});
