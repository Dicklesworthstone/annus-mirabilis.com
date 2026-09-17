import assert from "node:assert/strict";
import test from "node:test";
import { mergeNotebook } from "./import.ts";
import { createNotebookStore } from "./notebookStore.ts";
import { emptyNotebook } from "./schema.ts";

const frame = {
  paper: "brownian-motion",
  anchor: "arg-bm-observable",
  view: "reading",
  detail: 1,
  lens: "paper",
  open: "",
};
const entry = (id, text = "A question") => ({
  id,
  kind: "note",
  frame,
  title: "The observable",
  text,
  createdAt: "2026-09-17T14:00:00.000Z",
});
const document = (entries = []) => ({ ...emptyNotebook(), entries });
const place = {
  frame,
  title: "The observable",
  recap: "The squares add.",
  recapKind: "authored-recap",
};

test("exported entries merge locally and identical ids are deduplicated", () => {
  const merged = mergeNotebook(document([entry("a")]), document([entry("a"), entry("b")]));
  assert.equal(merged.added, 1);
  assert.equal(merged.duplicates, 1);
  assert.deepEqual(
    merged.document.entries.map((e) => e.id),
    ["a", "b"],
  );
});
test("property order in an exported document does not create false conflicts", () => {
  const reordered = Object.fromEntries(Object.entries(entry("a")).reverse());
  assert.equal(mergeNotebook(document([entry("a")]), document([reordered])).duplicates, 1);
});
test("different text at an existing id is rejected rather than overwritten", () => {
  const original = document([entry("a")]);
  assert.throws(() =>
    mergeNotebook(original, document([entry("b"), entry("a", "Other private work")])),
  );
  assert.equal(original.entries.length, 1);
  assert.equal(original.entries[0].text, "A question");
});
test("the current reading place wins; an empty notebook can recover an exported place", () => {
  const current = { ...document(), lastPlace: place };
  const imported = { ...document(), lastPlace: { ...place, title: "A different place" } };
  assert.deepEqual(mergeNotebook(current, imported).document.lastPlace, place);
  assert.deepEqual(mergeNotebook(document(), imported).document.lastPlace, imported.lastPlace);
});
test("future or unknown shapes are refused by the same persisted-document validator", () => {
  for (const input of [
    { schemaVersion: 99 },
    { ...document(), unexpected: "hidden data" },
    null,
    [],
  ])
    assert.throws(() => mergeNotebook(document(), input));
});
test("merged entry count is bounded without truncation", () => {
  const imported = document(Array.from({ length: 100 }, (_, i) => entry(`n${i}`)));
  assert.throws(() => mergeNotebook(document([entry("existing")]), imported));
  assert.equal(imported.entries.length, 100);
});
test("confirmed import uses persistence limits and preserves memory on storage failure", () => {
  let raw = null;
  let quota = false;
  const store = createNotebookStore({
    maxBytes: 64000,
    read: () => (raw === null ? { status: "missing" } : { status: "ok", value: raw }),
    write: (doc) => {
      if (quota) return { status: "quota" };
      raw = JSON.stringify(doc);
      return { status: "ok" };
    },
    decode: JSON.parse,
    preserve() {},
    discardFallback() {},
  });
  store.add(entry("existing"));
  quota = true;
  assert.equal(store.importConfirmed(document([entry("imported")])).ok, true);
  assert.equal(store.getSnapshot().document.entries.length, 2);
  assert.equal(store.getSnapshot().persistence, "session-only");
  quota = false;
  store.retry();
  assert.equal(JSON.parse(raw).entries.length, 2);
});
test("oversized merged document is refused before writing", () => {
  let writes = 0;
  const store = createNotebookStore({
    maxBytes: 1000,
    read: () => ({ status: "missing" }),
    write() {
      writes++;
      return { status: "ok" };
    },
    decode: JSON.parse,
    preserve() {},
    discardFallback() {},
  });
  assert.equal(store.importConfirmed(document([entry("a", "x".repeat(1000))])).ok, false);
  assert.equal(writes, 0);
  assert.equal(store.getSnapshot().document.entries.length, 0);
});
