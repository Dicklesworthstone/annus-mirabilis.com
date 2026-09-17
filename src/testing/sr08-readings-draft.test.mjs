import test from "node:test";
import assert from "node:assert/strict";
import { readVector3, readScalar } from "../experiments/sr08/readings.ts";
import { sr08Draft, parseSr08Draft, SR08_NUMBER_FIELDS } from "../experiments/sr08/draft.ts";
const c = 299792458;
const base = {
  boost: 0.6 * c,
  electricFieldX: 0,
  electricFieldY: 1,
  electricFieldZ: 0,
  magneticFieldX: 0,
  magneticFieldY: 0,
  magneticFieldZ: 1e-6,
  testCharge: 1e-9,
  chargeVelocityX: 0.6 * c,
  chargeVelocityY: 0,
  chargeVelocityZ: 0,
  unitLayer: "si",
  descriptionFrame: "stationary",
  decomposeComponents: true,
  detectorMotion: false,
  detectorSpeed: 0,
};
test("render immutable accepted NumericViews rather than mistaking them for zero", () => {
  const result = {
    status: "value",
    value: Object.freeze({
      length: 3,
      at: (i) => [1, -2, 3][i],
      copy: () => new Float64Array([1, -2, 3]),
    }),
  };
  assert.deepEqual(readVector3(result), [1, -2, 3]);
  assert.ok(Object.isFrozen(readVector3(result)));
});
test("prepared arrays and zero vectors are readable", () => {
  for (const value of [new Float64Array([0, 0, 0]), new Float64Array([1, 2, 3])])
    assert.deepEqual(readVector3({ status: "value", value }), [...value]);
});
test("missing/refused/malformed vectors are not silently replaced by zero", () => {
  for (const item of [
    undefined,
    { status: "outside-domain", reason: "no" },
    { status: "value", value: 0 },
    { status: "value", value: new Float64Array([1, 2]) },
    { status: "value", value: new Float64Array([1, 2, NaN]) },
  ])
    assert.equal(readVector3(item), null);
});
test("scalar absence differs from a real zero", () => {
  assert.equal(readScalar({ status: "value", value: 0 }), 0);
  assert.equal(readScalar({ status: "value", value: NaN }), null);
  assert.equal(readScalar(undefined), null);
});
test("all eleven controls round-trip without changing presentation choices", () => {
  const result = parseSr08Draft(sr08Draft(base, c), base, c);
  assert.equal(result.kind, "accepted");
  assert.deepEqual(result.data, base);
});
for (const key of SR08_NUMBER_FIELDS) {
  test(`blank, malformed or overflowing ${key} is never coerced into an accepted zero`, () => {
    for (const text of ["", " ", "-", ".", "1e", "0x10", "1junk", "NaN", "Infinity", "1e999"]) {
      const draft = { ...sr08Draft(base, c), [key]: text };
      assert.equal(parseSr08Draft(draft, base, c).kind, "refused", `${key}=${text}`);
    }
  });
}
test("negative/scientific notation and explicit zero remain valid drafts", () => {
  const result = parseSr08Draft(
    {
      ...sr08Draft(base, c),
      testCharge: "-1.602176634e-19",
      chargeVelocityY: "-.25",
      electricFieldZ: "0",
    },
    base,
    c,
  );
  assert.equal(result.kind, "accepted");
  assert.equal(result.data.testCharge, -1.602176634e-19);
  assert.equal(result.data.chargeVelocityY, -0.25 * c);
  assert.equal(result.data.electricFieldZ, 0);
});
