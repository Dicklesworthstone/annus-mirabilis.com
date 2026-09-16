import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  chiSquareQuantile,
  ensembleMomentBands,
  normalQuantile,
} from "../physics/reference/diffusion/statistics.ts";
import {
  displacementHistogram,
  ensembleMoments,
  observationGridCheck,
  recordTracers,
  tracerDisplacements,
} from "../physics/reference/diffusion/tracers.ts";

const take = (r) => {
  assert.equal(r.kind, "accepted", JSON.stringify(r));
  return r.data;
};
const close = (a, b, tol = 1e-9) =>
  assert.ok(Math.abs(a - b) <= tol * Math.max(Math.abs(b), 1e-100), `${a} != ${b}`);
const setup = { M: 20, steps: 100, h: 0.02, D: 4.29439564555e-13, seed: "9007199254740993" };
const fast = { yieldControl: async () => {} };
test("three-dimensional recordings reproduce by seed, chunk size, and tracer prefix", async () => {
  const a = take(await recordTracers(setup, { ...fast, chunkSeries: 1 })),
    b = take(await recordTracers({ ...setup, M: 40 }, { ...fast, chunkSeries: 9 }));
  assert.deepEqual(a.values, b.values.slice(0, a.values.length));
  assert.equal(a.draws, 12000);
  const c = take(await recordTracers({ ...setup, seed: "9007199254740992" }, fast));
  assert.notDeepEqual(a.values, c.values);
  const scaled = take(await recordTracers({ ...setup, D: setup.D / 2 }, fast));
  for (let i = 0; i < a.values.length; i++)
    close(scaled.values[i], a.values[i] / Math.SQRT2, 1e-11);
});
test("remeasurement and dimension changes reuse the recording without mutation", async () => {
  const a = take(await recordTracers(setup, fast)),
    before = a.values.slice();
  const one = tracerDisplacements(a, 20, 1),
    three = tracerDisplacements(a, 20, 3);
  for (let i = 0; i < setup.M; i++) assert.equal(one[i], three[i * 3]);
  tracerDisplacements(a, 99, 2);
  assert.deepEqual(a.values, before);
  assert.equal(a.draws, 12000);
});
test("ensemble hand fixture distinguishes mean square from square of the mean", () => {
  const r = take(ensembleMoments({ displacements: Float64Array.from([1, -1, -2, 0, 1, 3]), d: 2 }));
  assert.equal(r.axes[0].mean, 0);
  close(r.axes[0].meanAbsolute, 4 / 3);
  assert.equal(r.axes[0].meanSquare, 2);
  close(r.axes[1].mean, 2 / 3);
  close(r.meanSquareNorm, 16 / 3);
  close(r.meanNorm, (Math.sqrt(2) + 2 + Math.sqrt(10)) / 3);
});
test("histogram accounts for every tracer including edges and off-screen tails", () => {
  const r = take(
    displacementHistogram(
      Float64Array.from([-1.5, -0.5, 0.2, 0.7, 2.5]),
      Float64Array.from([-1, 0, 1, 2]),
    ),
  );
  assert.deepEqual([...r.counts], [1, 2, 0]);
  assert.equal(r.underflow, 1);
  assert.equal(r.overflow, 1);
  assert.equal(r.total, 5);
  assert.deepEqual(
    [
      ...take(
        displacementHistogram(Float64Array.from([-1, 0, 1, 2]), Float64Array.from([-1, 0, 1, 2])),
      ).counts,
    ],
    [1, 1, 2],
  );
});
test("off-grid intervals are refused with usable repairs and zero is explicit", () => {
  const r = observationGridCheck(0.015, 0.02, 500);
  assert.equal(r.kind, "refused");
  assert.equal(r.refusal.code, "off-replay-grid");
  for (const a of r.refusal.rankedRepairs)
    if (a.action) assert.equal(observationGridCheck(a.action.value, 0.02, 500).kind, "accepted");
  assert.equal(take(observationGridCheck(0.04, 0.02, 500)), 2);
  assert.equal(take(observationGridCheck(0, 0.02, 500)), 0);
});
test("recording budget and cancellation never produce a partial accepted experiment", async () => {
  const r = await recordTracers({ ...setup, M: 10000, steps: 30000 }, fast);
  assert.equal(r.kind, "outcome");
  assert.equal(r.outcome.outcome, "budget-exhausted");
  let cancelled = false;
  const c = await recordTracers(setup, {
    chunkSeries: 1,
    cancelled: () => cancelled,
    yieldControl: async () => {
      cancelled = true;
    },
  });
  assert.equal(c.kind, "outcome");
  assert.equal(c.outcome.outcome, "cancelled");
  assert.equal((await recordTracers({ ...setup, seed: 42 }, fast)).kind, "refused");
});
test("normal quantiles reproduce independent tabulated values", () => {
  for (const [p, q] of [
    [0.975, 1.959963984540054],
    [0.9995, 3.2905267314919255],
    [0.99995, 3.8905918864131204],
  ])
    close(take(normalQuantile(p)), q, 1e-12);
  assert.equal(normalQuantile(1).kind, "refused");
  assert.equal(normalQuantile(0).kind, "refused");
});
test("chi-square inversion matches independent SciPy fixtures and refuses nonconvergence", () => {
  const fixtures = JSON.parse(
    readFileSync(new URL("./statistics-fixtures.json", import.meta.url), "utf8"),
  );
  for (const r of fixtures.rows) close(take(chiSquareQuantile(r.q, r.p)), r.value, 1e-9);
  const failed = chiSquareQuantile(400, 0.975, 0);
  assert.equal(failed.kind, "refused");
  assert.equal(failed.refusal.code, "quantile-not-converged");
});
test("sampling bands use model variance and vector degrees of freedom, not observations", () => {
  const b = take(
    ensembleMomentBands({ M: 400, d: 3, modelVariance: 0.6316805, alphas: [0.001] }),
  )[0];
  close(b.meanHalfWidth, 0.130763, 5e-6);
  close(b.meanSquare[0], 0.494964, 5e-6);
  close(b.meanSquare[1], 0.789074, 5e-6);
  assert.ok(b.totalMeanSquare[0] > b.meanSquare[0] * 2);
  assert.ok(b.totalMeanSquare[1] < b.meanSquare[1] * 3);
});
