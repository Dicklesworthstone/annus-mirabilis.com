import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Capstone } from "../../discovery/capstone/capstoneSchema.ts";
import { emptyWorksheet } from "../../discovery/capstone/worksheetState.ts";
import {
  CAPSTONE_PAPERS,
  CapstoneCaptureError,
  captureCapstone,
  capstoneCaptureHref,
  capstoneCaptureText,
  confirmCapstoneRestore,
  parseCapstoneCapture,
  readCapstoneCapture,
  reviewCapstoneRestore,
} from "./capstoneEntry.ts";

const capstone: Capstone = {
  id: "capstone-test",
  paper: "mass-energy",
  title: "Reconstruct the argument",
  question: "Why?",
  claims: [
    {
      id: "c1",
      text: "Begin with conservation.",
      anchor: "s0-p1",
      logicalRole: "assumption",
      buildsOn: [],
      assumptionIds: ["a1"],
    },
    {
      id: "c2",
      text: "Subtract the ledgers.",
      anchor: "s0-p2",
      logicalRole: "derivation",
      buildsOn: ["c1"],
      assumptionIds: ["a1"],
    },
  ],
  paperOrder: ["c1", "c2"],
  startOrder: ["c2", "c1"],
  presets: [],
  equations: [{ equationId: "eq-ledger", purpose: "Subtract" }],
  assumptions: [
    { id: "a1", statement: "The system is closed.", kind: "boundary-choice", anchor: "s0-p1" },
  ],
  explanationPrompt: "Explain why the subtraction works.",
  selfCheckNotes: {},
  limits: "",
  reviewRecordIds: [],
};
const equations = [{ equationId: "eq-ledger", title: "The two ledgers" }];
function fixture() {
  const worksheet = {
    ...emptyWorksheet(capstone),
    explanation: "My own explanation π\n<not markup>",
    annotations: {
      "eq-ledger": "Both frames count the same body.",
      "retired-term": "Do not lose this note.",
    },
    assumptionMarks: { c1: ["a1"], c2: [] },
    table: [
      ["time", "value"],
      ["one\ntwo", "α | β"],
    ],
  };
  return { worksheet, capture: captureCapstone(capstone, worksheet, equations) };
}

test("notebook-capstone-invalid: valid snapshots roundtrip for all four papers", () => {
  for (const paper of CAPSTONE_PAPERS) {
    const { worksheet } = fixture();
    const capture = captureCapstone({ ...capstone, paper }, worksheet, equations);
    assert.deepEqual(parseCapstoneCapture(JSON.parse(JSON.stringify(capture)), paper), capture);
    assert.deepEqual(capture.worksheet, worksheet);
  }
});

test("capture is detached and deeply frozen, not an alias of a live worksheet", () => {
  const { worksheet, capture } = fixture();
  worksheet.table[0]![0] = "changed after save";
  worksheet.assumptionMarks.c1.push("a2");
  worksheet.annotations["eq-ledger"] = "new note";
  assert.equal(capture.worksheet.table[0]?.[0], "time");
  assert.deepEqual(capture.worksheet.assumptionMarks.c1, ["a1"]);
  assert.equal(capture.worksheet.annotations["eq-ledger"], "Both frames count the same body.");
  assert.ok(Object.isFrozen(capture.worksheet.table[0]));
  assert.ok(Object.isFrozen(capture.claims));
});

test("notebook-capstone-invalid: malformed and forward-version entries are refused without discarding fields", () => {
  const { capture } = fixture();
  for (const input of [
    null,
    [],
    { ...capture, schemaVersion: 2 },
    { ...capture, unknownField: "keep me" },
    { ...capture, paper: "../notebook" },
    { ...capture, prompt: "\u0000" },
    { ...capture, worksheet: { ...capture.worksheet, newField: "future" } },
    { ...capture, claims: { c1: "only one" } },
    { ...capture, assumptions: {} },
    { ...capture, equations: { constructor: "unsafe key" } },
    { ...capture, equations: { "eq-ledger": "x".repeat(10001) } },
  ]) {
    assert.equal(readCapstoneCapture(input), null);
    assert.throws(
      () => parseCapstoneCapture(input),
      (error: unknown) =>
        error instanceof CapstoneCaptureError && error.code === "notebook-capstone-invalid",
    );
  }
  assert.throws(() => parseCapstoneCapture(capture, "light-quanta"), CapstoneCaptureError);
  assert.throws(
    () => captureCapstone(capstone, { ...capture.worksheet, capstoneId: "another" }, equations),
    CapstoneCaptureError,
  );
});

test("notebook-capstone-invalid: getters and inherited records are not read as trusted snapshot data", () => {
  const { capture } = fixture();
  let reads = 0;
  const accessor = {
    ...capture,
    get prompt() {
      reads++;
      return "should not execute";
    },
  };
  assert.equal(readCapstoneCapture(accessor), null);
  assert.equal(reads, 0);
  assert.equal(readCapstoneCapture(Object.create(capture)), null);
  assert.equal(readCapstoneCapture({ ...capture, [Symbol("hidden")]: "value" }), null);
});

test("notebook-capstone-invalid: the complete UTF-8 capture has a bound, including reference wording", () => {
  const { capture } = fixture();
  const tooLarge = {
    ...capture,
    equations: Object.fromEntries(
      Array.from({ length: 30 }, (_, index) => [`eq-${index}`, "α".repeat(8000)]),
    ),
  };
  assert.equal(readCapstoneCapture(tooLarge), null);
  assert.equal(capture.worksheet.explanation, fixture().worksheet.explanation);
});

test("human-readable capture retains order, all annotations, every table cell and all assumption wording", () => {
  const { capture } = fixture();
  const text = capstoneCaptureText(capture);
  assert.ok(text.indexOf("1. Subtract the ledgers.") < text.indexOf("2. Begin with conservation."));
  for (const expected of [
    "The system is closed.",
    "Both frames count the same body.",
    "Do not lose this note.",
    "My own explanation π\n<not markup>",
    "Column 1: one\ntwo",
    "Column 2: α | β",
  ])
    assert.ok(text.includes(expected), expected);
  assert.ok(text.includes("not an assessment or a record of a laboratory calculation"));
});

test("links contain only a public capstone address, not an entry id or any worksheet data", () => {
  const { capture } = fixture();
  assert.equal(capstoneCaptureHref(capture), "/capstones/mass-energy/#capstone-worksheet");
  assert.equal(new URL(capstoneCaptureHref(capture), "https://annus-mirabilis.com").search, "");
});

test("a reviewed attempt restores a new editable copy while leaving the notebook snapshot immutable", () => {
  const { capture } = fixture();
  const current = emptyWorksheet(capstone);
  const review = reviewCapstoneRestore(capture, current);
  const result = confirmCapstoneRestore(review, current, capture, capstone);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.worksheet, capture.worksheet);
  assert.notEqual(result.worksheet, capture.worksheet);
  assert.notEqual(result.worksheet.table[0], capture.worksheet.table[0]);
  assert.ok(!Object.isFrozen(result.worksheet));
});

test("a changed worksheet invalidates replacement consent instead of discarding new typing", () => {
  const { capture } = fixture();
  const current = emptyWorksheet(capstone);
  const result = confirmCapstoneRestore(
    reviewCapstoneRestore(capture, current),
    { ...current, explanation: "typed after the preview" },
    capture,
    capstone,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /worksheet changed/);
});

test("a removed or edited notebook snapshot invalidates its pending review", () => {
  const { capture } = fixture();
  const current = emptyWorksheet(capstone);
  const review = reviewCapstoneRestore(capture, current);
  for (const saved of [undefined, { ...capture, prompt: "changed since preview" }]) {
    const result = confirmCapstoneRestore(review, current, saved, capstone);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /changed or was removed/);
  }
});

test("cross-paper and changed claim/assumption editions remain readable but cannot replace a worksheet", () => {
  const { capture } = fixture();
  const current = emptyWorksheet(capstone);
  const review = reviewCapstoneRestore(capture, current);
  for (const edition of [
    { ...capstone, paper: "light-quanta" },
    { ...capstone, id: "later-capstone" },
    { ...capstone, claims: capstone.claims.slice(0, 1) },
    { ...capstone, assumptions: [] },
  ]) {
    const result = confirmCapstoneRestore(review, current, capture, edition);
    assert.equal(result.ok, false);
    assert.ok(capstoneCaptureText(capture).includes("Do not lose this note."));
  }
});
