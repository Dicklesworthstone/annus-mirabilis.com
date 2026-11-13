import assert from "node:assert/strict";
import test from "node:test";
import { emptyNotebook, encodeNotebook, recordPrediction } from "../discovery/notebook.ts";
import { createStoredNotebookSession } from "../discovery/storedNotebook.ts";
import { DISCOVERY_NOTE_KEYS } from "../platform/storage/keys.ts";
import { InMemoryStorage, quotaExceededError } from "../platform/storage/testSupport.ts";

const manifest = {
  paper: "mass-energy",
  revision: "storage-conflict-test",
  stages: [{ id: "emit", title: "Emit", alternatives: [] }],
};
const key = DISCOVERY_NOTE_KEYS[manifest.paper];
const savedNotes = (prediction) =>
  encodeNotebook(
    recordPrediction(emptyNotebook(manifest), manifest, "emit", prediction, null),
    manifest,
  );

function setup(initial = savedNotes("Saved prediction.")) {
  const faults = {};
  const backend = new InMemoryStorage(faults);
  if (initial !== null) backend.rawSet(key, initial);
  let writes = 0;
  const setItem = backend.setItem.bind(backend);
  backend.setItem = (name, value) => {
    writes++;
    setItem(name, value);
  };
  const session = createStoredNotebookSession(manifest, { getStorage: () => backend });
  return { session, backend, faults, writes: () => writes };
}

test("a clear after loading saved notes is a conflict even before this tab's first write", () => {
  const x = setup();
  x.session.load();
  const accepted = x.session.getSnapshot().document;
  x.backend.removeItem(key);
  assert.equal(x.session.capture("emit", "Do not recreate cleared notes.", null), false);
  assert.equal(x.writes(), 0);
  assert.equal(x.backend.getItem(key), null);
  assert.equal(x.session.getSnapshot().document, accepted);
  assert.equal(x.session.getSnapshot().blocked, true);
});

test("a failed save cannot hide another tab's deletion behind the session fallback", () => {
  const x = setup();
  x.session.load();
  x.faults.throwOnSet = quotaExceededError();
  assert.equal(x.session.capture("emit", "Unsaved prediction.", null), true);
  const retained = x.session.exportNotes();
  x.backend.removeItem(key);
  delete x.faults.throwOnSet;
  const writes = x.writes();
  assert.equal(x.session.observe("emit", 1, "Do not resurrect the saved notebook."), false);
  assert.equal(x.writes(), writes);
  assert.equal(x.backend.getItem(key), null);
  assert.equal(x.session.exportNotes(), retained);
  assert.equal(x.session.getSnapshot().blocked, true);
  assert.match(x.session.getSnapshot().message, /changed elsewhere/);
});

test("a failed save also preserves a different notebook saved by another tab", () => {
  const x = setup();
  x.session.load();
  x.faults.throwOnSet = quotaExceededError();
  x.session.capture("emit", "Unsaved prediction.", null);
  const retained = x.session.exportNotes();
  const external = savedNotes("The other tab's prediction.");
  x.backend.rawSet(key, external);
  delete x.faults.throwOnSet;
  assert.equal(x.session.capture("emit", "Do not overwrite the other tab.", null), false);
  assert.equal(x.backend.getItem(key), external);
  assert.equal(x.session.exportNotes(), retained);
  assert.equal(x.session.getSnapshot().retainedRaw, external);
});

test("quota recovery saves the complete in-tab notebook when the saved base is unchanged", () => {
  const x = setup();
  x.session.load();
  const original = x.backend.getItem(key);
  x.faults.throwOnSet = quotaExceededError();
  assert.equal(x.session.capture("emit", "Unsaved prediction.", null), true);
  assert.equal(x.session.observe("emit", 1, "Unsaved observation."), true);
  assert.equal(x.backend.getItem(key), original);
  delete x.faults.throwOnSet;
  assert.equal(x.session.capture("emit", "Recovered prediction.", null), true);
  assert.equal(x.backend.getItem(key), x.session.exportNotes());
  const attempts = x.session.getSnapshot().document.entries[0].attempts;
  assert.deepEqual(
    attempts.map((attempt) => attempt.prediction),
    ["Saved prediction.", "Unsaved prediction.", "Recovered prediction."],
  );
  assert.equal(attempts[1].observation, "Unsaved observation.");
  assert.equal(x.session.getSnapshot().blocked, false);
});

test("an unreadable saved version never authorizes a write even when setItem would work", () => {
  const x = setup();
  x.session.load();
  const original = x.backend.getItem(key);
  x.faults.throwOnGet = new Error("Reads are blocked but writes still work.");
  assert.equal(x.session.capture("emit", "Keep this in the tab.", null), true);
  assert.equal(x.writes(), 0);
  assert.equal(x.backend.rawGet(key), original);
  assert.match(x.session.getSnapshot().message, /did not save/);
  assert.equal(
    x.session.getSnapshot().document.entries[0].attempts[1].prediction,
    "Keep this in the tab.",
  );
  delete x.faults.throwOnGet;
  assert.equal(x.session.observe("emit", 1, "Recovered without losing either prediction."), true);
  assert.equal(x.backend.getItem(key), x.session.exportNotes());
});

test("initially unavailable storage cannot overwrite an existing notebook when access returns", () => {
  const x = setup();
  const original = x.backend.rawGet(key);
  x.faults.throwOnAnyAccess = new Error("Storage unavailable.");
  x.session.load();
  assert.equal(x.session.capture("emit", "Private in-tab work.", null), true);
  assert.equal(x.writes(), 0);
  const retained = x.session.exportNotes();
  delete x.faults.throwOnAnyAccess;
  assert.equal(
    x.session.capture("emit", "An existing notebook is not an empty notebook.", null),
    false,
  );
  assert.equal(x.backend.getItem(key), original);
  assert.equal(x.session.exportNotes(), retained);
  assert.equal(x.session.getSnapshot().blocked, true);
});

test("a failed explicit reset preserves corrupt original text until replacement succeeds", () => {
  const original = "{original notes from another version";
  const x = setup(original);
  x.session.load();
  assert.equal(x.session.getSnapshot().retainedRaw, original);
  const token = x.session.beginImport();
  x.faults.throwOnSet = quotaExceededError();
  x.session.startOver();
  assert.equal(x.session.completeImport(token, savedNotes("Stale import.")), false);
  assert.equal(x.backend.getItem(key), original);
  assert.equal(x.session.getSnapshot().retainedRaw, original);
  assert.equal(x.session.getSnapshot().document.entries.length, 0);
  assert.match(x.session.getSnapshot().message, /older saved version/);
  delete x.faults.throwOnSet;
  x.session.startOver();
  assert.equal(x.session.getSnapshot().retainedRaw, null);
  assert.equal(x.backend.getItem(key), x.session.exportNotes());
});

test("reset during a read outage retains the known original and detects a later external change", () => {
  const x = setup();
  x.session.load();
  const original = x.backend.getItem(key);
  x.faults.throwOnGet = new Error("Read unavailable.");
  x.session.startOver();
  assert.equal(x.writes(), 0);
  assert.equal(x.session.getSnapshot().retainedRaw, original);
  assert.equal(x.backend.rawGet(key), original);
  const external = savedNotes("Written elsewhere during the outage.");
  x.backend.rawSet(key, external);
  delete x.faults.throwOnGet;
  assert.equal(x.session.capture("emit", "Do not overwrite.", null), false);
  assert.equal(x.backend.getItem(key), external);
  assert.equal(x.session.getSnapshot().blocked, true);
});
