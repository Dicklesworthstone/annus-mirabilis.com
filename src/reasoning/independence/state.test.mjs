import assert from "node:assert/strict";
import { test } from "node:test";
import { OCCUPANCY_CHECKS } from "../../physics/reference/configurationCountermodels.ts";
import {
  analyzeOccupancyRecord,
  applyOccupancySettings,
  clearOccupancyRecord,
  createOccupancyState,
  decodeOccupancyLink,
  encodeOccupancyLink,
  illustrativeOccupancyRecord,
  parseOccupancyHistogram,
  selectOccupancyChecks,
} from "./state.ts";

test("the worked question starts underdetermined with no evidence", () => {
  const state = createOccupancyState();
  assert.equal(state.distinction.status, "underdetermined");
  assert.equal(state.evidence, null);
  assert.equal(state.evidenceSource, null);
});

test("measurement selection preserves evidence and does not manufacture a winner", () => {
  const state = analyzeOccupancyRecord(createOccupancyState(), "8,0,0,0,8");
  const selected = selectOccupancyChecks(state, ["all-inside"]);
  assert.equal(selected.distinction.status, "different-predictions");
  assert.equal(selected.evidence, state.evidence);
  assert.equal(selected.evidence.status, "both-possible");
  assert.deepEqual(state.checks, ["mean-count"]);
});

for (const settings of [
  { n: 5, quarters: 2 },
  { n: 4, quarters: 1 },
]) {
  test(`changed experiment clears evidence ${JSON.stringify(settings)}`, () => {
    const state = illustrativeOccupancyRecord("mixed");
    const next = applyOccupancySettings(state, settings);
    assert.equal(next.evidence, null);
    assert.equal(next.evidenceSource, null);
    assert.equal(state.evidence.trials, 16);
  });
}

test("reapplying identical settings keeps the accepted record", () => {
  const state = illustrativeOccupancyRecord("mixed");
  assert.equal(applyOccupancySettings(state, { n: 4, quarters: 2 }).evidence, state.evidence);
});

test("refused settings and refused records leave the previous accepted state untouched", () => {
  const state = illustrativeOccupancyRecord("mixed"),
    before = JSON.stringify(state);
  assert.throws(() => applyOccupancySettings(state, { n: Infinity, quarters: 2 }));
  assert.throws(() => analyzeOccupancyRecord(state, "1,4,,4,1"));
  assert.throws(() => analyzeOccupancyRecord(state, "10001,0,0,0,0"));
  assert.throws(() => selectOccupancyChecks(state, ["mean-count", "mean-count"]));
  assert.equal(JSON.stringify(state), before);
});

test("constructed records are explicitly labeled and never preserved as measured data", () => {
  const mixed = illustrativeOccupancyRecord("mixed");
  const endpoints = illustrativeOccupancyRecord("all-or-none");
  assert.equal(mixed.evidenceSource, "illustrative");
  assert.equal(endpoints.evidenceSource, "illustrative");
  assert.equal(mixed.evidence.empiricalMean, endpoints.evidence.empiricalMean);
  assert.notEqual(mixed.evidence.empiricalVariance, endpoints.evidence.empiricalVariance);
  assert.equal(analyzeOccupancyRecord(mixed, "1 4 6 4 1").evidenceSource, "reader-entered");
  assert.throws(() => illustrativeOccupancyRecord("other"));
});

test("clearing private evidence leaves model settings and selected measurements intact", () => {
  const state = illustrativeOccupancyRecord("mixed"),
    cleared = clearOccupancyRecord(state);
  assert.equal(cleared.evidence, null);
  assert.equal(cleared.evidenceSource, null);
  assert.equal(cleared.comparison, state.comparison);
  assert.equal(cleared.checks, state.checks);
});

test("comma or whitespace records preserve bin order, including zero bins", () => {
  for (const text of ["1, 0, 2, 0, 3", "1 0 2 0 3", "1\n0\n2\n0\n3", " 1,0,2,0,3 "])
    assert.deepEqual(parseOccupancyHistogram(text, 4), [1, 0, 2, 0, 3]);
});

for (const text of [
  "",
  "1,,2,0,3",
  "1,0,2,0,3,",
  "1,0,2,0",
  "1,0,2,0,3,0",
  "1,0,2e0,0,3",
  "1,0,+2,0,3",
  "1,0,-2,0,3",
  "1,0,2.0,0,3",
  "1,0,02,0,3",
  "1,0,0x2,0,3",
  "1,0,NaN,0,3",
  "1,0,Infinity,0,3",
  "1,0,2 0,3",
  "x".repeat(1025),
]) {
  test(`refuse malformed histogram ${text.slice(0, 32)}`, () =>
    assert.throws(() => parseOccupancyHistogram(text, 4)));
}

test("every admitted setting and measurement subset round-trips without evidence", () => {
  for (let n = 1; n <= 12; n++) {
    for (let quarters = 0; quarters <= 4; quarters++) {
      for (let mask = 0; mask < 16; mask++) {
        const checks = OCCUPANCY_CHECKS.filter((_, index) => mask & (1 << index));
        const decoded = decodeOccupancyLink(encodeOccupancyLink({ n, quarters }, checks));
        assert.equal(decoded.kind, "settings");
        assert.deepEqual(decoded.settings, { n, quarters });
        assert.deepEqual(decoded.checks, checks);
        const restored = createOccupancyState(decoded.settings, decoded.checks);
        assert.equal(restored.evidence, null);
      }
    }
  }
});

test("share links contain an allowlisted question, not private evidence or arbitrary fields", () => {
  const state = illustrativeOccupancyRecord("mixed");
  const encoded = encodeOccupancyLink(state.comparison.settings, state.checks);
  assert.deepEqual([...new URLSearchParams(encoded).keys()].sort(), [
    "checks",
    "n",
    "occupancy",
    "q",
  ]);
  const decoded = decodeOccupancyLink(`${encoded}&counts=secret&prediction=private`);
  assert.deepEqual(Object.keys(decoded).sort(), ["checks", "kind", "settings"]);
  assert.throws(() =>
    encodeOccupancyLink(
      { ...state.comparison.settings, counts: state.evidence.counts },
      state.checks,
    ),
  );
});

for (const query of [
  "?occupancy=1",
  "?n=4&q=2&checks=mean-count",
  "?occupancy=2&n=4&q=2&checks=mean-count",
  "?occupancy=1&occupancy=1&n=4&q=2&checks=mean-count",
  "?occupancy=1&n=4&n=5&q=2&checks=mean-count",
  "?occupancy=1&n=04&q=2&checks=mean-count",
  "?occupancy=1&n=0&q=2&checks=mean-count",
  "?occupancy=1&n=13&q=2&checks=mean-count",
  "?occupancy=1&n=4&q=02&checks=mean-count",
  "?occupancy=1&n=4&q=5&checks=mean-count",
  "?occupancy=1&n=4&q=2&checks=mean-count,mean-count",
  "?occupancy=1&n=4&q=2&checks=__proto__",
  "?occupancy=1&n=4&q=2&checks=mean-count,",
  "?occupancy=1&n=4&q=2&checks=&checks=mean-count",
  "x".repeat(1025),
]) {
  test(`refuse malformed question ${query.slice(0, 60)}`, () =>
    assert.equal(decodeOccupancyLink(query).kind, "invalid"));
}

test("ordinary visits differ from malformed shared questions", () => {
  assert.equal(decodeOccupancyLink("").kind, "absent");
  assert.equal(decodeOccupancyLink("?utm_source=lesson").kind, "absent");
  assert.equal(decodeOccupancyLink("?occupancy=").kind, "invalid");
});

test("independent workbenches have no shared mutable evidence", () => {
  const first = analyzeOccupancyRecord(createOccupancyState(), "1,4,6,4,1");
  const second = createOccupancyState();
  assert.equal(second.evidence, null);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.checks));
  assert.ok(Object.isFrozen(first.comparison.independent.statistics));
});
