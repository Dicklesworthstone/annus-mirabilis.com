import assert from "node:assert/strict";
import test from "node:test";
import { LQ06_DEFAULTS, LQ06_PRESETS, LQ06_CLASSES } from "./definition.ts";
import { lq06Changes } from "./changes.ts";
import { mergeLq06Parameters, validateLq06Parameters } from "./parameters.ts";

test("all published presets pass the parameter contract", () => {
  for (const preset of Object.values(LQ06_PRESETS)) assert.equal(validateLq06Parameters(preset.parameters).kind, "accepted");
});
for (const bad of ["unknown", "", "modern-codata-2022", null, 1, {}, undefined]) {
  test(`unsupported constant set ${String(bad)} is refused`, () => {
    assert.equal(validateLq06Parameters({ ...LQ06_DEFAULTS, constantSetId: bad }).kind, "refused");
  });
}
for (const field of ["radiationEnergy", "frequency", "gasParticles", "volumeRatio", "temperature"]) {
  for (const bad of [NaN, Infinity, -Infinity, 0, -1]) {
    test(`${field} rejects ${bad}`, () => {
      assert.equal(validateLq06Parameters({ ...LQ06_DEFAULTS, [field]: bad }).kind, "refused");
    });
  }
}
test("unsafe and fractional particle counts are refused", () => {
  for (const gasParticles of [1.5, 2 ** 53]) assert.equal(mergeLq06Parameters(LQ06_DEFAULTS, { gasParticles }).kind, "refused");
});
test("partial patches do not invoke getters or accept unknown fields", () => {
  let calls = 0;
  assert.equal(mergeLq06Parameters(LQ06_DEFAULTS, { get frequency() { calls++; return 1; } }).kind, "refused");
  assert.equal(calls, 0);
  for (const patch of [null, [], "x", { frequency: 1, extra: true }, { [Symbol("x")]: 1 }, Object.create({ frequency: 1 })]) {
    assert.equal(mergeLq06Parameters(LQ06_DEFAULTS, patch).kind, "refused");
  }
});
test("a thrown proxy trap is a refusal, not a state change", () => {
  const p = new Proxy({}, { getPrototypeOf() { throw new Error("trap"); } });
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
    const next = { ...LQ06_DEFAULTS,
      ...(mask & 1 ? { radiationEnergy: 2e-9, constantSetId: "einstein-1905-light-quanta-printed" } : {}),
      ...(mask & 2 ? { volumeRatio: 2 } : {}),
      ...(mask & 4 ? { selectedSubexpression: "N_E_over_R_beta_nu", forkAChoice: "independent-quanta" } : {}),
    };
    const changes = lq06Changes(LQ06_DEFAULTS, next);
    assert.deepEqual(Object.assign({}, LQ06_DEFAULTS, ...changes.map(c => c.patch)), next);
    assert.equal(changes.length, [1, 2, 4].filter(bit => mask & bit).length);
    assert.ok(Object.isFrozen(changes));
  });
}
test("constant-set changes fork physics, presentation and volume changes do not", () => {
  assert.equal(LQ06_CLASSES.constantSetId, "input");
  assert.equal(lq06Changes(LQ06_DEFAULTS, { ...LQ06_DEFAULTS, constantSetId: "einstein-1905-light-quanta-printed" })[0].command, "setup-change");
  assert.equal(lq06Changes(LQ06_DEFAULTS, { ...LQ06_DEFAULTS, volumeRatio: 2 })[0].command, "measurement-change");
  assert.equal(lq06Changes(LQ06_DEFAULTS, { ...LQ06_DEFAULTS, selectedSubexpression: "E" })[0].command, "presentation-change");
  assert.deepEqual(lq06Changes(LQ06_DEFAULTS, LQ06_DEFAULTS), []);
});
