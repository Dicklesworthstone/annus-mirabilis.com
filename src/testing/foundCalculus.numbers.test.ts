import assert from "node:assert/strict";
import test from "node:test";
import {
  LN_2,
  LOG10_2,
  logarithmPower,
  PLANCK_TO_ELEMENTARY_CHARGE_RATIO,
} from "../foundations/calculus.ts";
import { withinTolerance } from "../units/tolerance.ts";

test("foundCalculus.numbers: Planck-to-elementary-charge ratio h/e matches CODATA reference", () => {
  const reference = 4.135667697e-15;
  const verdict = withinTolerance(PLANCK_TO_ELEMENTARY_CHARGE_RATIO, reference, {
    relative: 1e-8,
  });
  assert.equal(verdict.ok, true, `h/e comparison failed: diff=${verdict.diff}`);
});

test("foundCalculus.numbers: ln(2) approx 0.693147 vs log10(2) approx 0.301030", () => {
  // Reference value for ln(2) rounded to 8 digits
  const ln2Ref = Number("0.69314718");
  const log10_2Ref = 0.30102999;

  const vLn = withinTolerance(LN_2, ln2Ref, { absolute: 1e-5 });
  assert.equal(vLn.ok, true, "ln(2) must match 0.693147 to 5 decimal places");

  const vLog10 = withinTolerance(LOG10_2, log10_2Ref, { absolute: 1e-5 });
  assert.equal(vLog10.ok, true, "log10(2) must match 0.301030 to 5 decimal places");

  // In 1905 notation, printed lg 2 was ln 2 (~0.693147), not log10 2 (~0.301030)
  assert.notEqual(Math.round(LN_2 * 1000), Math.round(LOG10_2 * 1000));
});

test("foundCalculus.numbers: logarithm identity ln(f^n) = n ln(f) for n = 10, f = 1/2", () => {
  const n = 10;
  const f = 0.5;
  const result = logarithmPower(f, n);
  const expected = -6.931472;

  const verdict = withinTolerance(result, expected, { absolute: 1e-5 });
  assert.equal(verdict.ok, true, `ln((1/2)^10) must match -6.931472, got ${result}`);

  // Exact identity verification
  const exact = Math.log(f ** n);
  assert.equal(Math.abs(result - exact) < 1e-14, true);
});
