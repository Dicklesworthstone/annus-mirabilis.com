import assert from "node:assert/strict";
import test from "node:test";
import { emptyNotebook, notebookFrameHref, parseNotebookDocument, parseNotebookEntry,
  parseNotebookFrame, NOTEBOOK_LIMITS } from "./schema.ts";
export const frame = { paper: "brownian-motion", anchor: "arg-bm-observable", view: "reading",
  detail: 1, lens: "paper", open: "" };
export function entry(patch = {}) { return { id: "entry-1", kind: "note", frame: { ...frame },
  title: "What should I measure?", text: "My question", createdAt: "2026-09-17T14:00:00.000Z", ...patch }; }
export function document(entries = [entry()]) { return { ...emptyNotebook(), entries }; }

test("a parsed notebook is detached and deeply immutable", () => {
  const input = document(), parsed = parseNotebookDocument(input);
  input.entries[0].frame.detail = 2; input.entries[0].text = "changed";
  assert.equal(parsed.entries[0].frame.detail, 1); assert.equal(parsed.entries[0].text, "My question");
  assert.ok(Object.isFrozen(parsed)); assert.ok(Object.isFrozen(parsed.entries));
  assert.ok(Object.isFrozen(parsed.entries[0].frame));
});
for (const kind of ["question", "example", "nextStep", "note"]) {
  test(`supports ${kind} without interpreting the reader's words`, () => {
    const text = '<script>alert("not executed")</script> and a question?';
    assert.equal(parseNotebookEntry(entry({ kind, text })).text, text);
  });
}
test("future and unknown notebook fields are refused, not stripped", () => {
  for (const input of [{ ...document(), schemaVersion: 2 }, { ...document(), future: true },
    { schemaVersion: 1, entries: [] }, { ...document(), format: "other-owner" }])
    assert.throws(() => parseNotebookDocument(input));
});
test("duplicate ids and oversized entry collections are refused", () => {
  assert.throws(() => parseNotebookDocument(document([entry(), entry()])));
  assert.throws(() => parseNotebookDocument(document(Array.from({ length: 101 }, (_, i) => entry({ id: `n-${i}` })))));
});
test("bounded text accepts the exact limit and rejects one character more", () => {
  assert.equal(parseNotebookEntry(entry({ text: "x".repeat(NOTEBOOK_LIMITS.text) })).text.length, 4000);
  for (const text of ["", " ", "x".repeat(4001), "bad\u0000data"])
    assert.throws(() => parseNotebookEntry(entry({ text })));
});
test("invalid and noncanonical dates are rejected", () => {
  for (const createdAt of ["tomorrow", "2026-02-30T00:00:00.000Z", "2026-01-01", 42])
    assert.throws(() => parseNotebookEntry(entry({ createdAt })));
});
test("accessors and exotic objects never enter the local schema", () => {
  const object = entry(); Object.defineProperty(object, "text", { get() { throw Error("getter ran"); } });
  assert.throws(() => parseNotebookEntry(object), /Unknown or missing/);
  assert.throws(() => parseNotebookEntry(new Date()));
});
test("frame URLs preserve supported reading and clarification state", () => {
  assert.equal(notebookFrameHref(frame), "/papers/brownian-motion/#arg-bm-observable");
  assert.equal(notebookFrameHref({ ...frame, view: "english", detail: 2, lens: "modern", open: "foundation:mean-square" }),
    "/papers/brownian-motion/?view=english&detail=2&lens=modern&open=foundation%3Amean-square#arg-bm-observable");
});
test("frame URL injection, private extra fields, and arbitrary routes are rejected", () => {
  for (const patch of [{ paper: "//evil.test" }, { anchor: "x?note=secret" },
    { open: "foundation:x&notes=secret" }, { view: "javascript:alert(1)" }, { detail: "2" },
    { note: "private" }, { open: "https://evil.test" }])
    assert.throws(() => notebookFrameHref({ ...frame, ...patch }));
});
test("only the supported portable clarification is admitted", () => {
  assert.equal(parseNotebookFrame({ ...frame, open: "foundation:probability" }).open, "foundation:probability");
  assert.throws(() => parseNotebookFrame({ ...frame, open: "run:123" }));
});
test("last-place records retain authored recap or labeled overview, not a fabricated summary", () => {
  for (const recapKind of ["authored-recap", "overview"]) {
    const doc = parseNotebookDocument({ ...document(), lastPlace: { frame, title: "The observable", recap: "An authored recap.", recapKind } });
    assert.equal(doc.lastPlace.recapKind, recapKind);
  }
  assert.throws(() => parseNotebookDocument({ ...document(), lastPlace: { frame, title: "T", recap: "R", recapKind: "generated" } }));
});
