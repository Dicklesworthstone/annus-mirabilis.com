import { describe, expect, test } from "bun:test";
import { createKeyRegistry } from "../../platform/storage/keys.ts";
import { listQuarantine } from "../../platform/storage/quarantine.ts";
import { createStorageContext } from "../../platform/storage/store.ts";
import { createNotebookStore } from "./notebookStore.ts";
import { NOTEBOOK_KEY, type NotebookEntry } from "./schema.ts";
import { createNotebookStorage } from "./storage.ts";

function fixture() {
  const values = new Map<string, string>();
  const mode = { blocked: false, quota: false };
  const backend: Storage = {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => { values.delete(key); },
    clear: () => { values.clear(); },
    setItem(key, value) {
      if (mode.quota) throw new DOMException("Fixture quota exceeded", "QuotaExceededError");
      values.set(key, value);
    },
  };
  const context = createStorageContext({ getStorage() {
    if (mode.blocked) throw new DOMException("Fixture storage blocked", "SecurityError");
    return backend;
  } });
  return { values, mode, context, storage: createNotebookStorage(context) };
}
function entry(id = "n1"): NotebookEntry {
  return { id, kind: "note", title: "A reading question", text: "Private fixture text",
    createdAt: "2026-09-17T14:00:00.000Z", frame: {
      paper: "brownian-motion", anchor: "arg-bm-observable", view: "reading", detail: 1, lens: "paper", open: "",
    } };
}

describe("notebook with the real shared storage layer", () => {
  test("saves and reloads only its registered namespace", () => {
    const f = fixture(); f.values.set("am:settings:v1:detail", "2");
    createNotebookStore(f.storage).add(entry());
    const reopened = createNotebookStore(createNotebookStorage(f.context)); reopened.open();
    expect(reopened.getSnapshot().document.entries).toEqual([entry()]);
    reopened.clearConfirmed(); expect(f.values.get("am:settings:v1:detail")).toBe("2");
    expect(JSON.parse(f.values.get(NOTEBOOK_KEY)!).entries).toEqual([]);
  });
  test("blocked writes retain session work and recover through writeDocument", () => {
    const f = fixture(); f.mode.blocked = true;
    const store = createNotebookStore(f.storage); store.add(entry());
    expect(store.getSnapshot().persistence).toBe("session-only");
    expect(f.context.fallback.has(NOTEBOOK_KEY)).toBe(true);
    f.mode.blocked = false; store.retry();
    expect(store.getSnapshot().persistence).toBe("saved");
    expect(f.context.fallback.has(NOTEBOOK_KEY)).toBe(false);
  });
  test("an external clear is authoritative even after a quota failure left a fallback", () => {
    const f = fixture(), store = createNotebookStore(f.storage); store.add(entry());
    f.mode.quota = true; store.add(entry("n2"));
    expect(f.context.fallback.has(NOTEBOOK_KEY)).toBe(true);
    f.values.delete(NOTEBOOK_KEY); f.mode.quota = false;
    store.checkForExternalChange(); store.retry();
    expect(store.getSnapshot().persistence).toBe("conflict");
    expect(store.getSnapshot().document.entries.length).toBe(2);
    expect(f.values.has(NOTEBOOK_KEY)).toBe(false);
  });
  test("future versions are quarantined and are never overwritten by normal saving", () => {
    const f = fixture(), raw = JSON.stringify({ schemaVersion: 99, future: "preserve" });
    f.values.set(NOTEBOOK_KEY, raw);
    const store = createNotebookStore(f.storage); store.add(entry()); store.retry();
    expect(f.values.get(NOTEBOOK_KEY)).toBe(raw);
    expect(listQuarantine(f.context).some((e) => e.originalKey === NOTEBOOK_KEY && e.rawValue === raw)).toBe(true);
    expect(store.getSnapshot().recoveryRaw).toBe(raw);
  });
  test("an unregistered notebook namespace cannot be used", () => {
    const f = fixture();
    expect(() => createNotebookStorage({ ...f.context, registry: createKeyRegistry([]) })).toThrow();
  });
});
