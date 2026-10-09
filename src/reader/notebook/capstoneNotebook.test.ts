import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Capstone } from "../../discovery/capstone/capstoneSchema.ts";
import { saveCapstoneSnapshot } from "../../discovery/capstone/notebookControls.ts";
import { emptyWorksheet, readWorksheet } from "../../discovery/capstone/worksheetState.ts";
import { captureCapstone, CapstoneCaptureError } from "./capstoneEntry.ts";
import { exportNotebookHtml, exportNotebookJson } from "./export.ts";
import { mergeNotebook } from "./import.ts";
import type { NotebookStore, NotebookState } from "./notebookStore.ts";
import { emptyNotebook, parseNotebookDocument, parseNotebookEntry } from "./schema.ts";

const capstone: Capstone = {
  id: "capstone-test",
  paper: "mass-energy",
  title: "Reconstruct the two ledgers",
  question: "Why?",
  claims: [
    {
      id: "c1",
      text: "Subtract the ledgers.",
      anchor: "s0-p1",
      logicalRole: "derivation",
      buildsOn: [],
      assumptionIds: ["a1"],
    },
  ],
  paperOrder: ["c1"],
  startOrder: ["c1"],
  presets: [],
  equations: [{ equationId: "eq-ledger", purpose: "Explain" }],
  assumptions: [{ id: "a1", statement: "The body is the system.", kind: "boundary-choice" }],
  explanationPrompt: "Explain the cancellation.",
  selfCheckNotes: {},
  limits: "",
  reviewRecordIds: [],
};
const equations = [{ equationId: "eq-ledger", title: "The ledger" }];
const worksheet = {
  ...emptyWorksheet(capstone),
  explanation: "<script>alert('private')</script> π",
  annotations: { "eq-ledger": "<img src=x onerror=alert(1)>", "old-term": "Preserve this" },
  assumptionMarks: { c1: ["a1"] },
  table: [["<a href='https://bad.invalid'>", "1 & 2"]],
};
const entry = {
  id: "attempt-1",
  kind: "capstone" as const,
  frame: {
    paper: "mass-energy" as const,
    anchor: "s0-p1",
    view: "parallel" as const,
    detail: 1 as const,
    lens: "paper" as const,
    open: "",
  },
  title: capstone.title,
  text: "",
  createdAt: "2026-10-07T03:00:00.000Z",
  capstone: captureCapstone(capstone, worksheet, equations),
};

test("the notebook admits a typed capstone and old text notes together without flattening either", () => {
  const note = {
    id: "note-1",
    kind: "note",
    frame: entry.frame,
    title: "Existing note",
    text: "Do not alter",
    createdAt: entry.createdAt,
  };
  const document = parseNotebookDocument({ ...emptyNotebook(), entries: [note, entry] });
  const reopened = parseNotebookDocument(JSON.parse(exportNotebookJson(document)));
  assert.deepEqual(reopened, document);
  assert.equal(reopened.entries[1]?.kind, "capstone");
  assert.deepEqual(reopened.entries[1], entry);
  assert.equal(reopened.entries[0]?.text, "Do not alter");
});

test("notebook-capstone-invalid: paper mismatches, missing payloads and stray replay data are rejected", () => {
  assert.throws(
    () => parseNotebookEntry({ ...entry, frame: { ...entry.frame, paper: "light-quanta" } }),
    CapstoneCaptureError,
  );
  const { capstone: _capture, ...without } = entry;
  assert.throws(() => parseNotebookEntry(without));
  assert.throws(() => parseNotebookEntry({ ...entry, replay: {} }));
  assert.throws(() => parseNotebookEntry({ ...entry, kind: "note" }));
});

test("readable export escapes every private payload and links only to the public capstone", () => {
  const html = exportNotebookHtml({ ...emptyNotebook(), entries: [entry] });
  assert.ok(html.includes("&lt;script&gt;alert(&#39;private&#39;)&lt;/script&gt; π"));
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
  assert.ok(html.includes("Preserve this"));
  assert.ok(html.includes("1 &amp; 2"));
  assert.ok(
    html.includes('href="https://annus-mirabilis.com/capstones/mass-energy/#capstone-worksheet"'),
  );
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img "));
  assert.ok(!html.includes("?attempt"));
});

test("import roundtrips the worksheet and refuses an edited same-id attempt without changing the current notebook", () => {
  const document = parseNotebookDocument({ ...emptyNotebook(), entries: [entry] });
  const imported = mergeNotebook(emptyNotebook(), JSON.parse(exportNotebookJson(document)));
  assert.deepEqual(imported.document, document);
  assert.equal(mergeNotebook(document, imported.document).duplicates, 1);
  assert.throws(() =>
    mergeNotebook(document, {
      ...document,
      entries: [
        {
          ...entry,
          capstone: {
            ...entry.capstone,
            worksheet: { ...worksheet, explanation: "different work" },
          },
        },
      ],
    }),
  );
  assert.equal(document.entries[0]?.kind, "capstone");
  assert.deepEqual(readWorksheet(entry.capstone.worksheet), worksheet);
});

/** Only the I/O-facing port is controlled here; production capture and notebook admission run unchanged. */
function port(persistence: NotebookState["persistence"] = "saved", reject = false) {
  let state: NotebookState = {
    document: emptyNotebook(),
    persistence,
    message: `${persistence}: keep an export`,
    recoveryRaw: null,
  };
  let writes = 0;
  const store: Pick<
    NotebookStore,
    "open" | "getSnapshot" | "subscribe" | "add" | "checkForExternalChange"
  > = {
    open() {},
    getSnapshot: () => state,
    subscribe: () => () => {},
    checkForExternalChange() {},
    add(input) {
      writes++;
      if (reject) return { ok: false, message: "Notebook is full; no entries discarded." };
      state = {
        ...state,
        document: parseNotebookDocument({
          ...state.document,
          entries: [...state.document.entries, input],
        }),
      };
      return { ok: true };
    },
  };
  return { store, writes: () => writes };
}

test("snapshot saving uses the notebook's persistence status and never claims unavailable storage was saved", () => {
  for (const status of ["saved", "session-only", "protected", "conflict"] as const) {
    const { store, writes } = port(status);
    const result = saveCapstoneSnapshot(store, capstone, worksheet, equations, entry);
    assert.equal(result.ok, true);
    assert.equal(result.message, `${status}: keep an export`);
    assert.equal(writes(), 1);
    assert.equal(store.getSnapshot().document.entries[0]?.kind, "capstone");
  }
});

test("unchanged attempts are not duplicated, but revised explanations become separate snapshots", () => {
  const { store, writes } = port();
  assert.equal(saveCapstoneSnapshot(store, capstone, worksheet, equations, entry).ok, true);
  assert.match(
    saveCapstoneSnapshot(store, capstone, worksheet, equations, { ...entry, id: "attempt-2" })
      .message,
    /already in/,
  );
  assert.equal(writes(), 1);
  assert.equal(
    saveCapstoneSnapshot(
      store,
      capstone,
      { ...worksheet, explanation: "I reconsidered" },
      equations,
      { ...entry, id: "attempt-3" },
    ).ok,
    true,
  );
  assert.equal(writes(), 2);
  assert.equal(store.getSnapshot().document.entries.length, 2);
});

test("capacity failures leave the working worksheet intact and are reported rather than called success", () => {
  const { store } = port("saved", true);
  const before = JSON.stringify(worksheet);
  const result = saveCapstoneSnapshot(store, capstone, worksheet, equations, entry);
  assert.equal(result.ok, false);
  assert.match(result.message, /full/);
  assert.equal(JSON.stringify(worksheet), before);
  assert.equal(store.getSnapshot().document.entries.length, 0);
});
