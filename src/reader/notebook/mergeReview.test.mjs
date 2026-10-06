import assert from "node:assert/strict";
import test from "node:test";
import {
  createNotebookMergeController,
  NotebookMergeError,
  planNotebookMerge,
} from "./mergeReview.ts";

// This lane tests the merge algorithm and review protocol on canonical documents. Admission and
// persistence are ports here; mergeReview.integration.test.mjs exercises the real schema and store.
const frame = Object.freeze({
  paper: "brownian-motion",
  anchor: "arg-bm-observable",
  view: "reading",
  detail: 1,
  lens: "paper",
  open: "",
});
const entry = (id, text = id, patch = {}) =>
  Object.freeze({
    id,
    kind: "note",
    frame,
    title: "My reading",
    text,
    createdAt: "2026-09-20T10:00:00.000Z",
    ...patch,
  });
const document = (entries = [], lastPlace = null) =>
  Object.freeze({
    format: "annus-reading-notebook",
    schemaVersion: 1,
    entries: Object.freeze(entries),
    lastPlace,
  });
const plan = (current, incoming, choices = new Map(), limit = 500) =>
  planNotebookMerge(current, incoming, limit, choices);
const allContent = (e) => {
  const { id, ...rest } = e;
  return rest;
};
const place = {
  frame,
  title: "Current reading",
  recap: "A spread need not have a nonzero mean.",
  recapKind: "overview",
};

test("edited copies preserve both full versions without replacing any current work", () => {
  const left = document([entry("shared", "local work"), entry("only-local")], place);
  const right = document([entry("shared", "other device"), entry("only-file")]);
  const got = plan(left, right);
  assert.deepEqual(got.document.entries.slice(0, 2), left.entries);
  assert.equal(got.added, 2);
  assert.equal(got.keptBoth, 1);
  assert.equal(got.skipped, 0);
  assert.deepEqual(allContent(got.document.entries[2]), allContent(right.entries[0]));
  assert.deepEqual(got.conflicts[0].changedFields, ["text"]);
  assert.equal(got.document.lastPlace, place);
  assert.equal(left.entries.length, 2);
  assert.equal(right.entries[0].id, "shared");
  assert.ok(Object.isFrozen(got.document.entries));
  assert.ok(Object.isFrozen(got.conflicts[0]));
});

test("reimporting an edited version recognizes the preserved copy", () => {
  const source = document([entry("a", "imported")]);
  const first = plan(document([entry("a", "local")]), source);
  const second = plan(first.document, source);
  assert.equal(second.added, 0);
  assert.equal(second.duplicates, 1);
  assert.equal(second.conflicts.length, 0);
  assert.deepEqual(second.document, first.document);
});

test("different edits of the same entry remain separate and each reimports idempotently", () => {
  let current = document([entry("a", "original")]);
  const sources = ["edit one", "edit two", "edit three"].map((text) =>
    document([entry("a", text)]),
  );
  for (const source of sources) current = plan(current, source).document;
  assert.equal(current.entries.length, 4);
  for (const source of sources) assert.equal(plan(current, source).added, 0);
  assert.equal(new Set(current.entries.map((e) => e.id)).size, 4);
});

test("explicitly leaving an incoming version out does not block unrelated additions", () => {
  const current = document([entry("a", "mine")]);
  const imported = document([entry("a", "theirs"), entry("b")]);
  const got = plan(current, imported, new Map([["a", "keep-current"]]));
  assert.equal(got.added, 1);
  assert.equal(got.skipped, 1);
  assert.equal(got.keptBoth, 0);
  assert.equal(got.conflicts[0].copiedId, null);
  assert.deepEqual(
    got.document.entries.map((e) => e.text),
    ["mine", "b"],
  );
});

test("new timestamps are not permission to overwrite earlier work", () => {
  const current = document([entry("a", "earlier")]);
  const imported = document([entry("a", "later", { createdAt: "2026-10-06T10:00:00.000Z" })]);
  const got = plan(current, imported);
  assert.deepEqual(got.conflicts[0].changedFields, ["text", "createdAt"]);
  assert.equal(got.document.entries[0].text, "earlier");
  assert.equal(got.document.entries[1].createdAt, imported.entries[0].createdAt);
});

test("equality includes source frame, kind, title and every nested replay value", () => {
  const a = entry("a", "", {
    kind: "replay",
    replay: {
      before: "first",
      tape: { seed: "18446744073709551615", initialConditions: { radius: 1.000000000001e-9 } },
    },
  });
  const b = entry("a", "", {
    kind: "replay",
    replay: {
      before: "first",
      tape: { seed: "18446744073709551615", initialConditions: { radius: 1.000000000002e-9 } },
    },
  });
  const got = plan(document([a]), document([b]));
  assert.equal(got.keptBoth, 1);
  assert.deepEqual(got.conflicts[0].changedFields, ["replay"]);
  assert.deepEqual(allContent(got.document.entries[1]), allContent(b));
  for (const patch of [
    { frame: { ...frame, lens: "modern" } },
    { kind: "question" },
    { title: "A different title" },
  ]) {
    assert.equal(plan(document([entry("x")]), document([entry("x", "x", patch)])).keptBoth, 1);
  }
});

test("structurally equal data in a different property order is not an edited version", () => {
  const a = entry("a");
  const b = {
    createdAt: a.createdAt,
    text: a.text,
    title: a.title,
    frame: Object.fromEntries(Object.entries(frame).reverse()),
    kind: a.kind,
    id: a.id,
  };
  const got = plan(document([a]), document([b]));
  assert.equal(got.duplicates, 1);
  assert.equal(got.added, 0);
});

test("equal text under independent ids remains independent reader work", () => {
  const got = plan(document([entry("one", "same words")]), document([entry("two", "same words")]));
  assert.equal(got.added, 1);
  assert.equal(got.duplicates, 0);
});

test("copy ids are bounded, deterministic, and never use a timestamp or random source", () => {
  const a = document([entry("x".repeat(80), "local")]);
  const b = document([entry("x".repeat(80), "imported")]);
  const first = plan(a, b),
    second = plan(a, b);
  const id = first.document.entries[1].id;
  assert.match(id, /^[a-zA-Z0-9_-]{1,80}$/);
  assert.deepEqual(first, second);
});

test("a conflicting generated id is checked by full content, never mistaken for a duplicate", () => {
  const imported = document([entry("a", "incoming")]);
  const preview = plan(document([entry("a", "mine")]), imported);
  const generatedId = preview.document.entries[1].id;
  const current = document([entry("a", "mine"), entry(generatedId, "unrelated")]);
  const got = plan(current, imported);
  assert.equal(got.keptBoth, 1);
  assert.equal(got.duplicates, 0);
  assert.equal(got.document.entries[1].text, "unrelated");
  assert.notEqual(got.document.entries[2].id, generatedId);
});

test("a later imported entry reserves its own id before a conflict allocates a copy", () => {
  const current = document([entry("a", "mine")]);
  const variant = entry("a", "incoming");
  const reservedId = plan(current, document([variant])).document.entries[1].id;
  const got = plan(current, document([variant, entry(reservedId, "separate work")]));
  assert.equal(got.added, 2);
  assert.equal(new Set(got.document.entries.map((e) => e.id)).size, 3);
  assert.equal(got.document.entries[2].id, reservedId);
});

test("reimport does not multiply a retained copy when an earlier allocation obstacle was removed", () => {
  const imported = document([entry("a", "incoming")]);
  const original = entry("a", "mine");
  const candidate = plan(document([original]), imported).document.entries[1].id;
  const collision = plan(document([original, entry(candidate, "unrelated")]), imported);
  const retained = document([original, collision.document.entries[2]]);
  const again = plan(retained, imported);
  assert.equal(again.added, 0);
  assert.equal(again.duplicates, 1);
});

test("empty inputs and last-place precedence are explicit", () => {
  assert.equal(plan(document(), document()).added, 0);
  assert.equal(plan(document(), document([], place)).document.lastPlace, place);
  const another = { ...place, title: "other place" };
  assert.equal(plan(document([], place), document([], another)).document.lastPlace, place);
});

test("capacity counts copied versions and offers a review rather than truncating anything", () => {
  const left = document([entry("a", "mine"), entry("b")]);
  const right = document([entry("a", "theirs"), entry("c")]);
  const got = plan(left, right, new Map(), 3);
  assert.equal(got.withinLimit, false);
  assert.equal(got.document.entries.length, 4);
  const narrowed = plan(left, right, new Map([["a", "keep-current"]]), 3);
  assert.equal(narrowed.withinLimit, true);
  assert.equal(narrowed.document.entries.length, 3);
});

test("every incoming item is accounted for exactly once", () => {
  const left = document([entry("same"), entry("copy", "mine"), entry("skip", "mine")]);
  const right = document([
    entry("same"),
    entry("copy", "theirs"),
    entry("skip", "theirs"),
    entry("new"),
  ]);
  const got = plan(left, right, new Map([["skip", "keep-current"]]));
  assert.equal(got.added + got.duplicates + got.skipped, right.entries.length);
  assert.equal(got.document.entries.length, left.entries.length + got.added);
  assert.equal(got.keptBoth + got.skipped, got.conflicts.length);
});

test("notebook-merge-choice-invalid: runtime choices cannot silently discard an incoming version", () => {
  assert.throws(
    () =>
      plan(
        document([entry("a", "mine")]),
        document([entry("a", "theirs")]),
        new Map([["a", "overwrite"]]),
      ),
    (error) =>
      error instanceof NotebookMergeError && error.code === "notebook-merge-choice-invalid",
  );
});

function harness(initial = document(), limit = 500) {
  let local = initial;
  let savedDocument = initial;
  let raw = JSON.stringify(initial);
  let writes = 0;
  let admitted = 0;
  let refusal = null;
  const controller = createNotebookMergeController({
    entryLimit: limit,
    admit(input) {
      admitted++;
      if (!input || input.format !== "annus-reading-notebook")
        throw new Error("Admission refused this document.");
      return structuredClone(input);
    },
    current: () => local,
    saved: () => ({ document: savedDocument, raw }),
    commit(next, lease) {
      if (refusal) return { ok: false, message: refusal };
      if (lease && lease.raw !== raw)
        return { ok: false, message: "Storage changed before the write." };
      local = next;
      savedDocument = next;
      raw = JSON.stringify(next);
      writes++;
      return { ok: true };
    },
  });
  return {
    controller,
    get local() {
      return local;
    },
    get writes() {
      return writes;
    },
    get admitted() {
      return admitted;
    },
    edit(next) {
      local = next;
    },
    external(next) {
      savedDocument = next;
      raw = JSON.stringify(next);
    },
    clearExternal() {
      savedDocument = document();
      raw = null;
    },
    refuse(message) {
      refusal = message;
    },
  };
}
const reviewed = (result) => {
  assert.equal(result.ok, true, result.message);
  return result.review;
};

test("preview and changing choices perform no writes; confirmation admits the result again", () => {
  const h = harness(document([entry("a", "mine")]));
  const first = reviewed(h.controller.previewImport(document([entry("a", "theirs"), entry("b")])));
  const revised = reviewed(h.controller.reviseMerge(first, new Map([["a", "keep-current"]])));
  assert.equal(h.writes, 0);
  assert.equal(h.controller.commitMerge(first).ok, false);
  const before = h.admitted;
  assert.equal(h.controller.commitMerge(revised).ok, true);
  assert.ok(h.admitted > before);
  assert.equal(h.writes, 1);
  assert.deepEqual(
    h.local.entries.map((e) => e.text),
    ["mine", "b"],
  );
});

test("a consumed, cancelled, forged, or another store's review never commits", () => {
  const h = harness();
  const preview = reviewed(h.controller.previewImport(document([entry("a")])));
  assert.equal(h.controller.commitMerge({ ...preview }).ok, false);
  assert.equal(harness().controller.commitMerge(preview).ok, false);
  h.controller.cancelMerge(preview);
  assert.equal(h.controller.commitMerge(preview).ok, false);
  const second = reviewed(h.controller.previewImport(document([entry("b")])));
  assert.equal(h.controller.commitMerge(second).ok, true);
  assert.equal(h.controller.commitMerge(second).ok, false);
  assert.equal(h.writes, 1);
});

test("local changes invalidate a preview and refresh preserves new work", () => {
  const h = harness(document([entry("a", "mine")]));
  const preview = reviewed(h.controller.previewImport(document([entry("a", "theirs")])));
  h.edit(document([entry("a", "newer local"), entry("new-local")]));
  assert.equal(h.controller.commitMerge(preview).ok, false);
  assert.equal(h.controller.reviseMerge(preview, new Map()).ok, false);
  assert.equal(h.writes, 0);
  const fresh = reviewed(h.controller.refreshMerge(preview));
  assert.equal(fresh.plan.current.entries[0].text, "newer local");
  assert.equal(h.controller.commitMerge(fresh).ok, true);
  assert.deepEqual(
    h.local.entries.map((e) => e.text),
    ["newer local", "new-local", "theirs"],
  );
});

test("remembered-place changes also invalidate reviewed state", () => {
  const h = harness();
  const preview = reviewed(h.controller.previewImport(document([entry("a")])));
  h.edit(document([], place));
  assert.equal(h.controller.commitMerge(preview).ok, false);
  assert.equal(h.writes, 0);
});

test("cross-tab reconciliation preserves both tabs and supplies a saved-byte lease", () => {
  const h = harness(document([entry("a", "local")]));
  h.external(document([entry("a", "saved"), entry("saved-only")]));
  const preview = reviewed(h.controller.previewSavedMerge());
  assert.equal(preview.source, "saved");
  assert.equal(h.writes, 0);
  assert.equal(h.controller.commitMerge(preview).ok, true);
  assert.deepEqual(
    h.local.entries.map((e) => e.text),
    ["local", "saved", "saved-only"],
  );
});

test("a second external change blocks confirm, including an external clear", () => {
  const h = harness(document([entry("local")]));
  h.external(document([entry("remote")]));
  const preview = reviewed(h.controller.previewSavedMerge());
  h.clearExternal();
  assert.equal(h.controller.commitMerge(preview).ok, false);
  assert.equal(h.writes, 0);
  const cleared = reviewed(h.controller.refreshMerge(preview));
  assert.equal(cleared.savedWasCleared, true);
  assert.equal(cleared.plan.incoming.entries.length, 0);
  assert.equal(h.controller.commitMerge(cleared).ok, true);
  assert.deepEqual(
    h.local.entries.map((e) => e.id),
    ["local"],
  );
});

test("refresh resets choices so decisions about old versions are not reused", () => {
  const h = harness(document([entry("a", "mine")]));
  const first = reviewed(h.controller.previewImport(document([entry("a", "theirs")])));
  const skipping = reviewed(h.controller.reviseMerge(first, new Map([["a", "keep-current"]])));
  h.edit(document([entry("a", "changed again")]));
  const fresh = reviewed(h.controller.refreshMerge(skipping));
  assert.equal(fresh.plan.skipped, 0);
  assert.equal(fresh.plan.keptBoth, 1);
});

test("over-capacity review is wholly refused and can be narrowed without discarding local entries", () => {
  const h = harness(document([entry("a", "mine")]), 2);
  const first = reviewed(h.controller.previewImport(document([entry("a", "theirs"), entry("b")])));
  assert.equal(h.controller.commitMerge(first).ok, false);
  assert.equal(h.writes, 0);
  const revised = reviewed(h.controller.reviseMerge(first, new Map([["a", "keep-current"]])));
  assert.equal(h.controller.commitMerge(revised).ok, true);
  assert.deepEqual(
    h.local.entries.map((e) => e.text),
    ["mine", "b"],
  );
});

test("admission failures and storage failures leave work intact and failed reviews retryable", () => {
  const h = harness(document([entry("local")]));
  assert.equal(h.controller.previewImport({ format: "wrong" }).ok, false);
  const preview = reviewed(h.controller.previewImport(document([entry("new")])));
  h.refuse("Notebook exceeds the byte budget.");
  assert.equal(h.controller.commitMerge(preview).ok, false);
  assert.equal(h.writes, 0);
  assert.equal(h.local.entries.length, 1);
  h.refuse(null);
  assert.equal(h.controller.commitMerge(preview).ok, true);
  assert.equal(h.writes, 1);
});

test("failure to read saved data is not an empty notebook or permission to write", () => {
  let commits = 0;
  const c = createNotebookMergeController({
    entryLimit: 500,
    admit: (input) => input,
    current: () => document([entry("local")]),
    saved() {
      throw new Error("Saved original cannot be read.");
    },
    commit() {
      commits++;
      return { ok: true };
    },
  });
  const got = c.previewSavedMerge();
  assert.equal(got.ok, false);
  assert.match(got.message, /cannot be read/);
  assert.equal(commits, 0);
});

test("merging and inspecting a replay never invokes an evaluator or changes its evidence", () => {
  const replay = {
    tape: { seed: "0", acceptedCheckpoint: { digest: "host:0000000000000000" } },
    explanationBefore: "guess",
    explanationAfter: "learned",
  };
  const current = document([entry("a", "local", { kind: "replay", replay })]);
  const incoming = document([
    entry("a", "imported", {
      kind: "replay",
      replay: { ...replay, explanationAfter: "another conclusion" },
    }),
  ]);
  const got = plan(current, incoming);
  assert.deepEqual(got.document.entries[0].replay, replay);
  assert.deepEqual(got.document.entries[1].replay, incoming.entries[0].replay);
});
