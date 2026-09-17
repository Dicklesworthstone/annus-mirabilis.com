import assert from "node:assert/strict";
import test from "node:test";
import {
  createImportGuard,
  decodeNotebook,
  emptyNotebook,
  encodeNotebook,
  NOTE_ATTEMPT_LIMIT,
  NOTE_FILE_LIMIT,
  NOTE_TEXT_LIMIT,
  recordObservation,
  recordPrediction,
  validateNotebook,
} from "../discovery/notebook.ts";

const manifest = {
  paper: "mass-energy",
  revision: "draft-one",
  stages: [
    { id: "emit", title: "Emit", alternatives: [] },
    {
      id: "subtract",
      title: "Subtract",
      alternatives: [
        { id: "assume", title: "Assume" },
        { id: "compare", title: "Compare" },
      ],
    },
    { id: "limit", title: "Take the limit", alternatives: [] },
  ],
};
const fresh = () => emptyNotebook(manifest);
const one = () =>
  recordPrediction(fresh(), manifest, "subtract", "The unknowns might cancel.", "compare");
test("prediction snapshots never mutate previous notes", () => {
  const before = fresh(),
    after = recordPrediction(before, manifest, "emit", "No recoil.", null);
  assert.equal(before.entries.length, 0);
  assert.equal(after.entries[0].attempts[0].prediction, "No recoil.");
  for (const v of [
    after,
    after.entries,
    after.entries[0],
    after.entries[0].attempts,
    after.entries[0].attempts[0],
  ])
    assert.ok(Object.isFrozen(v));
});
test("a tentative branch can be recorded without typing an answer", () => {
  assert.equal(recordPrediction(fresh(), manifest, "subtract", "", "compare").entries.length, 1);
});
test("an observation attaches to the specified attempt, not whichever is latest", () => {
  const doc = recordPrediction(one(), manifest, "subtract", "A second idea.", "assume");
  const observed = recordObservation(doc, manifest, "subtract", 0, "I changed my interpretation.");
  assert.equal(observed.entries[0].attempts[1].observation, "");
  assert.equal(observed.entries[0].attempts[0].prediction, "The unknowns might cancel.");
  assert.equal(doc.entries[0].attempts[0].observation, "");
});
test("exports contain recorded attempts, not caller draft state", () => {
  const doc = recordObservation(one(), manifest, "subtract", 0, "Later evidence is separate.");
  assert.deepEqual(decodeNotebook(encodeNotebook(doc, manifest), manifest), doc);
  assert.equal(JSON.stringify(doc).includes("correct"), false);
});
test("canonical exports are independent of step visitation order", () => {
  const a = recordPrediction(one(), manifest, "emit", "Symmetry.", null);
  const b = recordPrediction(
    recordPrediction(fresh(), manifest, "emit", "Symmetry.", null),
    manifest,
    "subtract",
    "The unknowns might cancel.",
    "compare",
  );
  assert.equal(encodeNotebook(a, manifest), encodeNotebook(b, manifest));
});
const invalid = [
  ["wrong kind", (x) => (x.kind = "experiment-tape")],
  ["wrong schema", (x) => (x.schemaVersion = 2)],
  ["wrong paper", (x) => (x.paper = "light-quanta")],
  ["stale revision", (x) => (x.journeyRevision = "draft-zero")],
  ["unknown step", (x) => (x.entries[0].stageId = "made-up")],
  ["duplicate step", (x) => x.entries.push(x.entries[0])],
  ["unknown alternative", (x) => (x.entries[0].attempts[0].alternativeId = "secret")],
  ["empty attempts", (x) => (x.entries[0].attempts = [])],
  ["missing observation", (x) => delete x.entries[0].attempts[0].observation],
  ["extra score", (x) => (x.entries[0].attempts[0].score = 100)],
  ["extra metadata", (x) => (x.approved = true)],
  ["numeric prediction", (x) => (x.entries[0].attempts[0].prediction = 1)],
  [
    "oversized prediction",
    (x) => (x.entries[0].attempts[0].prediction = "a".repeat(NOTE_TEXT_LIMIT + 1)),
  ],
  [
    "oversized observation",
    (x) => (x.entries[0].attempts[0].observation = "a".repeat(NOTE_TEXT_LIMIT + 1)),
  ],
  ["control character", (x) => (x.entries[0].attempts[0].observation = "a\0b")],
  ["missing attempt", (x) => delete x.entries[0].attempts[0]],
  ["missing entry", (x) => delete x.entries[0]],
  [
    "too many attempts",
    (x) => (x.entries[0].attempts = Array(NOTE_ATTEMPT_LIMIT + 1).fill(x.entries[0].attempts[0])),
  ],
  [
    "empty prediction and branch",
    (x) => {
      x.entries[0].attempts[0].prediction = " ";
      x.entries[0].attempts[0].alternativeId = null;
    },
  ],
];
for (const [name, change] of invalid)
  test(`refuses ${name} without replacing the accepted notebook`, () => {
    const doc = one(),
      copy = JSON.parse(JSON.stringify(doc));
    change(copy);
    assert.throws(() => validateNotebook(copy, manifest), { name: "NotebookError" });
    assert.equal(doc.entries[0].attempts[0].prediction, "The unknowns might cancel.");
  });
test("getter import cannot execute code", () => {
  const doc = { ...one() };
  let calls = 0;
  Object.defineProperty(doc, "entries", {
    enumerable: true,
    get() {
      calls++;
      return [];
    },
  });
  assert.throws(() => validateNotebook(doc, manifest));
  assert.equal(calls, 0);
});
test("HTML-like notes remain inert text and survive interchange", () => {
  const text = '<img src=x onerror="alert(1)">';
  const doc = recordPrediction(fresh(), manifest, "emit", text, null);
  assert.equal(
    decodeNotebook(encodeNotebook(doc, manifest), manifest).entries[0].attempts[0].prediction,
    text,
  );
});
test("UTF-8 limits are bytes rather than character count", () => {
  assert.throws(() => decodeNotebook("😀".repeat(NOTE_FILE_LIMIT / 4 + 1), manifest));
});
test("malformed, null, array and oversized JSON fail", () => {
  for (const raw of ["{", "null", "[]", '"text"', " ".repeat(NOTE_FILE_LIMIT + 1)])
    assert.throws(() => decodeNotebook(raw, manifest));
});
test("out-of-range observations do not create a hidden attempt", () => {
  for (const index of [-1, 1, NaN, Infinity, 0.5])
    assert.throws(() => recordObservation(one(), manifest, "subtract", index, "x"));
  assert.throws(() => recordObservation(fresh(), manifest, "emit", 0, "x"));
});
test("bounded history keeps all accepted prior attempts", () => {
  let doc = fresh();
  for (let i = 0; i < NOTE_ATTEMPT_LIMIT; i++)
    doc = recordPrediction(doc, manifest, "emit", String(i), null);
  assert.throws(() => recordPrediction(doc, manifest, "emit", "overflow", null));
  assert.deepEqual(
    doc.entries[0].attempts.map((a) => a.prediction),
    Array.from({ length: NOTE_ATTEMPT_LIMIT }, (_, i) => String(i)),
  );
});
test("local edit, newer import and clear invalidate an in-flight file read", () => {
  const guard = createImportGuard();
  const first = guard.begin();
  assert.ok(guard.current(first));
  guard.invalidate();
  assert.equal(guard.current(first), false);
  const second = guard.begin(),
    third = guard.begin();
  assert.equal(guard.current(second), false);
  assert.ok(guard.current(third));
  guard.invalidate();
  assert.equal(guard.current(third), false);
});
