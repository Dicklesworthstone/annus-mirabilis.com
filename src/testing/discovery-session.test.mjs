import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyNotebook,
  encodeNotebook,
  NOTE_FILE_LIMIT,
  recordPrediction,
} from "../discovery/notebook.ts";
import { createNotebookSession } from "../discovery/notebookSession.ts";
import { DISCOVERY_NOTE_KEYS, storageKeyRegistry } from "../platform/storage/keys.ts";

const manifest = {
  paper: "mass-energy",
  revision: "draft-one",
  stages: [{ id: "emit", title: "Emit", alternatives: [] }],
};
function setup(initial = null) {
  let raw = initial,
    mode = "ok",
    writes = 0;
  const port = {
    read: () =>
      mode === "read-throws"
        ? (() => {
            throw Error("blocked");
          })()
        : mode === "unavailable"
          ? { status: "unavailable" }
          : raw === null
            ? { status: "missing" }
            : { status: "ok", value: raw },
    write: (v) => {
      writes++;
      if (mode === "write-throws") throw Error("blocked");
      if (mode !== "ok") return { status: mode === "quota" ? "quota" : "unavailable" };
      raw = v;
      return { status: "ok" };
    },
  };
  const session = createNotebookSession(manifest, port);
  return {
    session,
    getRaw: () => raw,
    setRaw: (v) => {
      raw = v;
    },
    mode: (v) => {
      mode = v;
    },
    writes: () => writes,
  };
}
const populated = () =>
  encodeNotebook(
    recordPrediction(emptyNotebook(manifest), manifest, "emit", "No recoil.", null),
    manifest,
  );
test("all guide keys are registered, independent, bounded, exportable and clearable", () => {
  assert.equal(new Set(Object.values(DISCOVERY_NOTE_KEYS)).size, 4);
  for (const key of Object.values(DISCOVERY_NOTE_KEYS)) {
    const registration = storageKeyRegistry.get(key);
    assert.equal(registration.kind, "document");
    assert.equal(registration.maxBytes, NOTE_FILE_LIMIT);
    assert.ok(registration.exportable && registration.clearable);
    assert.notEqual(key, "am:notebook:v1");
    assert.notEqual(key, "am:predictions:v1");
  }
});
test("server snapshot is stable and never reads storage during render", () => {
  let calls = 0;
  const s = createNotebookSession(manifest, {
    read() {
      calls++;
      throw Error();
    },
    write() {
      throw Error();
    },
  });
  assert.equal(s.getSnapshot(), s.getServerSnapshot());
  assert.equal(s.getServerSnapshot(), s.getServerSnapshot());
  assert.equal(calls, 0);
  assert.equal(s.capture("emit", "draft", null), false);
});
test("loads without an initial empty autosave", () => {
  const x = setup(populated());
  x.session.load();
  assert.equal(x.writes(), 0);
  assert.equal(x.session.getSnapshot().document.entries.length, 1);
  assert.equal(x.session.getServerSnapshot().ready, false);
});
test("loads only once, including Strict Mode's repeated effect", () => {
  const x = setup();
  x.session.load();
  x.session.capture("emit", "keep", null);
  x.session.load();
  assert.equal(x.session.getSnapshot().document.entries[0].attempts[0].prediction, "keep");
});
test("valid actions persist exactly the accepted document", () => {
  const x = setup();
  x.session.load();
  assert.ok(x.session.capture("emit", "No recoil.", null));
  assert.ok(x.session.observe("emit", 0, "The pulses balance."));
  assert.equal(x.getRaw(), x.session.exportNotes());
  assert.equal(x.writes(), 2);
});
for (const mode of ["unavailable", "quota", "write-throws", "read-throws"])
  test(`storage ${mode} preserves in-tab work and does not claim saving`, () => {
    const x = setup();
    x.mode(mode);
    x.session.load();
    assert.ok(x.session.capture("emit", "keep", null));
    assert.equal(x.session.getSnapshot().document.entries[0].attempts[0].prediction, "keep");
    assert.match(x.session.getSnapshot().message, /did not save/);
  });
test("failed save against older persisted data permits subsequent local work", () => {
  const x = setup(populated());
  x.session.load();
  x.mode("quota");
  assert.ok(x.session.capture("emit", "second", null));
  assert.ok(x.session.observe("emit", 1, "observation"));
  assert.equal(x.session.getSnapshot().document.entries[0].attempts.length, 2);
  assert.equal(x.getRaw(), populated());
});
test("corrupt stored text is retained, exportable and never silently overwritten", () => {
  const x = setup("{broken}");
  x.session.load();
  assert.ok(x.session.getSnapshot().blocked);
  assert.equal(x.session.getSnapshot().retainedRaw, "{broken}");
  assert.equal(x.session.capture("emit", "overwrite?", null), false);
  assert.equal(x.writes(), 0);
  x.session.startOver();
  assert.equal(x.session.getSnapshot().blocked, false);
  assert.equal(JSON.parse(x.getRaw()).entries.length, 0);
});
test("a different guide revision blocks relabeling", () => {
  const doc = JSON.parse(populated());
  doc.journeyRevision = "older";
  const x = setup(JSON.stringify(doc));
  x.session.load();
  assert.ok(x.session.getSnapshot().blocked);
  assert.match(x.session.getSnapshot().message, /different guide revision/);
});
test("another tab's saved change blocks a blind overwrite", () => {
  const x = setup();
  x.session.load();
  x.session.capture("emit", "local", null);
  x.setRaw(populated());
  assert.equal(x.session.observe("emit", 0, "would overwrite?"), false);
  assert.ok(x.session.getSnapshot().blocked);
  assert.equal(x.getRaw(), populated());
  assert.equal(x.session.getSnapshot().document.entries[0].attempts[0].prediction, "local");
});
test("rejected and stale imports retain the accepted notebook", () => {
  const x = setup();
  x.session.load();
  x.session.capture("emit", "local", null);
  const accepted = x.session.getSnapshot().document;
  assert.equal(x.session.completeImport(x.session.beginImport(), "null"), false);
  assert.equal(x.session.getSnapshot().document, accepted);
  const token = x.session.beginImport();
  x.session.invalidateImport();
  assert.equal(x.session.completeImport(token, populated()), false);
  assert.equal(x.session.getSnapshot().document, accepted);
});
test("valid import replaces only after full validation and resets form identity", () => {
  const x = setup();
  x.session.load();
  const token = x.session.beginImport();
  assert.ok(x.session.completeImport(token, populated()));
  assert.equal(x.session.getSnapshot().resetSequence, 1);
  assert.equal(x.getRaw(), populated());
  assert.equal(x.session.completeImport(token, populated()), false);
});
test("confirmed start-over invalidates pending imports and reports a failed persistent clear", () => {
  const x = setup(populated());
  x.session.load();
  const token = x.session.beginImport();
  x.mode("quota");
  x.session.startOver();
  assert.equal(x.session.completeImport(token, populated()), false);
  assert.equal(x.session.getSnapshot().document.entries.length, 0);
  assert.equal(x.getRaw(), populated());
  assert.match(x.session.getSnapshot().message, /older saved version/);
});
test("subscription unregisters without changing the accepted snapshot", () => {
  const x = setup();
  let calls = 0;
  const off = x.session.subscribe(() => calls++);
  x.session.load();
  off();
  x.session.capture("emit", "new", null);
  assert.equal(calls, 1);
});
