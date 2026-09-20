import assert from "node:assert/strict";
import { test } from "node:test";
import {
  REFERENCE_ZERO_FLUX_BUDGET,
  zeroFluxEvolution,
} from "./diffusion/zeroFlux.ts";

function accepted(input, time, options) {
  const outcome = zeroFluxEvolution(Float64Array.from(input), time, options);
  assert.equal(outcome.kind, "accepted", JSON.stringify(outcome));
  return outcome.data;
}
function close(actual, expected, tolerance = 2e-12) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${actual} differs from ${expected} by ${Math.abs(actual - expected)}`);
}
function sameArray(actual, expected, tolerance = 2e-12) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++) close(actual[i], expected[i], tolerance);
}
function mass(values) { return values.reduce((a, b) => a + b, 0); }

for (const t of [0, 1e-8, 0.2, 1, 16, 16.00001, 100, 1e8]) {
  test(`three-cell centre impulse agrees with its closed form at tau=${t}`, () => {
    const e = Math.exp(-3 * t);
    const edge = -Math.expm1(-3 * t) / 3;
    sameArray(accepted([0, 1, 0], t).values, [edge, (1 + 2 * e) / 3, edge]);
  });
  test(`three-cell wall impulse agrees with its closed form at tau=${t}`, () => {
    const a = Math.exp(-t), b = Math.exp(-3 * t);
    sameArray(accepted([1, 0, 0], t).values,
      [1 / 3 + a / 2 + b / 6, (1 - b) / 3, 1 / 3 - a / 2 + b / 6]);
  });
}
for (const [n, k, t] of [[11, 1, 0.3], [17, 7, 5], [31, 3, 17], [128, 2, 400]]) {
  test(`cosine eigenmode has the correct finite-grid decay (${n}, ${k}, ${t})`, () => {
    const input = Array.from({ length: n }, (_, i) => 1 + 0.25 * Math.cos(Math.PI * k * (i + 0.5) / n));
    const damping = Math.exp(-4 * t * Math.sin(Math.PI * k / (2 * n)) ** 2);
    const expected = Array.from({ length: n }, (_, i) => 1 + 0.25 * damping * Math.cos(Math.PI * k * (i + 0.5) / n));
    sameArray(accepted(input, t).values, expected, 2e-11);
  });
}
for (const [a, b] of [[0.5, 1], [10, 10], [17, 40], [100, 1e5]]) {
  test(`semigroup composition crosses methods without changing the physics (${a}+${b})`, () => {
    const input = Array.from({ length: 37 }, (_, i) => (i * 17 % 31) / 7);
    const first = accepted(input, a);
    sameArray(accepted(first.values, b).values, accepted(input, a + b).values, 5e-11);
  });
}
for (const time of [0.001, 5, 16, 16 + 1e-9, 1e3, 1e12]) {
  test(`conserves mass and positivity for a non-normalized profile at tau=${time}`, () => {
    const input = Array.from({ length: 65 }, (_, i) => i < 13 ? 7 : 0);
    const result = accepted(input, time);
    close(mass(result.values), mass(input), 3e-11);
    assert.ok(result.values.every((v) => Number.isFinite(v) && v >= 0 && v <= 7));
    assert.ok(result.truncationL1Bound <= 1e-12);
    assert.ok(result.roundoffL1Correction >= 0);
    assert.equal(result.referenceModel, "continuous-time finite-volume grid");
  });
}
test("identity owns a fresh array and does not mutate the caller", () => {
  const input = new Float64Array([3, 2, 1]);
  const result = zeroFluxEvolution(input, 0);
  assert.equal(result.kind, "accepted");
  assert.notEqual(result.data.values.buffer, input.buffer);
  result.data.values[0] = 999;
  assert.deepEqual(input, new Float64Array([3, 2, 1]));
});
test("successful and budget-refused computations do not mutate input", () => {
  const input = new Float64Array([2, 4, 1, 0, 3]);
  const original = input.slice();
  for (const time of [1, 100]) {
    assert.equal(zeroFluxEvolution(input, time).kind, "accepted");
    assert.deepEqual(input, original);
  }
  assert.equal(zeroFluxEvolution(input, 1, { budget: { workUnits: 0, allocationBytes: 0 } }).kind, "outcome");
  assert.deepEqual(input, original);
});
test("zero and constant fields remain exactly stationary", () => {
  for (const value of [0, Number.MIN_VALUE, 0.75, Number.MAX_VALUE]) {
    const input = new Float64Array(7).fill(value);
    assert.deepEqual(accepted(input, 1e300).values, input);
  }
});
test("huge densities evolve without overflowing their total during normalization", () => {
  const result = accepted([Number.MAX_VALUE, Number.MAX_VALUE / 2, Number.MAX_VALUE / 4], 1);
  const scaled = accepted([1, 0.5, 0.25], 1);
  sameArray(Array.from(result.values, (x) => x / Number.MAX_VALUE), scaled.values);
});
test("subnormal rescaling is refused rather than fabricated as zero or high-precision output", () => {
  const result = zeroFluxEvolution(new Float64Array([Number.MIN_VALUE, 0, 0]), 1);
  assert.equal(result.kind, "outcome");
  assert.equal(result.outcome.outcome, "invariant-violation");
});
test("reflection of the initial field reflects the result", () => {
  const input = [0, 1, 7, 2, 3, 0, 9, 1];
  for (const t of [0.1, 30, 1e5])
    sameArray(accepted(input, t).values, accepted([...input].reverse(), t).values.reverse());
});
test("splitting a source respects linear superposition", () => {
  const a = new Float64Array(21); a[3] = 2;
  const b = new Float64Array(21); b[17] = 5;
  const combined = Float64Array.from(a, (x, i) => x + b[i]);
  for (const t of [0.5, 32]) {
    const x = accepted(a, t).values, y = accepted(b, t).values;
    sameArray(accepted(combined, t).values, Array.from(x, (v, i) => v + y[i]));
  }
});
test("tiny positive time uses a stated truncation bound rather than an unstable cosine sum", () => {
  const r = accepted([0, 1, 0], 1e-300);
  assert.equal(r.method, "poisson-uniformization");
  assert.ok(r.truncationL1Bound > 0 && r.truncationL1Bound < 1e-299);
});
test("long-time equilibrium does not require time-proportional work", () => {
  const input = new Float64Array(2048); input[0] = 1;
  const r = accepted(input, Number.MAX_VALUE);
  assert.equal(r.method, "equilibrium");
  assert.equal(r.terms, 0);
  sameArray(r.values, new Float64Array(2048).fill(1 / 2048));
  assert.ok(r.requestedBudget.workUnits < 100_000);
});
test("callers cannot raise the host work ceiling", () => {
  const field = new Float64Array(1500); field[0] = 1;
  const result = zeroFluxEvolution(field, 17, {
    budget: { workUnits: Number.MAX_SAFE_INTEGER, allocationBytes: Number.MAX_SAFE_INTEGER },
  });
  assert.equal(result.kind, "outcome");
  assert.equal(result.outcome.outcome, "budget-exhausted");
  assert.equal(result.outcome.allowed.workUnits, REFERENCE_ZERO_FLUX_BUDGET.workUnits);
});
test("callers cannot raise the host allocation ceiling", () => {
  const field = new Float64Array(260_000);
  const result = zeroFluxEvolution(field, 0, {
    budget: { workUnits: Number.MAX_SAFE_INTEGER, allocationBytes: Number.MAX_SAFE_INTEGER },
  });
  assert.equal(result.kind, "outcome");
  assert.equal(result.outcome.outcome, "budget-exhausted");
});
test("declared deterministic budget is executable at the exact boundary", () => {
  const field = new Float64Array([1, 0, 2, 0, 1]);
  const first = accepted(field, 2);
  assert.equal(zeroFluxEvolution(field, 2, { budget: first.requestedBudget }).kind, "accepted");
  const failed = zeroFluxEvolution(field, 2, {
    budget: { ...first.requestedBudget, workUnits: first.requestedBudget.workUnits - 1 },
  });
  assert.equal(failed.kind, "outcome");
  assert.equal(failed.outcome.outcome, "budget-exhausted");
});
for (const time of [-1, NaN, Infinity, -Infinity]) {
  test(`refuses invalid time ${time}`, () => {
    const r = zeroFluxEvolution(new Float64Array([0, 1, 0]), time);
    assert.equal(r.kind, "refused");
    assert.equal(r.refusal.domainKind, "input");
  });
}
for (const input of [[], [1, 2], [NaN, 1, 2], [1, -1, 2], [Infinity, 1, 0]]) {
  test(`refuses invalid field ${String(input)}`, () => {
    assert.equal(zeroFluxEvolution(Float64Array.from(input), 1).kind, "refused");
  });
}
test("refuses shared and wrong-typed memory", () => {
  assert.equal(zeroFluxEvolution([1, 2, 3], 1).kind, "refused");
  assert.equal(zeroFluxEvolution(new Float32Array([1, 2, 3]), 1).kind, "refused");
  assert.equal(zeroFluxEvolution(new Float64Array(new SharedArrayBuffer(24)), 1).kind, "refused");
});
test("refuses invalid tolerances and malformed budget counts", () => {
  for (const truncationTolerance of [-1, 0, 1e-20, 0.1, Infinity, NaN])
    assert.equal(zeroFluxEvolution(new Float64Array([0, 1, 0]), 1, { truncationTolerance }).kind, "refused");
  for (const workUnits of [-1, 0.5, Infinity, NaN])
    assert.equal(zeroFluxEvolution(new Float64Array([0, 1, 0]), 1, {
      budget: { workUnits, allocationBytes: 100_000 },
    }).kind, "refused");
});
test("repeated runs have byte-identical outputs and metadata in the same environment", () => {
  const input = [1, 8, 2, 7, 3, 6, 4, 5];
  for (const t of [0.5, 17, 1000]) assert.deepEqual(accepted(input, t), accepted(input, t));
});
