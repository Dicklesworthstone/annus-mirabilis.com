import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateEntranceRecord } from "../content/entrances/entranceRecord.ts";
import { scanSkillSymbols } from "../content/entrances/symbolGuard.ts";
import { validateSr01Parameters } from "../experiments/sr01/parameters.ts";
import { decodeSr01Settings } from "../experiments/sr01/permalink.ts";
import { snapshotOutputs } from "../experiments/sr01/session.ts";
import { synchronizationRound } from "../physics/reference/events.ts";
import {
  CLOCK_INITIAL,
  CLOCK_WORKED_EXAMPLES,
  clockExample,
  parseClockDraft,
  requireClockExample,
} from "../reader/entrances/clockExample.ts";

const record = JSON.parse(
  await readFile(
    new URL(
      "../../content/arguments/special-relativity/entrance-special-relativity.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

for (const [departure, reception, expected] of [
  [0, 10, 5],
  [20, 30, 25],
  [-20, -10, -15],
  [0, 11, 5.5],
  [2.5, 7.5, 5],
]) {
  test(`the real clock owner assigns ${expected} for ${departure} to ${reception}`, () => {
    const example = requireClockExample({ departure, reception });
    const owner = synchronizationRound({
      emissionTimeA: departure,
      receptionTimeA: reception,
      separationLs: example.separationLs,
    });
    assert.equal(owner.status, "value");
    assert.equal(example.assigned, owner.value.assignedRemoteTime);
    assert.equal(example.assigned, expected);
    assert.equal(owner.value.equalsC, true);
  });
  test(`both real laboratory handoffs reproduce ${departure} to ${reception} without dropping the preset`, () => {
    const example = requireClockExample({ departure, reception });
    for (const [href, pairBeta] of [
      [example.labHref, 0],
      [example.movingPairHref, 0.6],
    ]) {
      const decoded = decodeSr01Settings(new URL(href, "https://annus-mirabilis.com").search);
      assert.equal(decoded.kind, "settings");
      assert.equal(validateSr01Parameters(decoded.parameters).kind, "accepted");
      assert.equal(decoded.parameters.emissionTimeA, departure);
      assert.equal(
        decoded.parameters.emissionTimeA + 2 * decoded.parameters.stationSeparationLs,
        reception,
      );
      assert.equal(decoded.parameters.pairBeta, pairBeta);
      assert.equal(decoded.parameters.rodBeta, 0);
      assert.equal(decoded.parameters.frameBeta, 0);
      const outputs = snapshotOutputs(decoded.parameters);
      assert.equal(outputs.find((o) => o.quantityId === "assignedRemoteTime").value, expected);
      assert.equal(outputs.find((o) => o.quantityId === "criterionOffset").value, 0);
    }
  });
}
for (const input of [
  null,
  {},
  { departure: 0, reception: 0 },
  { departure: 10, reception: 0 },
  { departure: NaN, reception: 10 },
  { departure: 0, reception: Infinity },
  { departure: 0, reception: 1e7 },
  { departure: -1e7, reception: 0 },
  { departure: "0", reception: 10 },
]) {
  test(`invalid clock record is refused, not repaired: ${JSON.stringify(input)}`, () =>
    assert.equal(clockExample(input).kind, "refused"));
}
for (const [departure, reception] of [
  ["", "10"],
  [" ", "10"],
  ["0", "10seconds"],
  ["0x10", "20"],
  ["0", "Infinity"],
  ["0", "1e999"],
  ["NaN", "10"],
  ["0", "9".repeat(65)],
]) {
  test(`draft parsing does not coerce or prefix-parse: ${JSON.stringify([departure, reception])}`, () =>
    assert.equal(parseClockDraft(departure, reception).kind, "refused"));
}
test("complete decimal and exponent syntax remains supported", () => {
  assert.equal(parseClockDraft("+2.5", " 7.5 ").example.assigned, 5);
  assert.equal(parseClockDraft("0", "1e1").example.assigned, 5);
});
test("the original accepted example is immutable across edits and refusals", () => {
  const input = { departure: 0, reception: 10 };
  const first = requireClockExample(input);
  input.reception = 20;
  assert.equal(first.assigned, 5);
  assert.equal(first.readings.reception, 10);
  parseClockDraft("bad", "input");
  assert.equal(first.labHref, CLOCK_INITIAL.labHref);
  assert.throws(() => {
    first.readings.reception = 100;
  });
});
test("the authored entries and choices are complete, draft, and symbol-free", () => {
  const checked = validateEntranceRecord(record);
  assert.equal(checked.id, "entrance-special-relativity");
  assert.deepEqual(
    checked.authoredEntries,
    CLOCK_WORKED_EXAMPLES.flatMap((e) => [e.readings.departure, e.readings.reception]),
  );
  assert.deepEqual(
    checked.choices.map((c) => c.text),
    ["0", "5", "10", "Nothing tells us yet"],
  );
  assert.ok(checked.choices.every((c) => c.explanation.length > 30));
  assert.ok(checked.agreement.includes("not a measurement"));
  assert.equal(checked.bridge.reviewState, "draft");
  for (const text of [checked.question, checked.story, checked.bridge.newSkill])
    assert.equal(scanSkillSymbols(text).ok, true);
});
test("invalid bridge guidance is rejected by the existing schema", () => {
  const bad = structuredClone(record);
  bad.bridge.continueWith[0] = { route: "less-guidance", targetId: "instrument:sr-03" };
  assert.throws(() => validateEntranceRecord(bad));
});

for (const search of [
  "?ab=",
  "?ab=10junk",
  "?ab=5&ab=10",
  "?pairv=0&pairv=0.6",
  "?frame=Infinity",
  "?ab=0x10",
  `?ab=${"1".repeat(4096)}`,
]) {
  test(`shared settings reject ambiguous numeric input before the page applies it: ${search.slice(0, 60)}`, () => {
    assert.equal(decodeSr01Settings(search).kind, "invalid");
  });
}
test("legacy partial settings and unrelated tracking keys remain compatible", () => {
  const decoded = decodeSr01Settings("?ab=5&utm_source=entrance");
  assert.equal(decoded.kind, "settings");
  assert.equal(decoded.parameters.stationSeparationLs, 5);
  assert.equal(decodeSr01Settings("?utm_source=entrance").kind, "none");
});
