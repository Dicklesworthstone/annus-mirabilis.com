import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { lq06Changes } from "./changes.ts";
import { LQ06_CLASSES, LQ06_DEFAULTS, LQ06_PRESETS } from "./definition.ts";
import { mergeLq06Parameters, validateLq06Parameters } from "./parameters.ts";

test("all published presets pass the parameter contract", () => {
  for (const preset of Object.values(LQ06_PRESETS))
    assert.equal(validateLq06Parameters(preset.parameters).kind, "accepted");
});
for (const bad of ["unknown", "", "modern-codata-2022", null, 1, {}, undefined]) {
  test(`unsupported constant set ${String(bad)} is refused`, () => {
    assert.equal(validateLq06Parameters({ ...LQ06_DEFAULTS, constantSetId: bad }).kind, "refused");
  });
}
for (const field of [
  "radiationEnergy",
  "frequency",
  "gasParticles",
  "volumeRatio",
  "temperature",
]) {
  for (const bad of [NaN, Infinity, -Infinity, 0, -1]) {
    test(`${field} rejects ${bad}`, () => {
      assert.equal(validateLq06Parameters({ ...LQ06_DEFAULTS, [field]: bad }).kind, "refused");
    });
  }
}
test("unsafe and fractional particle counts are refused", () => {
  for (const gasParticles of [1.5, 2 ** 53])
    assert.equal(mergeLq06Parameters(LQ06_DEFAULTS, { gasParticles }).kind, "refused");
});
test("partial patches do not invoke getters or accept unknown fields", () => {
  let calls = 0;
  assert.equal(
    mergeLq06Parameters(LQ06_DEFAULTS, {
      get frequency() {
        calls++;
        return 1;
      },
    }).kind,
    "refused",
  );
  assert.equal(calls, 0);
  for (const patch of [
    null,
    [],
    "x",
    { frequency: 1, extra: true },
    { [Symbol("x")]: 1 },
    Object.create({ frequency: 1 }),
  ]) {
    assert.equal(mergeLq06Parameters(LQ06_DEFAULTS, patch).kind, "refused");
  }
});
test("a thrown proxy trap is a refusal, not a state change", () => {
  const p = new Proxy(
    {},
    {
      getPrototypeOf() {
        throw new Error("trap");
      },
    },
  );
  assert.equal(mergeLq06Parameters(LQ06_DEFAULTS, p).kind, "refused");
});
test("merged parameters are immutable and leave the caller untouched", () => {
  const patch = { frequency: 8e14 };
  const result = mergeLq06Parameters(LQ06_DEFAULTS, patch);
  assert.equal(result.kind, "accepted");
  patch.frequency = 1;
  assert.equal(result.data.frequency, 8e14);
  assert.ok(Object.isFrozen(result.data));
});
for (let mask = 1; mask < 8; mask++) {
  test(`all changed classes survive combination ${mask}`, () => {
    const next = {
      ...LQ06_DEFAULTS,
      ...(mask & 1
        ? { radiationEnergy: 2e-9, constantSetId: "einstein-1905-light-quanta-printed" }
        : {}),
      ...(mask & 2 ? { volumeRatio: 2 } : {}),
      ...(mask & 4
        ? { selectedSubexpression: "N_E_over_R_beta_nu", forkAChoice: "independent-quanta" }
        : {}),
    };
    const changes = lq06Changes(LQ06_DEFAULTS, next);
    assert.deepEqual(Object.assign({}, LQ06_DEFAULTS, ...changes.map((c) => c.patch)), next);
    assert.equal(changes.length, [1, 2, 4].filter((bit) => mask & bit).length);
    assert.ok(Object.isFrozen(changes));
  });
}
test("constant-set changes fork physics, presentation and volume changes do not", () => {
  assert.equal(LQ06_CLASSES.constantSetId, "input");
  assert.equal(
    lq06Changes(LQ06_DEFAULTS, {
      ...LQ06_DEFAULTS,
      constantSetId: "einstein-1905-light-quanta-printed",
    })[0].command,
    "setup-change",
  );
  assert.equal(
    lq06Changes(LQ06_DEFAULTS, { ...LQ06_DEFAULTS, volumeRatio: 2 })[0].command,
    "measurement-change",
  );
  assert.equal(
    lq06Changes(LQ06_DEFAULTS, { ...LQ06_DEFAULTS, selectedSubexpression: "E" })[0].command,
    "presentation-change",
  );
  assert.deepEqual(lq06Changes(LQ06_DEFAULTS, LQ06_DEFAULTS), []);
});

/**
 * `unsupported-parameter-class`, at changes.ts line 16, CANNOT BE REACHED TODAY, and this is the record
 * rather than a test of the site (am-r3qt). It is not a dead guard: it is a live one whose
 * condition no current data satisfies.
 *
 * lq06Changes looks each changed parameter's class up in a `groups` object with three keys -
 * input, measurement, presentation - and refuses a class that is not among them. ParameterClass
 * has FIVE members: the two it omits are `observer` and `estimator`. LQ06_CLASSES assigns only
 * the three covered classes across all nine parameters, so no key can reach the throw.
 *
 * It goes live the day someone classifies an LQ-06 parameter as observer or estimator, which is
 * exactly the mistake it exists to catch - and under AGENTS.md's runtime contract those two are
 * the classes that MUST NOT be folded into a setup change, because an observer change may not
 * restart an experiment or consume new randomness.
 *
 * So the premise is asserted rather than the site driven, following decode.ts's precedent: add a
 * fourth class to LQ06_CLASSES without extending `groups`, and this goes red.
 *
 * THE CODE NAME IS DELIBERATELY NOT IN THE TEST'S TITLE. The refusal ratchet credits a site when
 * a test block names its code, and this block would then read as PAYMENT for a site nothing
 * drives - the bead's own words are "a test that merely mentions the code is not payment".
 * THIS RECORD MUST NOT CREDIT THE SITE, and getting that right took three attempts. The rule,
 * established by planting rather than by reading the scanner:
 *
 *   a code named in a STRING LITERAL in executable code    CREDITS the site
 *   a code named in a COMMENT                              does not
 *   a file-and-line in the parenthesised citation form     CREDITS, and comments are read for it
 *
 * So a category-3 record CAN name its refusal, as long as the name stays in prose and the line
 * number is never written in the parenthesised form. This block does both, and changes.ts stays
 * on the untested list, which is correct: it is documented, not driven.
 *
 * WHAT COST THE THIRD ATTEMPT, because it is worth more than the rule: my own explanation of the
 * second attempt QUOTED the citation form while saying I had removed it, and the scanner read the
 * quotation. That is AGENTS.md's "a gate that forbids a construct must read code, not text",
 * arriving from the other side - the prose describing a citation is a citation. The line number
 * above is therefore written as "line 16" and nowhere in parentheses.
 */
test("the lq06 parameter-class guard is unreachable, and the two facts that make it so", () => {
  const source = readFileSync(new URL("./changes.ts", import.meta.url), "utf8");
  const block = source.slice(source.indexOf("const groups"), source.indexOf("for (const key of"));
  const covered = [...block.matchAll(/^\s+(\w+):\s*\{\},/gm)].map((m) => m[1]);
  assert.deepEqual(covered, ["input", "measurement", "presentation"]);

  // Every class LQ06_CLASSES actually assigns is one the groups object covers. Assign a fourth
  // and this fails, which is the whole point of recording the claim instead of asserting a throw
  // nothing can produce.
  const assigned = [...new Set(Object.values(LQ06_CLASSES))].sort();
  assert.deepEqual(assigned, ["input", "measurement", "presentation"]);
  for (const cls of assigned) assert.ok(covered.includes(cls), `groups must cover ${cls}`);

  // Non-vacuity: there are parameters to classify, so "every class is covered" is a result.
  assert.ok(Object.keys(LQ06_CLASSES).length >= 9);
});
