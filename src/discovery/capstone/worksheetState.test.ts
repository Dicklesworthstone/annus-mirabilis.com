import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assumptionFeedback,
  emptyWorksheet,
  exportWorksheet,
  markAssumption,
  moveClaim,
  readWorksheet,
  WORKSHEET_LIMITS,
  worksheetMatches,
} from "./worksheetState.ts";

const capstone = {
  id: "capstone-fixture",
  startOrder: ["f", "c", "a", "e", "b", "d"],
  claims: ["a", "b", "c", "d", "e", "f"].map((id) => ({
    id,
    text: id,
    anchor: id,
    logicalRole: "assumption" as const,
    buildsOn: [],
    assumptionIds: [],
  })),
  assumptions: [
    { id: "independent", statement: "Independent intervals", kind: "idealization" as const },
  ],
};

describe("private capstone worksheet state", () => {
  it("starts reproducibly without filling in the author's assumption mapping", () => {
    const state = emptyWorksheet(capstone);
    assert.deepEqual(state.order, capstone.startOrder);
    assert.notEqual(state.order, capstone.startOrder);
    assert.deepEqual(state.assumptionMarks, {});
    assert.equal(worksheetMatches(state, capstone), true);
  });
  it("moves one claim, preserving identity and every other relative position", () => {
    const order = ["a", "b", "c", "d"];
    assert.deepEqual(moveClaim(order, "c", -1), ["a", "c", "b", "d"]);
    assert.deepEqual(moveClaim(moveClaim(order, "c", -1), "c", 1), order);
    assert.deepEqual(order, ["a", "b", "c", "d"]);
    assert.equal(moveClaim(order, "a", -1), order);
    assert.equal(moveClaim(order, "d", 1), order);
    assert.equal(moveClaim(order, "unknown", 1), order);
  });
  it("marks assumptions idempotently without changing other claims", () => {
    const state = markAssumption(emptyWorksheet(capstone), "a", "independent", true);
    assert.deepEqual(markAssumption(state, "a", "independent", true), state);
    assert.deepEqual(markAssumption(state, "a", "independent", false).assumptionMarks.a, []);
    assert.deepEqual(markAssumption(state, "b", "independent", true).assumptionMarks.a, [
      "independent",
    ]);
    assert.deepEqual(assumptionFeedback(["one", "two"], ["two", "three"]), {
      alsoUses: ["one"],
      notUsedInWorkedVersion: ["three"],
    });
  });
  it("round-trips all private content, including markup as inert text and Unicode", () => {
    const state = {
      ...emptyWorksheet(capstone),
      annotations: { "equation:term": "<script>not markup</script> λ" },
      assumptionMarks: { a: ["independent"] },
      explanation: "Line one\nLine two",
      table: [
        ["Time", "Observation"],
        ["later", "spread"],
      ],
    };
    const read = readWorksheet(JSON.parse(exportWorksheet(state)));
    assert.deepEqual(read, state);
    assert.notEqual(read?.order, state.order);
    assert.notEqual(read?.table, state.table);
  });
  it("refuses unknown versions, fields, accessors, duplicate or missing claims", () => {
    const state = emptyWorksheet(capstone);
    for (const bad of [
      null,
      [],
      { ...state, schemaVersion: 3 },
      { ...state, surprise: true },
      { ...state, order: [] },
      { ...state, order: ["a", "a"] },
      { ...state, order: ["../outside"] },
    ])
      assert.equal(readWorksheet(bad), null);
    let called = false;
    const getter = {
      ...state,
      get explanation() {
        called = true;
        return "secret";
      },
    };
    assert.equal(readWorksheet(getter), null);
    assert.equal(called, false);
  });
  it("reads a version-one worksheet without changing its original and exports its lossless upgrade", () => {
    const { sketch: _sketch, ...withoutSketch } = emptyWorksheet(capstone);
    const original = {
      ...withoutSketch,
      schemaVersion: 1,
      annotations: { "eq-private": "Keep my older words λ" },
      explanation: "My earlier reconstruction",
      table: [["original cell"]],
    };
    const raw = JSON.stringify(original);
    const migrated = readWorksheet(original);
    assert.ok(migrated);
    assert.equal(migrated.schemaVersion, 2);
    assert.deepEqual(migrated.sketch, { description: "", strokes: [] });
    assert.deepEqual(migrated.annotations, original.annotations);
    assert.deepEqual(migrated.table, original.table);
    assert.equal(migrated.explanation, original.explanation);
    assert.equal(JSON.stringify(original), raw);
    assert.deepEqual(readWorksheet(JSON.parse(exportWorksheet(migrated))), migrated);
    // A v1 record with a drawing is not a known older format; do not discard an unexpected field.
    assert.equal(
      readWorksheet({ ...original, sketch: { description: "older?", strokes: [] } }),
      null,
    );
    assert.equal(readWorksheet({ ...withoutSketch, schemaVersion: 2 }), null);
  });
  it("keeps a version-one worksheet at its byte limit importable after the drawing upgrade", () => {
    const { sketch: _sketch, ...withoutSketch } = emptyWorksheet(capstone);
    const original = {
      ...withoutSketch,
      schemaVersion: 1,
      annotations: Object.fromEntries(
        Array.from({ length: 13 }, (_, index) => [
          `equation:term-${index}`,
          "x".repeat(WORKSHEET_LIMITS.text),
        ]),
      ),
      explanation: "",
      table: [
        ["Time", "Observation"],
        ["later", "spread"],
      ],
    };
    const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
    const remaining = 131072 - bytes(original);
    assert.ok(remaining > 0 && remaining <= WORKSHEET_LIMITS.text);
    original.explanation = "y".repeat(remaining);
    const raw = JSON.stringify(original);
    assert.equal(bytes(original), 131072);
    const migrated = readWorksheet(original);
    assert.ok(migrated);
    assert.equal(bytes(migrated), 131113);
    const restored = readWorksheet(JSON.parse(exportWorksheet(migrated)));
    assert.ok(restored, "the largest admitted older worksheet must survive its exported upgrade");
    assert.deepEqual(restored, migrated);
    assert.equal(JSON.stringify(original), raw);
    assert.ok(readWorksheet({ ...restored, explanation: `z${restored.explanation.slice(1)}` }));
    assert.equal(readWorksheet({ ...original, explanation: `${original.explanation}z` }), null);
    assert.equal(readWorksheet({ ...migrated, sketch: { description: "z", strokes: [] } }), null);
  });
  it("keeps every drawing point and its description detached across JSON import and export", () => {
    const state = {
      ...emptyWorksheet(capstone),
      sketch: {
        description: "Two ledgers, linked by subtraction.\n<not markup>",
        strokes: [
          [
            { x: 0, y: 0 },
            { x: 1000, y: 600 },
          ],
          [{ x: 500, y: 300 }],
        ],
      },
    };
    const restored = readWorksheet(JSON.parse(exportWorksheet(state)));
    assert.deepEqual(restored, state);
    assert.notEqual(restored?.sketch.strokes[0]?.[0], state.sketch.strokes[0]?.[0]);
    assert.equal(
      readWorksheet({ ...state, sketch: { ...state.sketch, strokes: [[{ x: -1, y: 0 }]] } }),
      null,
    );
    let invoked = false;
    const accessor = {
      strokes: [],
      get description() {
        invoked = true;
        return "private";
      },
    };
    assert.equal(readWorksheet({ ...state, sketch: accessor }), null);
    assert.equal(invoked, false);
    const cyclic: unknown[] = [];
    cyclic.push(cyclic);
    assert.equal(readWorksheet({ ...state, sketch: { description: "", strokes: cyclic } }), null);
  });
  it("refuses poisoned map keys and incompatible edition identities", () => {
    const state = emptyWorksheet(capstone);
    assert.equal(readWorksheet({ ...state, annotations: JSON.parse('{"__proto__":"bad"}') }), null);
    assert.equal(worksheetMatches({ ...state, capstoneId: "other" }, capstone), false);
    assert.equal(
      worksheetMatches({ ...state, order: ["unknown", ...state.order.slice(1)] }, capstone),
      false,
    );
    assert.equal(
      worksheetMatches({ ...state, assumptionMarks: { missing: ["independent"] } }, capstone),
      false,
    );
    assert.equal(
      worksheetMatches({ ...state, assumptionMarks: { a: ["missing"] } }, capstone),
      false,
    );
  });
  it("bounds tables, text and complete UTF-8 payloads without truncation", () => {
    const state = emptyWorksheet(capstone);
    for (const bad of [
      { ...state, explanation: "x".repeat(WORKSHEET_LIMITS.text + 1) },
      { ...state, table: Array.from({ length: 11 }, () => [""]) },
      { ...state, table: [Array(7).fill("")] },
      { ...state, table: [["a"], ["b", "c"]] },
      { ...state, table: [["x".repeat(WORKSHEET_LIMITS.cell + 1)]] },
      {
        ...state,
        annotations: Object.fromEntries(
          Array.from({ length: 6 }, (_, i) => [`term-${i}`, "字".repeat(9000)]),
        ),
      },
    ])
      assert.equal(readWorksheet(bad), null);
    assert.notEqual(
      readWorksheet({ ...state, table: Array.from({ length: 10 }, () => Array(6).fill("")) }),
      null,
    );
  });
});
