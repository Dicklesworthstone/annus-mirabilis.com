import test from "node:test";
import assert from "node:assert/strict";
import { ftcs1d, ftcsAdvance, ftcsAnalyticComparison, REFERENCE_FTCS_BUDGET } from "../physics/reference/diffusion.ts";
import { decodeRefusal, decodeOutcome, decodeResult } from "../experiments/results/codec.ts";
const p = { n: 5, frames: 3, stepsPerFrame: 1, D: 1, dx: 1, dt: 0.25, profile: 0 };
const accepted = result => { assert.equal(result.kind, "accepted", JSON.stringify(result)); return result.data; };
const near = (a, b, tolerance = 1e-12) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const sum = values => values.reduce((a, b) => a + b, 0);
test("FTCS golden frames use old-field values and the documented no-flux operator", () => {
  const output = accepted(ftcs1d(p));
  assert.deepEqual(output.shape, [3, 5]);
  assert.deepEqual([...output.values], [0, 0, 1, 0, 0, 0, 0.25, 0.5, 0.25, 0, 0.0625, 0.25, 0.375, 0.25, 0.0625]);
  assert.equal(output.stepCount, 2); assert.equal(output.elapsedTime, 0.5);
  assert.equal(output.boundary, "zero-flux");
});
test("the exact stability boundary is admitted and any excess refused", () => {
  accepted(ftcs1d({ ...p, dt: 0.5 }));
  const result = ftcs1d({ ...p, dt: 0.5000001 });
  assert.equal(result.kind, "refused");
  const refusal = decodeRefusal(result.refusal);
  assert.equal(refusal.code, "ftcs-unstable");
  assert.deepEqual(refusal.details, { ratio: 0.5000001, limit: 0.5, dtMax: 0.5 });
  assert.deepEqual(refusal.rankedRepairs.map(r => r.action.parameterId), ["dt", "dx", "D"]);
  for (const repair of refusal.rankedRepairs) accepted(ftcs1d({ ...p, dt: 0.5000001, [repair.action.parameterId]: repair.action.value }));
});
test("all profiles preserve mass and the maximum principle", () => {
  for (const profile of [0, 1, 2]) {
    const n = 41, dx = 0.2;
    const result = accepted(ftcs1d({ n, frames: 101, stepsPerFrame: 5, D: 1, dx, dt: 0.019, profile }));
    const initial = result.values.slice(0, n);
    const mass = sum(initial) * dx, max = Math.max(...initial);
    for (let frame = 1; frame < 101; frame++) {
      const values = result.values.slice(frame * n, (frame + 1) * n);
      near(sum(values) * dx, mass);
      assert.ok(values.every(v => v >= 0 && v <= max));
    }
  }
});
test("zero diffusivity leaves every frame unchanged", () => {
  const result = accepted(ftcs1d({ ...p, D: 0, dt: 100 }));
  for (let frame = 1; frame < p.frames; frame++) assert.deepEqual(result.values.slice(frame * p.n, (frame + 1) * p.n), result.values.slice(0, p.n));
});
test("constant field is a fixed point; continuation is chunk-independent and immutable", () => {
  const constant = Float64Array.from([2, 2, 2, 2, 2]);
  assert.deepEqual(accepted(ftcsAdvance(constant, 0.5, 100)), constant);
  const initial = Float64Array.from([0, 0, 1, 0, 0]);
  const original = initial.slice();
  const direct = accepted(ftcsAdvance(initial, 0.4, 100));
  const chunked = accepted(ftcsAdvance(accepted(ftcsAdvance(initial, 0.4, 37)), 0.4, 63));
  assert.deepEqual(direct, chunked); assert.deepEqual(initial, original);
  assert.equal(ftcsAdvance(initial, 0.5000001, 100).kind, "refused");
  assert.deepEqual(initial, original);
});
test("invalid requests never allocate or return partial frames", () => {
  for (const patch of [{ n: 2 }, { n: 3.5 }, { frames: 0 }, { stepsPerFrame: 0 }, { D: -1 }, { D: NaN }, { dt: 0 }, { dx: 0 }, { profile: 3 }]) {
    const result = ftcs1d({ ...p, ...patch });
    assert.equal(result.kind, "refused"); decodeRefusal(result.refusal);
    assert.equal("data" in result, false);
  }
  const invalidField = Float64Array.from([0, NaN, 1]);
  assert.equal(ftcsAdvance(invalidField, 0.4, 1).kind, "refused");
  assert.equal(ftcsAdvance(new Float64Array(new SharedArrayBuffer(24)), 0.4, 1).kind, "refused");
});
test("work and memory limits are software outcomes, not physics refusals", () => {
  for (const budget of [{ workUnits: 0, allocationBytes: 10000 }, { workUnits: 10000, allocationBytes: 0 }]) {
    const result = ftcs1d(p, budget);
    assert.equal(result.kind, "outcome"); assert.equal(result.outcome.outcome, "budget-exhausted"); decodeOutcome(result.outcome);
  }
  const result = ftcs1d({ ...p, n: 1000, frames: 10000 }, { workUnits: 1e12, allocationBytes: 1e12 });
  assert.equal(result.kind, "outcome");
  assert.deepEqual(result.outcome.allowed, REFERENCE_FTCS_BUDGET); decodeOutcome(result.outcome);
});
test("nonrepresentable arithmetic does not turn into zero diffusion", () => {
  for (const patch of [{ D: 1e-300, dt: 1e-300 }, { D: 1e300, dt: 1e300 }, { dx: 1e-300 }]) {
    const result = ftcs1d({ ...p, ...patch });
    assert.equal(result.kind, "outcome"); decodeOutcome(result.outcome); assert.equal("data" in result, false);
  }
});
function comparison(n, dx, dt, steps) {
  const run = accepted(ftcs1d({ n, frames: 2, stepsPerFrame: steps, D: 0.5, dx, dt, profile: 0 }));
  return accepted(ftcsAnalyticComparison({ field: run.values.slice(n), dx, t: run.elapsedTime, D: 0.5, startCell: Math.floor(n / 2) }));
}
test("cell-mass error decreases under grid refinement at fixed physical time", () => {
  const coarse = comparison(101, 0.1, 0.004, 250);
  const fine = comparison(201, 0.05, 0.001, 1000);
  decodeResult(coarse.maxCellMassDifference); decodeResult(fine.maxCellMassDifference);
  assert.ok(fine.maxCellMassDifference.value < coarse.maxCellMassDifference.value / 3);
  near(sum(coarse.cellMasses), 1); near(sum(fine.cellMasses), 1);
  assert.equal(coarse.wallContact, false); assert.equal(fine.wallContact, false);
});
test("comparison identifies wall contact rather than pretending box and free space coincide", () => {
  const result = comparison(31, 0.2, 0.02, 100);
  assert.equal(result.wallContact, true);
  assert.ok(result.analyticMassInsideBox < 0.98);
  near(sum(result.cellMasses), 1);
  const initial = accepted(ftcs1d({ ...p, frames: 1 }));
  const zero = accepted(ftcsAnalyticComparison({ field: initial.values, dx: 1, t: 0, D: 1, startCell: 2 }));
  assert.equal(zero.maxCellMassDifference.value, 0);
  assert.deepEqual([...zero.cellProbabilities], [0, 0, 1, 0, 0]);
});

test("all dimensional repairs remain stable after binary64 boundary rounding", () => {
  for (const D of [4.294395645549615e-13, 1e-9, Math.PI, 1.123e-30]) for (const dx of [1e-4, Math.PI / 100, 0.1, 1e-8]) {
    const parameters = { ...p, D, dx, dt: (dx * dx) / (2 * D) * 1.1 };
    const result = ftcs1d(parameters);
    assert.equal(result.kind, "refused");
    for (const { action } of result.refusal.rankedRepairs) {
      const repaired = accepted(ftcs1d({ ...parameters, [action.parameterId]: action.value }));
      assert.ok(repaired.stabilityRatio <= 0.5);
    }
  }
});
