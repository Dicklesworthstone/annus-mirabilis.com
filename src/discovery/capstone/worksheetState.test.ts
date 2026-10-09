import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assumptionFeedback,
  emptyWorksheet,
  exportWorksheet,
  markAssumption,
  moveClaim,
  readWorksheet,
  worksheetMatches,
  WORKSHEET_LIMITS,
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
      { ...state, schemaVersion: 2 },
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
