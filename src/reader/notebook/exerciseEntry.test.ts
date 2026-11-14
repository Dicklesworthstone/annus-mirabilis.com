import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { createStorageContext } from "../../platform/storage/store.ts";
import { exerciseResponseHref, parseExerciseCapture } from "./exerciseEntry.ts";
import { exportNotebookHtml, exportNotebookJson } from "./export.ts";
import { mergeNotebook } from "./import.ts";
import { migrateExerciseNotebook, readNotebookDocument } from "./migrations/teachBack.ts";
import { createNotebookStore } from "./notebookStore.ts";
import {
  emptyNotebook,
  NOTEBOOK_KEY,
  NOTEBOOK_SCHEMA_VERSION,
  type NotebookExerciseEntry,
  parseNotebookEntry,
} from "./schema.ts";
import { createNotebookStorage } from "./storage.ts";

function entry(id = "response-first", answer = "sqrt(4*D*t)"): NotebookExerciseEntry {
  return {
    id,
    kind: "exercise",
    frame: {
      paper: "brownian-motion",
      anchor: "arg-bm-gaussian",
      view: "reading",
      detail: 1,
      lens: "paper",
      open: "",
    },
    title: "From one displacement axis to two",
    text: answer,
    createdAt: "2026-11-13T12:00:00.000Z",
    exercise: {
      schemaVersion: 1,
      partId: "bm-displacement-scale-rewrite",
      prompt: "How does the spread grow?",
      guideRevision: "3",
      partKind: "expression",
      definitionKey: "the-published-question-and-settings",
      unit: null,
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
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (mode.quota) throw new DOMException("Full", "QuotaExceededError");
      values.set(key, value);
      writes++;
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  const storage = createNotebookStorage(
    createStorageContext({
      getStorage: () => {
        if (mode.blocked) throw new DOMException("Blocked", "SecurityError");
        return backend;
      },
    }),
  );
  return { values, mode, storage, writes: () => writes };
}

describe("private exercise responses in the reading notebook", () => {
  test("version 1 and 2 notebooks open and import without rewriting any prior work or writing on read", () => {
    const { exercise: _exercise, ...saved } = entry();
    const note = { ...saved, kind: "note" };
    const explanation = {
      ...saved,
      id: "explanation",
      kind: "teachBack",
      teachBack: {
        schemaVersion: 1,
        promptId: "bm-in-words",
        prompt: "Why take the square?",
        guideRevision: "3",
      },
    };
    for (const version of [1, 2]) {
      const previous = {
        ...emptyNotebook(),
        schemaVersion: version,
        entries: version === 1 ? [note] : [note, explanation],
        lastPlace: {
          frame: note.frame,
          title: "The Gaussian",
          recap: "The authored recap.",
          recapKind: "authored-recap",
        },
      };
      const raw = JSON.stringify(previous);
      const f = fixture();
      f.values.set(NOTEBOOK_KEY, raw);
      const store = createNotebookStore(f.storage);
      store.open();
      const opened = store.getSnapshot().document;
      expect(store.getSnapshot().persistence).toBe("saved");
      expect(opened.schemaVersion).toBe(NOTEBOOK_SCHEMA_VERSION);
      expect(opened.entries).toEqual(previous.entries);
      expect(opened.lastPlace).toEqual(previous.lastPlace);
      expect(f.writes()).toBe(0);
      expect(f.values.get(NOTEBOOK_KEY)).toBe(raw);
      expect(mergeNotebook(emptyNotebook(), previous).document).toEqual(opened);
      expect(store.add(entry("new-response")).ok).toBe(true);
      expect(store.getSnapshot().document.entries.slice(0, previous.entries.length)).toEqual(
        previous.entries,
      );
      expect(JSON.parse(f.values.get(NOTEBOOK_KEY) ?? "null").schemaVersion).toBe(
        NOTEBOOK_SCHEMA_VERSION,
      );
    }
  });

  test("expression and numeric responses append, retain their question and unit, and survive reload", () => {
    const f = fixture();
    const store = createNotebookStore(f.storage);
    const first = entry();
    const revised = entry("response-revised", "2*sqrt(D*t)");
    const numeric: NotebookExerciseEntry = {
      ...entry("response-numeric", "794.8"),
      exercise: { ...first.exercise, partId: "bm-one-second", partKind: "numeric", unit: "nm" },
    };
    for (const response of [first, revised, numeric]) expect(store.add(response).ok).toBe(true);
    expect(store.updateText(first.id, "replace earlier work").ok).toBe(false);
    const reopened = createNotebookStore(f.storage);
    reopened.open();
    expect(reopened.getSnapshot().document.entries).toEqual([first, revised, numeric]);
    expect([...f.values.keys()]).toEqual([NOTEBOOK_KEY]);
  });

  test("blocked and full storage retain exportable responses in the tab and can retry", () => {
    for (const failure of ["blocked", "quota"] as const) {
      const f = fixture();
      f.mode[failure] = true;
      const store = createNotebookStore(f.storage);
      expect(store.add(entry()).ok).toBe(true);
      expect(store.getSnapshot().persistence).toBe("session-only");
      expect(f.values.has(NOTEBOOK_KEY)).toBe(false);
      expect(JSON.parse(exportNotebookJson(store.getSnapshot().document)).entries).toEqual([
        entry(),
      ]);
      expect(exportNotebookHtml(store.getSnapshot().document)).toContain("sqrt(4*D*t)");
      f.mode[failure] = false;
      expect(store.retry().ok).toBe(true);
      expect(store.getSnapshot().persistence).toBe("saved");
    }
  });

  test("import conflicts retain both question definitions and disclose the changed exercise", () => {
    const f = fixture();
    const store = createNotebookStore(f.storage);
    expect(store.add(entry()).ok).toBe(true);
    const changed = {
      ...entry(),
      exercise: { ...entry().exercise, definitionKey: "later-settings" },
    };
    const preview = store.previewImport({ ...emptyNotebook(), entries: [changed] });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.review.plan.conflicts[0]?.changedFields).toContain("exercise");
    expect(store.commitMerge(preview.review).ok).toBe(true);
    const entries = store.getSnapshot().document.entries;
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual(entry());
    expect(entries[1]?.id).not.toBe(entry().id);
  });

  test("readable export escapes private text and links only to the public exercise", () => {
    const response = {
      ...entry("hostile-response", '<img src="private">'),
      exercise: { ...entry().exercise, prompt: '<script>alert("private")</script>' },
    };
    const html = exportNotebookHtml({ ...emptyNotebook(), entries: [response] });
    expect(html).toContain("&lt;img src=&quot;private&quot;&gt;");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("not a current checker verdict");
    const href = exerciseResponseHref(response.frame.paper, response.exercise);
    expect(href).toBe("/discover/brownian-motion/#exercise-bm-displacement-scale-rewrite");
    expect(href).not.toContain(response.id);
    expect(href).not.toContain("private");
    expect(
      JSON.parse(exportNotebookJson({ ...emptyNotebook(), entries: [response] })).entries[0],
    ).toEqual(response);
  });

  test("notebook-exercise-shape: unknown fields, unsupported papers and prototype records are refused", () => {
    const saved = entry();
    expect(parseExerciseCapture(saved.exercise, saved.frame.paper, saved.text)).toEqual(
      saved.exercise,
    );
    for (const [input, paper] of [
      [{ ...saved.exercise, verdict: "agrees" }, saved.frame.paper],
      [saved.exercise, "molecular-dimensions"],
      [Object.create(saved.exercise), saved.frame.paper],
    ] as const) {
      assert.throws(() => parseExerciseCapture(input, paper, saved.text), {
        name: "ExerciseCaptureError",
        code: "notebook-exercise-shape",
      });
    }
  });

  test("notebook-exercise-accessor: imported capture accessors are never read", () => {
    let reads = 0;
    const saved = entry();
    const accessor = {
      ...saved.exercise,
      get definitionKey() {
        reads++;
        return "changed";
      },
    };
    assert.throws(() => parseExerciseCapture(accessor, saved.frame.paper, saved.text), {
      name: "ExerciseCaptureError",
      code: "notebook-exercise-accessor",
    });
    expect(reads).toBe(0);
  });

  test("notebook-exercise-data: malformed ids, versions, answer budgets and kind/unit mismatches are refused", () => {
    const saved = entry();
    for (const patch of [
      { schemaVersion: 2 },
      { partId: "../private" },
      { partKind: "code" },
      { prompt: "" },
      { guideRevision: "bad/revision" },
      { definitionKey: "x".repeat(32_001) },
      { unit: "nm" },
      { partKind: "numeric", unit: null },
    ]) {
      assert.throws(
        () => parseNotebookEntry({ ...saved, exercise: { ...saved.exercise, ...patch } }),
        { name: "ExerciseCaptureError", code: "notebook-exercise-data" },
      );
    }
    assert.throws(() => parseNotebookEntry({ ...saved, text: "x".repeat(201) }), {
      name: "ExerciseCaptureError",
      code: "notebook-exercise-data",
    });
    assert.throws(
      () =>
        parseNotebookEntry({
          ...saved,
          text: "1".repeat(65),
          exercise: { ...saved.exercise, partKind: "numeric", unit: "nm" },
        }),
      { name: "ExerciseCaptureError", code: "notebook-exercise-data" },
    );
  });

  test("notebook-migration-version: the exercise upgrade requires version 2 and an entry array (teachBack.ts:69)", () => {
    expect(migrateExerciseNotebook({ ...emptyNotebook(), schemaVersion: 2 })).toEqual(
      emptyNotebook(),
    );
    for (const input of [emptyNotebook(), { ...emptyNotebook(), schemaVersion: 2, entries: {} }]) {
      assert.throws(() => migrateExerciseNotebook(input), {
        name: "NotebookMigrationError",
        code: "notebook-migration-version",
      });
    }
  });

  test("notebook-migration-entry: fake legacy exercise entries and sparse arrays are refused unchanged (teachBack.ts:80)", () => {
    for (const entries of [[entry()], Array(1)]) {
      const document = { ...emptyNotebook(), schemaVersion: 2, entries };
      const original = JSON.stringify(document);
      assert.throws(() => readNotebookDocument(document), {
        name: "NotebookMigrationError",
        code: "notebook-migration-entry",
      });
      expect(JSON.stringify(document)).toBe(original);
    }
  });
});
