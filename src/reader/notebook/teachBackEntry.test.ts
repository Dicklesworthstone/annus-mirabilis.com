import { describe, expect, test } from "bun:test";
import { createStorageContext } from "../../platform/storage/store.ts";
import { exportNotebookHtml, exportNotebookJson } from "./export.ts";
import { mergeNotebook } from "./import.ts";
import { readNotebookDocument } from "./migrations/teachBack.ts";
import { createNotebookStore } from "./notebookStore.ts";
import {
  emptyNotebook,
  NOTEBOOK_KEY,
  type NotebookTeachBackEntry,
  parseNotebookEntry,
} from "./schema.ts";
import { createNotebookStorage } from "./storage.ts";
import { parseTeachBackCapture, teachBackHref } from "./teachBackEntry.ts";

function entry(
  id = "explanation-first",
  answer = "The squared displacements add.",
): NotebookTeachBackEntry {
  return {
    id,
    kind: "teachBack",
    frame: {
      paper: "brownian-motion",
      anchor: "arg-bm-gaussian",
      view: "reading",
      detail: 1,
      lens: "paper",
      open: "",
    },
    title: "Why the spread grows as the square root of time",
    text: answer,
    createdAt: "2026-11-12T12:00:00.000Z",
    teachBack: {
      schemaVersion: 1,
      promptId: "bm-square-root-in-words",
      prompt: "Why does the spread grow as the square root of time?",
      guideRevision: "3",
    },
  };
}

function fixture() {
  const values = new Map<string, string>();
  const mode = { blocked: false, quota: false };
  let writes = 0;
  const backend: Storage = {
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index] ?? null,
    clear: () => {
      values.clear();
    },
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (mode.quota) throw new DOMException("Full", "QuotaExceededError");
      writes++;
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const context = createStorageContext({
    getStorage: () => {
      if (mode.blocked) throw new DOMException("Blocked", "SecurityError");
      return backend;
    },
  });
  const storage = createNotebookStorage(context);
  return { values, mode, storage, writes: () => writes };
}

describe("saved teach-back explanations use the reading notebook", () => {
  test("a version 1 notebook opens and imports without changing its earlier work or writing on read", () => {
    const oldEntry = { ...entry(), kind: "note" } as Record<string, unknown>;
    delete oldEntry.teachBack;
    const old = {
      ...emptyNotebook(),
      schemaVersion: 1,
      entries: [oldEntry],
      lastPlace: {
        frame: entry().frame,
        title: "The Gaussian",
        recap: "The authored recap.",
        recapKind: "authored-recap",
      },
    };
    const raw = JSON.stringify(old);
    const f = fixture();
    f.values.set(NOTEBOOK_KEY, raw);
    const store = createNotebookStore(f.storage);
    store.open();
    const opened = store.getSnapshot().document;
    expect(opened.schemaVersion).toBe(2);
    expect(opened.entries).toEqual(old.entries);
    expect(opened.lastPlace).toEqual(old.lastPlace);
    expect(f.writes()).toBe(0);
    expect(f.values.get(NOTEBOOK_KEY)).toBe(raw);
    expect(mergeNotebook(emptyNotebook(), old).document).toEqual(opened);
    expect(store.add(entry()).ok).toBe(false); // A duplicate id must not replace earlier work.
    expect(store.add(entry("new-explanation")).ok).toBe(true);
    const saved = f.values.get(NOTEBOOK_KEY);
    if (!saved) throw new Error("The upgraded notebook was not saved.");
    expect(JSON.parse(saved).schemaVersion).toBe(2);
    expect(store.getSnapshot().document.entries[0]).toEqual(oldEntry);
  });

  test("answers append, survive reload and retain their saved question and revision", () => {
    const f = fixture();
    const store = createNotebookStore(f.storage);
    const first = entry();
    const revised = entry(
      "explanation-revised",
      "Independent increments add variances; the spread is their square root.",
    );
    expect(store.add(first).ok).toBe(true);
    expect(store.add(revised).ok).toBe(true);
    expect(store.updateText(first.id, "replace earlier reasoning").ok).toBe(false);
    const reopened = createNotebookStore(f.storage);
    reopened.open();
    expect(reopened.getSnapshot().document.entries).toEqual([first, revised]);
    expect([...f.values.keys()]).toEqual([NOTEBOOK_KEY]);
  });

  test("blocked storage and quota preserve full answers in the tab and export", () => {
    for (const failure of ["blocked", "quota"] as const) {
      const f = fixture();
      f.mode[failure] = true;
      const store = createNotebookStore(f.storage);
      const answer = entry();
      expect(store.add(answer).ok).toBe(true);
      expect(store.getSnapshot().persistence).toBe("session-only");
      expect(f.values.has(NOTEBOOK_KEY)).toBe(false);
      expect(JSON.parse(exportNotebookJson(store.getSnapshot().document)).entries).toEqual([
        answer,
      ]);
      f.mode[failure] = false;
      expect(store.retry().ok).toBe(true);
      expect(store.getSnapshot().persistence).toBe("saved");
    }
  });

  test("future notebooks and an external update remain protected from new explanation saves", () => {
    const f = fixture();
    const future = JSON.stringify({ ...emptyNotebook(), schemaVersion: 99, newField: "preserve" });
    f.values.set(NOTEBOOK_KEY, future);
    const protectedStore = createNotebookStore(f.storage);
    expect(protectedStore.add(entry()).ok).toBe(true);
    expect(protectedStore.getSnapshot().persistence).toBe("protected");
    expect(protectedStore.getSnapshot().recoveryRaw).toBe(future);
    expect(f.values.get(NOTEBOOK_KEY)).toBe(future);

    const second = fixture();
    const store = createNotebookStore(second.storage);
    store.open();
    const elsewhere = JSON.stringify({ ...emptyNotebook(), entries: [entry("other-tab")] });
    second.values.set(NOTEBOOK_KEY, elsewhere);
    expect(store.add(entry()).ok).toBe(true);
    expect(store.getSnapshot().persistence).toBe("conflict");
    expect(second.values.get(NOTEBOOK_KEY)).toBe(elsewhere);
    expect(store.getSnapshot().document.entries).toEqual([entry()]);
  });

  test("imports retain conflicting versions of the saved question and disclose that difference", () => {
    const f = fixture();
    const store = createNotebookStore(f.storage);
    const first = entry();
    store.add(first);
    const changed = {
      ...first,
      teachBack: { ...first.teachBack, guideRevision: "4", prompt: "A later question." },
    };
    const preview = store.previewImport({ ...emptyNotebook(), entries: [changed] });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.review.plan.conflicts[0]?.changedFields).toContain("teachBack");
    expect(store.commitMerge(preview.review).ok).toBe(true);
    expect(store.getSnapshot().document.entries).toHaveLength(2);
    expect(store.getSnapshot().document.entries[0]).toEqual(first);
  });

  test("readable exports escape both the question and answer and return to the exact public question", () => {
    const saved = {
      ...entry(),
      text: "<script>private answer</script>",
      teachBack: { ...entry().teachBack, prompt: '<img src="private">?' },
    };
    const html = exportNotebookHtml({ ...emptyNotebook(), entries: [saved] });
    expect(html).toContain("&lt;script&gt;private answer&lt;/script&gt;");
    expect(html).toContain("&lt;img src=&quot;private&quot;&gt;?");
    expect(html).not.toContain("<script>");
    const href = teachBackHref(saved.frame.paper, saved.teachBack);
    expect(href).toBe("/discover/brownian-motion/#explanation-bm-square-root-in-words");
    expect(html).toContain(`https://annus-mirabilis.com${href}`);
    expect(href).not.toContain("private");
    expect(href).not.toContain(saved.id);
  });

  test("malformed captures, accessor fields and fake old-version teach-backs are refused", () => {
    const saved = entry();
    for (const patch of [
      { schemaVersion: 2 },
      { promptId: "../question?answer=private" },
      { prompt: "" },
      { guideRevision: "" },
      { unknown: true },
    ])
      expect(() =>
        parseNotebookEntry({ ...saved, teachBack: { ...saved.teachBack, ...patch } }),
      ).toThrow();
    let reads = 0;
    const accessor = {
      ...saved.teachBack,
      get prompt() {
        reads++;
        return "do not read";
      },
    };
    expect(() => parseTeachBackCapture(accessor, saved.frame.paper)).toThrow();
    expect(reads).toBe(0);
    expect(() =>
      parseNotebookEntry({ ...saved, frame: { ...saved.frame, paper: "molecular-dimensions" } }),
    ).toThrow();
    expect(() =>
      readNotebookDocument({ ...emptyNotebook(), schemaVersion: 1, entries: [saved] }),
    ).toThrow();
    expect(() => readNotebookDocument({ ...emptyNotebook(), schemaVersion: 99 })).toThrow();
    expect(() =>
      readNotebookDocument({ ...emptyNotebook(), schemaVersion: 1, extra: "preserve" }),
    ).toThrow();
  });
});
