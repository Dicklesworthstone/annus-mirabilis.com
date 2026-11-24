import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import {
  migrateExerciseNotebook,
  migrateRecordingNotebook,
  migrateTeachBackNotebook,
  readNotebookDocument,
} from "./migrations/teachBack.ts";
import { notebookRecordingSource, parseNotebookRecording } from "./recordingEntry.ts";
import { emptyNotebook, NOTEBOOK_SCHEMA_VERSION, parseNotebookEntry } from "./schema.ts";

test("recording admission identifies executable, cyclic, sparse and non-JSON input before serialization", () => {
  let called = 0;
  const getter = Object.defineProperty({}, "privateWords", {
    enumerable: true,
    get() { called++; return "must not be read"; },
  });
  const toJSON = { toJSON() { called++; return {}; } };
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  const hidden = Object.defineProperty({}, "hidden", { value: "must not disappear" });
  for (const value of [getter, hidden]) {
    assert.throws(() => notebookRecordingSource(value), {
      name: "NotebookRecordingError", code: "notebook-recording-accessor",
    });
  }
  for (const value of [toJSON, { value: undefined }, { value: 1n }, { value: Infinity }]) {
    assert.throws(() => notebookRecordingSource(value), {
      name: "NotebookRecordingError", code: "notebook-recording-json-value",
    });
  }
  for (const value of [new Date(), new Uint8Array(1)]) {
    assert.throws(() => notebookRecordingSource(value), {
      name: "NotebookRecordingError", code: "notebook-recording-prototype",
    });
  }
  assert.throws(() => notebookRecordingSource(cycle), {
    name: "NotebookRecordingError", code: "notebook-recording-cycle",
  });
  assert.throws(() => notebookRecordingSource(Array(2)), {
    name: "NotebookRecordingError", code: "notebook-recording-array",
  });
  for (const value of [
    { [Symbol("private")]: "unrepresentable" }, JSON.parse('{"__proto__":{}}'),
  ]) {
    assert.throws(() => notebookRecordingSource(value), {
      name: "NotebookRecordingError", code: "notebook-recording-field",
    });
  }
  expect(called).toBe(0);
  // Existing consumers that catch TypeError continue to recognize the refusal.
  expect(() => notebookRecordingSource({ value: Infinity })).toThrow(TypeError);
});

function ranges(count: number, firstTile = "0") {
  return {
    stops: [{
      tape: { acceptedCheckpoint: { scientificState: { streamPositionRanges: [{
        allocationId: "fixture-allocation",
        streamKernelId: "fixture-kernel",
        firstTile, count, index: "18446744073709551615",
      }] } } },
    }],
  };
}

test("range preflight preserves exact high u64 strings without allocating expanded positions", () => {
  const value = ranges(1, "18446744073709551615");
  expect(JSON.parse(notebookRecordingSource(value))).toEqual(value);
  const ordinaryEnsemble = ranges(2000);
  expect(JSON.parse(notebookRecordingSource(ordinaryEnsemble))).toEqual(ordinaryEnsemble);
});

test("compact imports cannot hide a recording larger than the existing expanded byte limit", () => {
  const huge = ranges(30_000);
  assert.throws(() => notebookRecordingSource(huge), {
    code: "notebook-recording-stream-ranges",
  });
  const aggregate = { stops: Array.from({ length: 64 }, () => ranges(2000).stops[0]) };
  assert.throws(() => notebookRecordingSource(aggregate), {
    code: "notebook-recording-stream-ranges",
  });
  for (const count of [0, -1, 1.5, 30_001, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => notebookRecordingSource(ranges(count)), {
      code: "notebook-recording-stream-ranges",
    });
  }
  for (const firstTile of ["-1", "01", "18446744073709551616", "1".repeat(100)]) {
    assert.throws(() => notebookRecordingSource(ranges(1, firstTile)), {
      code: "notebook-recording-stream-ranges",
    });
  }
  assert.throws(() => notebookRecordingSource(ranges(2, "18446744073709551615")), {
    code: "notebook-recording-stream-ranges",
  });
});

test("recording size, nesting and laboratory admission have distinct bounded refusals", () => {
  assert.throws(() => notebookRecordingSource({ text: "x".repeat(1024 * 1024 + 1) }), {
    code: "notebook-recording-text-size",
  });
  assert.throws(() => notebookRecordingSource({ ["k".repeat(1024 * 1024 + 1)]: 0 }), {
    code: "notebook-recording-key-size",
  });
  assert.throws(() => notebookRecordingSource({ text: "\u00e9".repeat(600_000) }), {
    code: "notebook-recording-byte-size",
  });
  let nested: unknown = "end";
  for (let i = 0; i < 26; i++) nested = { next: nested };
  assert.throws(() => notebookRecordingSource(nested), {
    code: "notebook-recording-complexity",
  });
  assert.throws(() => parseNotebookRecording({ experimentId: "bm-08", stops: [] }), {
    code: "notebook-recording-instrument",
  });
  assert.throws(() => parseNotebookRecording({ experimentId: "bm-01", stops: [] }), {
    code: "notebook-recording-envelope",
  });
});

const note = parseNotebookEntry({
  id: "retained-note",
  kind: "note",
  title: "A question I want to keep",
  text: "Private original words",
  createdAt: "2026-09-17T14:00:00.000Z",
  frame: {
    paper: "brownian-motion",
    anchor: "arg-bm-observable",
    view: "reading",
    detail: 1,
    lens: "paper",
    open: "",
  },
});
const notebook = {
  ...emptyNotebook(),
  entries: [note],
  lastPlace: {
    frame: note.frame,
    title: note.title,
    recap: "An authored recap",
    recapKind: "authored-recap" as const,
  },
};

test("version 1, 2 and 3 notebooks migrate one step at a time without changing reader work", () => {
  expect(migrateTeachBackNotebook({ ...notebook, schemaVersion: 1 }).schemaVersion).toBe(2);
  expect(migrateExerciseNotebook({ ...notebook, schemaVersion: 2 }).schemaVersion).toBe(3);
  expect(migrateRecordingNotebook({ ...notebook, schemaVersion: 3 }).schemaVersion).toBe(4);
  for (const version of [1, 2, 3]) {
    const original = { ...notebook, schemaVersion: version };
    const before = JSON.stringify(original);
    expect(readNotebookDocument(original)).toEqual(notebook);
    expect(JSON.stringify(original)).toBe(before);
  }
  expect(NOTEBOOK_SCHEMA_VERSION).toBe(4);
});

test("older envelopes cannot counterfeit the new recording entry kind", () => {
  for (const schemaVersion of [1, 2, 3]) {
    expect(() => readNotebookDocument({
      ...notebook, schemaVersion,
      entries: [{ ...note, kind: "recording", recording: {} }],
    })).toThrow(/cannot contain/);
  }
  expect(() => readNotebookDocument({ ...notebook, schemaVersion: 99 })).toThrow();
});

test("notebook-migration-version: recording upgrade requires version 3 and an entry array (teachBack.ts:95)", () => {
  expect(migrateRecordingNotebook({ ...notebook, schemaVersion: 3 })).toEqual(notebook);
  for (const input of [
    { ...notebook, schemaVersion: 2 },
    { ...notebook, schemaVersion: 3, entries: {} },
  ]) {
    assert.throws(() => migrateRecordingNotebook(input), {
      name: "NotebookMigrationError", code: "notebook-migration-version",
    });
  }
});

test("notebook-migration-entry: old envelopes cannot contain recordings or sparse entries (teachBack.ts:106)", () => {
  for (const entries of [[{ ...note, kind: "recording", recording: {} }], Array(1)]) {
    const input = { ...notebook, schemaVersion: 3, entries };
    const original = JSON.stringify(input);
    assert.throws(() => migrateRecordingNotebook(input), {
      name: "NotebookMigrationError", code: "notebook-migration-entry",
    });
    expect(JSON.stringify(input)).toBe(original);
  }
});
