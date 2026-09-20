import assert from "node:assert/strict";
import test from "node:test";
import { quantumConstantsSI, thermalConstantSI } from "./quantumConstants.ts";

function fixture(id, unit, thermal, action, beta = 4.866e-11) {
  const direct = id === "modern-si-2019";
  return {
    id,
    gasConstantProvenance: direct ? "defined" : "measured-without-counting-molecules",
    entries: [
      { quantityId: direct ? "boltzmannConstant" : "molarGasConstant", unit },
      { quantityId: "planckConstant", unit: unit.startsWith("erg") ? "erg s" : "J s" },
      { quantityId: "wienConstantBeta", unit: "s K" },
    ],
    values: { thermal, planckConstant: action, wienConstantBeta: beta },
  };
}
const readers = {
  thermal: (s) => ({ setId: s.id, value: s.values.thermal }),
  read: (s, id) => ({ setId: s.id, value: s.values[id] }),
};
const modern = fixture("modern-si-2019", "J/K", 1.380649e-23, 6.62607015e-34);
const printed = fixture("einstein-1905-light-quanta-printed", "erg/(mol K)", 8.31e7 / 6.17e23, NaN);
const close = (actual, expected) => assert.ok(Math.abs(actual / expected - 1) < 2e-14, `${actual} != ${expected}`);

test("modern SI constants are unchanged and carry their set identity", () => {
  assert.deepEqual(quantumConstantsSI(modern, readers), { kB: 1.380649e-23, h: 6.62607015e-34, constantSetId: modern.id });
});
test("printed R/N and beta produce SI energies without reading a modern h", () => {
  const readIds = [];
  const scale = quantumConstantsSI(printed, { ...readers, read: (s, id) => { readIds.push(id); return readers.read(s, id); } });
  assert.deepEqual(readIds, ["wienConstantBeta"]);
  close(scale.kB, (8.31e7 / 6.17e23) * 1e-7);
  close(scale.h, (8.31e7 * 4.866e-11 / 6.17e23) * 1e-7);
  close(scale.h * 6e14, 3.932232739059967585089141005e-19);
  close(3 * scale.kB * 3000, 1.212155591572123e-19);
  assert.notEqual(scale.h, 6.62607015e-34);
});
test("ordinary CGS action and thermal constants are both converted", () => {
  const scale = quantumConstantsSI(fixture("planck-fixture", "erg/(mol K)", 1.38e-16, 6.55e-27), readers);
  close(scale.kB, 1.38e-23);
  close(scale.h, 6.55e-34);
});
test("historical Brownian thermal-only use does not require an action constant", () => {
  const s = fixture("brownian-fixture", "J/(mol K)", 8.31 / 6e23, NaN);
  close(thermalConstantSI(s, readers), 8.31 / 6e23);
});
for (const value of [NaN, Infinity, -Infinity, 0, -1]) {
  test(`nonpositive or nonfinite thermal value ${value} is refused`, () => {
    assert.throws(() => quantumConstantsSI({ ...modern, values: { ...modern.values, thermal: value } }, readers), RangeError);
  });
  test(`nonpositive or nonfinite action value ${value} is refused`, () => {
    assert.throws(() => quantumConstantsSI({ ...modern, values: { ...modern.values, planckConstant: value } }, readers), RangeError);
  });
  test(`nonpositive or nonfinite historical beta ${value} is refused`, () => {
    assert.throws(() => quantumConstantsSI({ ...printed, values: { ...printed.values, wienConstantBeta: value } }, readers), RangeError);
  });
}
test("mixed-set thermal values are rejected", () => {
  assert.throws(() => quantumConstantsSI(modern, { ...readers, thermal: () => ({ setId: printed.id, value: 1e-23 }) }), /mix constant sets/);
});
test("mixed-set action values are rejected", () => {
  assert.throws(() => quantumConstantsSI(modern, { ...readers, read: () => ({ setId: printed.id, value: 1e-34 }) }), /mix constant sets/);
});
for (const quantityId of ["boltzmannConstant", "planckConstant"]) {
  test(`unknown units on ${quantityId} do not silently become SI`, () => {
    const s = { ...modern, entries: modern.entries.map(e => e.quantityId === quantityId ? { ...e, unit: "unknown" } : e) };
    assert.throws(() => quantumConstantsSI(s, readers), /Unsupported/);
  });
  test(`missing ${quantityId} is not replaced with a default`, () => {
    assert.throws(() => quantumConstantsSI({ ...modern, entries: modern.entries.filter(e => e.quantityId !== quantityId) }, readers), TypeError);
  });
}
test("duplicate constants are rejected", () => {
  assert.throws(() => quantumConstantsSI({ ...modern, entries: [...modern.entries, modern.entries[0]] }, readers), TypeError);
});
test("incorrect historical beta units are rejected", () => {
  assert.throws(() => quantumConstantsSI({ ...printed, entries: printed.entries.map(e => e.quantityId === "wienConstantBeta" ? { ...e, unit: "Hz" } : e) }, readers), /s K/);
});
test("underflow during the CGS conversion is rejected", () => {
  assert.throws(() => thermalConstantSI(fixture("tiny-fixture", "erg/(mol K)", Number.MIN_VALUE, 1), readers), RangeError);
});
test("overflow deriving the historical action coefficient is rejected", () => {
  assert.throws(() => quantumConstantsSI(fixture(printed.id, "J/(mol K)", Number.MAX_VALUE, NaN, Number.MAX_VALUE), readers), RangeError);
});
test("inputs are not changed and scales are immutable", () => {
  const before = JSON.stringify(printed);
  const scales = quantumConstantsSI(printed, readers);
  assert.equal(JSON.stringify(printed), before);
  assert.ok(Object.isFrozen(scales));
});
