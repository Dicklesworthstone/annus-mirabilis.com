import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createRelativityImportReader,
  prepareRelativityDownload,
  RELATIVITY_FILE_BYTE_LIMIT,
} from "./relativitySessionTransfer.ts";
import { WORKED_RELATIVITY_ORDER } from "./specialRelativityInvestigation.ts";
import {
  decodeRelativityLink,
  emptyRelativitySession,
  encodeRelativityLink,
  exportRelativitySession,
  importRelativitySession,
  RELATIVITY_IMPORT_LIMIT,
  RELATIVITY_NOTE_LIMIT,
} from "./specialRelativitySession.ts";

function session(note = "Private note", changes = {}) {
  return {
    ...emptyRelativitySession(),
    order: [...WORKED_RELATIVITY_ORDER],
    note,
    predictions: { "same-platform-time": "no", "same-moving-time": "yes", "one-clock": "no" },
    ...changes,
  };
}
function file(text) {
  return { size: Buffer.byteLength(text, "utf8"), text: async () => text };
}
function deferredFile(size = 100) {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { file: { size, text: () => promise }, resolve, reject };
}

test("a downloadable private file round-trips every saved field", async () => {
  const original = session("Line one\nγ and α stay legible", { measurement: "one-clock" });
  const prepared = prepareRelativityDownload(original);
  assert.equal(prepared.mediaType, "application/json");
  assert.equal(prepared.filename, "special-relativity-investigation-v1.json");
  const decoded = await createRelativityImportReader().read(file(prepared.text));
  assert.equal(decoded.kind, "session");
  assert.deepEqual(decoded.session, original);
});

test("the same session's public link still omits private file contents", () => {
  const original = session("private-secret-123");
  assert.ok(prepareRelativityDownload(original).text.includes("private-secret-123"));
  const link = encodeRelativityLink(original);
  assert.ok(!link.includes("private-secret-123"));
  assert.deepEqual(decodeRelativityLink(link).session.predictions, {});
  assert.equal(decodeRelativityLink(link).session.note, "");
});

test("invalid application state is refused before a download payload exists", () => {
  assert.throws(() => prepareRelativityDownload(session("x".repeat(RELATIVITY_NOTE_LIMIT + 1))));
  assert.throws(() => prepareRelativityDownload(session("note", { order: ["clocks", "clocks"] })));
});

test("a syntactically valid blocked argument is saved without being repaired", async () => {
  const original = session("Keep my unfinished reasoning", { order: ["normalize", "clocks"] });
  const decoded = await createRelativityImportReader().read(
    file(prepareRelativityDownload(original).text),
  );
  assert.deepEqual(decoded.session, original);
});

test("JSON escaping does not make maximum-length private notes unimportable", async () => {
  for (const note of [
    "\0".repeat(RELATIVITY_NOTE_LIMIT),
    "γ".repeat(RELATIVITY_NOTE_LIMIT),
    "🧭".repeat(RELATIVITY_NOTE_LIMIT / 2),
  ]) {
    const original = session(note);
    const prepared = prepareRelativityDownload(original);
    assert.ok(prepared.text.length <= RELATIVITY_IMPORT_LIMIT);
    assert.ok(Buffer.byteLength(prepared.text) <= RELATIVITY_FILE_BYTE_LIMIT);
    const decoded = await createRelativityImportReader().read(file(prepared.text));
    assert.deepEqual(decoded.session, original);
  }
});

for (const size of [
  -1,
  0.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.MAX_SAFE_INTEGER + 1,
  RELATIVITY_FILE_BYTE_LIMIT + 1,
]) {
  test(`reject invalid or excessive byte size ${size} before reading bytes`, async () => {
    let reads = 0;
    const decoded = await createRelativityImportReader().read({
      size,
      text: async () => {
        reads += 1;
        return "{}";
      },
    });
    assert.equal(decoded.kind, "invalid");
    assert.equal(reads, 0);
  });
}

test("the byte limit is inclusive and does not substitute for content validation", async () => {
  const validText = exportRelativitySession(session());
  assert.equal(
    (
      await createRelativityImportReader().read({
        size: RELATIVITY_FILE_BYTE_LIMIT,
        text: async () => validText,
      })
    ).kind,
    "session",
  );
  assert.equal(
    (await createRelativityImportReader().read(file(" ".repeat(RELATIVITY_IMPORT_LIMIT + 1)))).kind,
    "invalid",
  );
  assert.equal((await createRelativityImportReader().read(file(""))).kind, "invalid");
});

for (const [name, text] of [
  ["broken JSON", "{"],
  [
    "a future file version",
    exportRelativitySession(session()).replace('"version": 1', '"version": 2'),
  ],
  [
    "a forged assessment",
    JSON.stringify({
      ...JSON.parse(exportRelativitySession(session())),
      assessment: { outcome: "aligned-map" },
    }),
  ],
]) {
  test(`file admission preserves codec refusal for ${name}`, async () => {
    const result = await createRelativityImportReader().read(file(text));
    assert.deepEqual(result, importRelativitySession(text));
    assert.equal(result.kind, "invalid");
  });
}

test("a failed file read produces an explicit refusal, not an empty session", async () => {
  const decoded = await createRelativityImportReader().read({
    size: 5,
    text: async () => {
      throw new Error("Device read failed");
    },
  });
  assert.equal(decoded.kind, "invalid");
  assert.match(decoded.message, /could not be read/);
  assert.ok(!("session" in decoded));
});

test("a newer file wins when the earlier read finishes later", async () => {
  const reader = createRelativityImportReader();
  const older = deferredFile();
  const pendingOlder = reader.read(older.file);
  const newer = session("newer file");
  const accepted = await reader.read(file(exportRelativitySession(newer)));
  older.resolve(exportRelativitySession(session("older file")));
  assert.equal(await pendingOlder, null);
  assert.deepEqual(accepted.session, newer);
});

test("late read errors do not overwrite a newer valid preview", async () => {
  const reader = createRelativityImportReader();
  const older = deferredFile();
  const pending = reader.read(older.file);
  const result = await reader.read(file(exportRelativitySession(session("newer"))));
  older.reject(new Error("old failure"));
  assert.equal(await pending, null);
  assert.equal(result.kind, "session");
});

test("even an invalid newer selection supersedes an older pending file", async () => {
  const reader = createRelativityImportReader();
  const older = deferredFile();
  const pending = reader.read(older.file);
  const result = await reader.read({
    size: RELATIVITY_FILE_BYTE_LIMIT + 1,
    text: async () => "{}",
  });
  older.resolve(exportRelativitySession(session()));
  assert.equal(result.kind, "invalid");
  assert.equal(await pending, null);
});

test("explicit invalidation drops pending reads but permits the next attempt", async () => {
  // The UI invokes this owner on edits, cancellation and unmount; this test
  // proves the owner's cancellation semantics, not React effect scheduling.
  const reader = createRelativityImportReader();
  const pendingFile = deferredFile();
  const result = reader.read(pendingFile.file);
  reader.invalidate();
  pendingFile.resolve(exportRelativitySession(session("must not replace current work")));
  assert.equal(await result, null);
  assert.equal(
    (await reader.read(file(exportRelativitySession(session("next attempt"))))).kind,
    "session",
  );
});

test("separate workbench readers do not cancel one another", async () => {
  const first = createRelativityImportReader();
  const second = createRelativityImportReader();
  const a = deferredFile();
  const b = deferredFile();
  const pendingA = first.read(a.file);
  const pendingB = second.read(b.file);
  first.invalidate();
  a.resolve(exportRelativitySession(session("A")));
  b.resolve(exportRelativitySession(session("B")));
  assert.equal(await pendingA, null);
  assert.equal((await pendingB).session.note, "B");
});
