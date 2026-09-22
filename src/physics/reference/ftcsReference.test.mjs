import assert from "node:assert/strict";
import { test } from "node:test";
import { ftcsTimeDiscretizationComparison } from "./diffusion/ftcsReference.ts";

function accepted(parameters, options) {
  const r = ftcsTimeDiscretizationComparison(parameters, options);
  assert.equal(r.kind, "accepted", JSON.stringify(r));
  return r.data;
}
function close(actual, expected, tolerance = 2e-12) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}
// Independent implementation of the documented endpoint/interior FTCS operator.
function euler(input, r, steps) {
  let current = Float64Array.from(input);
  for (let k = 0; k < steps; k++) {
    const next = new Float64Array(input.length);
    for (let i = 0; i < next.length; i++) {
      const left = current[Math.max(0, i - 1)],
        right = current[Math.min(next.length - 1, i + 1)];
      next[i] = current[i] + r * (left - 2 * current[i] + right);
    }
    current = next;
  }
  return current;
}
function request(initialField, ratio = 0.1, steps = 20, dx = 0.2) {
  const initial = Float64Array.from(initialField);
  return {
    initialField: initial,
    field: euler(initial, ratio, steps),
    dx,
    stabilityRatio: ratio,
    steps,
  };
}

test("zero-step comparison exactly matches the initial condition", () => {
  const r = accepted(request([1, 3, 2, 0, 4], 0.25, 0));
  assert.equal(r.maxCellMassTimeError.value, 0);
  assert.equal(r.l1CellMassTimeError.value, 0);
  assert.equal(r.signedMassDrift.value, 0);
});
test("zero diffusivity remains an exact identity at any accepted step count", () => {
  const r = accepted(request([1, 2, 0, 4], 0, 10_000));
  assert.equal(r.reference.method, "identity");
  assert.equal(r.l1CellMassTimeError.value, 0);
});
test("one-step three-cell fixture measures Euler error against a closed form", () => {
  const r = accepted(request([0, 1, 0], 0.5, 1, 1));
  const centre = (1 + 2 * Math.exp(-1.5)) / 3;
  close(r.maxCellMassTimeError.value, centre);
  close(r.l1CellMassTimeError.value, 2 * centre);
  close(r.initialMass.value, 1);
  close(r.referenceMass.value, 1);
  assert.equal(r.errorScope, "time-discretization-only");
  assert.equal(r.spatialError, "not-assessed");
});
test("step halving exhibits first-order temporal convergence at fixed elapsed model time", () => {
  const input = new Float64Array(31);
  input[15] = 1;
  const errors = [20, 40, 80, 160].map(
    (steps) => accepted(request(input, 2 / steps, steps, 1)).l1CellMassTimeError.value,
  );
  for (let i = 1; i < errors.length; i++) {
    assert.ok(errors[i] < 0.6 * errors[i - 1], String(errors));
    assert.ok(errors[i] > 0.4 * errors[i - 1], String(errors));
  }
});
test("comparison remains mass-conserving and applicable after repeated wall reflection", () => {
  const r = accepted(request([1, 0, 0, 0, 0], 0.25, 800, 1));
  assert.equal(r.boundary, "zero-flux");
  close(r.referenceMass.value, 1);
  for (const cell of r.referenceCellMasses) close(cell, 0.2);
  assert.ok(r.maxCellMassTimeError.value < 1e-12);
});
test("arbitrary non-unit-mass profiles retain their actual mass and semantics", () => {
  const r = accepted(request([4, 4, 4, 0, 0, 0, 0], 0.1, 50, 2));
  close(r.initialMass.value, 24);
  close(r.observedMass.value, 24);
  close(r.referenceMass.value, 24);
  assert.equal(r.maxCellMassTimeError.semanticKind, "cell-mass-difference");
  assert.equal(r.initialMass.semanticKind, "cell-mass");
});
test("lost observed mass is reported, not silently renormalized away", () => {
  const p = request([1, 0, 0, 0, 0], 0.1, 100, 1);
  p.field = Float64Array.from(p.field, (v) => v * 0.7);
  const r = accepted(p);
  close(r.initialMass.value, 1);
  close(r.observedMass.value, 0.7);
  close(r.signedMassDrift.value, -0.3);
  assert.ok(r.l1CellMassTimeError.value >= 0.3 - 1e-12);
});
test("extra observed mass on a zero source is visible", () => {
  const p = request([0, 0, 0], 0, 0, 2);
  p.field[1] = 1;
  const r = accepted(p);
  assert.equal(r.initialMass.value, 0);
  assert.equal(r.signedMassDrift.value, 2);
  assert.equal(r.l1CellMassTimeError.value, 2);
});
test("dx changes masses, not the reference evolution at fixed dimensionless time", () => {
  const a = accepted(request([0, 1, 0, 0], 0.1, 20, 0.5));
  const b = accepted(request([0, 1, 0, 0], 0.1, 20, 2));
  assert.deepEqual(a.reference.values, b.reference.values);
  close(b.initialMass.value, 4 * a.initialMass.value);
  close(b.l1CellMassTimeError.value, 4 * a.l1CellMassTimeError.value);
});
test("uncertainty is numerical and estimated, not a statistical interval or certified bound", () => {
  const r = accepted(request([0, 1, 0, 0]));
  for (const metric of [r.maxCellMassTimeError, r.l1CellMassTimeError]) {
    assert.equal(metric.status, "value");
    assert.equal(metric.uncertainty.kind, "numerical-error-estimate");
    assert.equal(metric.uncertainty.guarantee, "estimate");
    assert.ok(metric.uncertainty.magnitude >= 0);
    assert.match(metric.uncertainty.method, /excludes spatial\/model error/);
  }
});
test("the full wrapper budget includes reference work and additional mass storage", () => {
  const p = request([1, 2, 3, 0, 0]);
  const r = accepted(p);
  assert.ok(r.requestedBudget.workUnits > r.reference.requestedBudget.workUnits);
  assert.ok(r.requestedBudget.allocationBytes > r.reference.requestedBudget.allocationBytes);
  assert.equal(ftcsTimeDiscretizationComparison(p, { budget: r.requestedBudget }).kind, "accepted");
  for (const key of ["workUnits", "allocationBytes"]) {
    const budget = { ...r.requestedBudget, [key]: r.requestedBudget[key] - 1 };
    const failed = ftcsTimeDiscretizationComparison(p, { budget });
    assert.equal(failed.kind, "outcome");
    assert.equal(failed.outcome.outcome, "budget-exhausted");
    assert.equal(failed.outcome.allowed[key], budget[key]);
    assert.equal(failed.outcome.requested[key], r.requestedBudget[key]);
  }
});
test("source and observed arrays are not mutated or aliased by outputs", () => {
  const p = request([1, 0, 2, 0, 1]);
  const beforeInitial = p.initialField.slice(),
    beforeField = p.field.slice();
  const r = accepted(p);
  r.reference.values.fill(99);
  r.referenceCellMasses.fill(11);
  assert.deepEqual(p.initialField, beforeInitial);
  assert.deepEqual(p.field, beforeField);
});
for (const [key, value] of [
  ["dx", 0],
  ["dx", Infinity],
  ["dx", NaN],
  ["dx", -1],
  ["steps", -1],
  ["steps", 0.5],
  ["steps", Infinity],
  ["steps", Number.MAX_SAFE_INTEGER + 1],
  ["stabilityRatio", -1],
  ["stabilityRatio", 0.500001],
  ["stabilityRatio", NaN],
]) {
  test(`refuses invalid comparison parameter ${key}=${value}`, () => {
    const p = request([0, 1, 0]);
    p[key] = value;
    assert.equal(ftcsTimeDiscretizationComparison(p).kind, "refused");
  });
}
test("refuses mismatched, shared, negative and nonfinite observed fields", () => {
  for (const field of [
    new Float64Array(2),
    new Float64Array([-1, 1, 0]),
    new Float64Array([NaN, 1, 0]),
    new Float64Array(new SharedArrayBuffer(24)),
    [0, 1, 0],
  ]) {
    const p = request([0, 1, 0]);
    p.field = field;
    assert.equal(ftcsTimeDiscretizationComparison(p).kind, "refused");
  }
});
test("refuses an invalid initial field through the shared reference contract", () => {
  const p = request([0, 1, 0]);
  p.initialField[0] = -1;
  assert.equal(ftcsTimeDiscretizationComparison(p).kind, "refused");
});
test("underflowed or overflowing cell masses return no partial comparison", () => {
  for (const [input, dx] of [
    [Number.MIN_VALUE, Number.MIN_VALUE],
    [Number.MAX_VALUE, 2],
  ]) {
    const field = new Float64Array([input, input, input]);
    const r = ftcsTimeDiscretizationComparison({
      initialField: field,
      field,
      dx,
      stabilityRatio: 0,
      steps: 0,
    });
    assert.equal(r.kind, "outcome");
    assert.equal(r.outcome.outcome, "invariant-violation");
    assert.equal("data" in r, false);
  }
});
test("overflowing total mass is not mislabeled as a finite scientific result", () => {
  const field = new Float64Array([Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE]);
  const r = ftcsTimeDiscretizationComparison({
    initialField: field,
    field,
    dx: 1,
    stabilityRatio: 0,
    steps: 0,
  });
  assert.equal(r.kind, "outcome");
  assert.equal(r.outcome.outcome, "invariant-violation");
});
