import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateEntranceRecord } from "../content/entrances/entranceRecord.ts";
import { scanSkillSymbols } from "../content/entrances/symbolGuard.ts";
import { decodeLq05Settings } from "../experiments/lq05/permalink.ts";
import { validateLq05Parameters } from "../experiments/lq05/parameters.ts";
import { enumerateConfigurations, independentPointsProbability, lockedPositionsProbability } from "../physics/reference/radiation/configurations.ts";
import { partName, requireTokenExample, tokenExample, TOKEN_INITIAL, TOKEN_WORKED_EXAMPLES } from "../reader/entrances/lightQuantaExample.ts";

const record = JSON.parse(await readFile(new URL("../../content/arguments/light-quanta/entrance-light-quanta.json", import.meta.url), "utf8"));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-14, `${a} differs from ${b}`);

for (const example of TOKEN_WORKED_EXAMPLES) {
  const { tokens, parts, locked } = example.setup;
  test(`${tokens} tokens, ${parts} parts, ${locked ? "locked" : "independent"}: exhaustive table agrees with real reference owners`, () => {
    const expected = enumerateConfigurations(locked ? 1 : tokens, parts);
    assert.equal(expected.status, "value");
    assert.equal(example.total, expected.totalConfigurations);
    assert.equal(example.arrangements.length, example.total);
    assert.equal(new Set(example.arrangements.map(r => r.parts.join(","))).size, example.total);
    assert.equal(example.arrangements.filter(r => r.allLeft).length, example.favorable);
    for (const arrangement of example.arrangements) {
      assert.equal(arrangement.parts.length, tokens);
      assert.ok(arrangement.parts.every(p => Number.isInteger(p) && p >= 0 && p < parts));
      if (locked) assert.equal(new Set(arrangement.parts).size, 1);
    }
    close(example.favorable / example.total, example.probability);
    close(example.probability, locked ? lockedPositionsProbability(tokens, 1 / parts).value : independentPointsProbability(tokens, 1 / parts).value);
  });
  test(`${tokens}/${parts}/${locked}: actual laboratory codec retains the exact counting setup`, () => {
    const decoded = decodeLq05Settings(new URL(example.labHref, "https://annus-mirabilis.com").search);
    assert.equal(decoded.kind, "settings");
    assert.equal(validateLq05Parameters(decoded.parameters).kind, "accepted");
    assert.equal(decoded.parameters.n, tokens);
    assert.equal(decoded.parameters.f, 1 / parts);
    assert.equal(decoded.parameters.locked, locked);
    assert.equal(decoded.parameters.view, "enumeration");
  });
}

for (const input of [null, {}, { tokens: 0, parts: 2, locked: false }, { tokens: 1.5, parts: 2, locked: false },
  { tokens: NaN, parts: 2, locked: false }, { tokens: 1000000, parts: 2, locked: false },
  { tokens: 5, parts: 2, locked: false }, { tokens: 11, parts: 2, locked: true },
  { tokens: 2, parts: 0, locked: false }, { tokens: 2, parts: 4, locked: false },
  { tokens: 2, parts: 2, locked: "true" }]) {
  test(`unadmitted teaching setup is refused before enumeration: ${JSON.stringify(input)}`, () => {
    assert.equal(tokenExample(input).kind, "refused");
  });
}

test("published initial example is the two-token, half-space enumeration", () => {
  assert.deepEqual(TOKEN_INITIAL.setup, { tokens: 2, parts: 2, locked: false });
  assert.equal(TOKEN_INITIAL.total, 4);
  assert.equal(TOKEN_INITIAL.favorable, 1);
  assert.equal(partName(1, 2), "right");
  assert.equal(partName(1, 3), "middle");
});
test("the shared-choice limit does not silently pretend ten independent choices were enumerated", () => {
  assert.equal(requireTokenExample({ tokens: 10, parts: 2, locked: true }).total, 2);
  assert.equal(tokenExample({ tokens: 10, parts: 2, locked: false }).kind, "refused");
});
test("results are immutable and independent of subsequent draft mutation", () => {
  const input = { tokens: 3, parts: 3, locked: false };
  const example = requireTokenExample(input);
  input.tokens = 1;
  assert.equal(example.setup.tokens, 3);
  assert.throws(() => { example.arrangements[0].parts[0] = 2; });
  assert.throws(() => { example.setup.tokens = 1; });
  assert.throws(() => { example.arrangements.push({}); });
});
test("the real entrance validator admits the authored bridge without claiming review", () => {
  const checked = validateEntranceRecord(record);
  assert.equal(checked.id, "entrance-light-quanta");
  assert.equal(checked.bridge.reviewState, "draft");
  assert.equal(scanSkillSymbols(checked.bridge.newSkill).ok, true);
  for (const phrase of ["Section 5", "Section 6", "dilute light", "single color", "as if"])
    assert.ok(checked.bridge.whyUsefulHere.includes(phrase));
  assert.equal(checked.helpEntries.some(e => /not evidence that light is made of dots/.test(e.clarification)), true);
});
test("a bridge cannot become an all-instrument list or omit its skill", () => {
  const sameGuidance = structuredClone(record);
  sameGuidance.bridge.continueWith[0] = { route: "less-guidance", targetId: "instrument:lq-06" };
  assert.throws(() => validateEntranceRecord(sameGuidance));
  const noSkill = structuredClone(record); delete noSkill.bridge.newSkill;
  assert.throws(() => validateEntranceRecord(noSkill));
});
