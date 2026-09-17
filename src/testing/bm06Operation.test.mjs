import assert from "node:assert/strict";
import test from "node:test";
import {
  BM06_OUTPUTS,
  BM06_PARAMETER_CLASSES,
  BM06_DEFAULTS as defaults,
} from "../experiments/bm06/definition.ts";
import { decodeOutcome, decodeRefusal, decodeResultBatch } from "../experiments/results/codec.ts";
import { createInstanceStore } from "../experiments/store/instanceStore.ts";
import { evaluateBm06, validateBm06Parameters } from "../workers/operations/bm06.ts";

const noWait = async () => {};
const run = (patch = {}, extra = {}) =>
  evaluateBm06({ ...defaults, ...patch }, { yieldControl: noWait, ...extra });
const get = (r, id) => {
  assert.equal(r.kind, "accepted");
  return r.data.outputs.find((o) => o.quantityId === id);
};
const numeric = (r, id) => {
  const o = get(r, id);
  assert.equal(o.status, "value");
  return o.value;
};
const close = (a, b, tolerance = 1e-12) =>
  assert.ok(Math.abs(a - b) <= tolerance * Math.max(Math.abs(b), 1e-300), `${a} != ${b}`);

test("BM-06 publishes one complete, typed batch from the real reference owners", async () => {
  const result = await run();
  close(numeric(result, "diffusionCoefficient"), Number("4.29439564554961453e-13"));
  close(numeric(result, "rmsDisplacement1d"), Number("9.26757319426139146e-7"));
  const revisions = { input: 1, observer: 0, measurement: 0, estimator: 0 };
  decodeResultBatch(
    { revisions, outputs: result.data.outputs },
    {
      expectedRevisions: revisions,
      allowPartial: true,
      statuses: Object.fromEntries(Object.entries(BM06_OUTPUTS).map(([k, v]) => [k, v.statuses])),
    },
  );
  assert.equal(get(result, "gridDensity").status, "not-applicable");
  assert.equal(
    numeric(result, "positionCoordinate1d").length,
    numeric(result, "probabilityDensity").length,
  );
});
test("the probability within one RMS is 68.268949%, without conflating it with density", async () => {
  const r = await run();
  const rms = numeric(r, "rmsDisplacement1d");
  const inside = await run({ lower: -rms, upper: rms });
  close(numeric(inside, "intervalProbability"), 0.6826894921370859);
});
test("zero-time curve is a point mass and closed endpoints include the atom", async () => {
  for (const [lower, upper, expected] of [
    [0, 0, 1],
    [0, 1e-6, 1],
    [1e-9, 1e-6, 0],
  ]) {
    const r = await run({ t: 0, lower, upper });
    assert.equal(get(r, "probabilityDensity").status, "analytic-limit");
    assert.equal(numeric(r, "intervalProbability"), expected);
  }
  const grid = await run({ t: 0, gridEnabled: true });
  assert.equal(
    numeric(grid, "cellMasses").reduce((a, b) => a + b),
    1,
  );
  assert.equal(grid.data.stepIndex, 0);
});
test("temperature and viscosity comparisons are recomputed by the owners", async () => {
  const base = await run();
  const viscous = await run({ eta: defaults.eta * 2 });
  close(numeric(viscous, "rmsDisplacement1d") / numeric(base, "rmsDisplacement1d"), 1 / Math.SQRT2);
  const minute = await run({ t: 60 });
  close(numeric(minute, "rmsDisplacement1d") / numeric(base, "rmsDisplacement1d"), Math.sqrt(60));
});
test("strict parameters reject unknown keys, missing values, strings, NaN and reversed intervals", async () => {
  for (const p of [
    { ...defaults, rogue: 1 },
    { ...defaults, T: undefined },
    { ...defaults, T: "293" },
    { ...defaults, t: NaN },
    { ...defaults, t: -1 },
    { ...defaults, lower: 2, upper: 1 },
    { ...defaults, n: 4.5 },
  ]) {
    const r = validateBm06Parameters(p);
    assert.equal(r.kind, "refused");
    decodeRefusal(r.refusal);
  }
  let accessed = false;
  const p = { ...defaults };
  Object.defineProperty(p, "T", {
    get() {
      accessed = true;
      return 293;
    },
    enumerable: true,
  });
  assert.equal(validateBm06Parameters(p).kind, "refused");
  assert.equal(accessed, false);
});
test("a stability refusal offers a steps repair that really succeeds", async () => {
  const refused = await run({ gridEnabled: true, steps: 1 });
  assert.equal(refused.kind, "refused");
  decodeRefusal(refused.refusal);
  assert.equal(refused.refusal.code, "ftcs-unstable");
  const repair = refused.refusal.rankedRepairs[0].action;
  assert.equal(repair.parameterId, "steps");
  const fixed = await run({ gridEnabled: true, steps: repair.value });
  assert.equal(fixed.kind, "accepted");
  assert.ok(numeric(fixed, "stabilityRatio") <= 0.5);
});
test("FTCS is chunk-size invariant and conserves mass", async () => {
  const a = await run({ gridEnabled: true }, { chunkSteps: 1 });
  const b = await run({ gridEnabled: true }, { chunkSteps: 128 });
  assert.deepEqual(numeric(a, "gridDensity"), numeric(b, "gridDensity"));
  close(
    numeric(a, "cellMasses").reduce((a, b) => a + b),
    1,
  );
  assert.equal(a.data.stepIndex, defaults.steps);
});
test("cancellation is observed at a chunk boundary; budgets never become physics refusals", async () => {
  let chunks = 0;
  const stopped = await run(
    { gridEnabled: true },
    {
      chunkSteps: 10,
      cancelled: () => chunks === 2,
      yieldControl: async () => {
        chunks++;
      },
    },
  );
  assert.equal(stopped.kind, "outcome");
  assert.equal(stopped.outcome.outcome, "cancelled");
  assert.equal(chunks, 2);
  const huge = await run({ gridEnabled: true, n: 4097, steps: 4000000 });
  assert.equal(huge.kind, "outcome");
  assert.equal(huge.outcome.outcome, "budget-exhausted");
  decodeOutcome(huge.outcome);
});
test("2D and 3D radial moments and the 2D most-likely radius match independently computed closed forms", async () => {
  const r = await run();
  const D = numeric(r, "diffusionCoefficient");
  const t = defaults.t;
  // Independent of moments()/mostLikelyRadius2d: typed out from the bead's own closed forms,
  // not calling the owner under test. s is the 1D RMS displacement, sqrt(2 D t).
  const s = Math.sqrt(2 * D * t);
  const expected = {
    meanRadius2d: s * Math.sqrt(Math.PI / 2), // = sqrt(pi D t)
    rmsRadius2d: s * Math.SQRT2, // = sqrt(4 D t)
    mostLikelyRadius2d: s, // = sqrt(2 D t)
    meanRadius3d: s * 2 * Math.sqrt(2 / Math.PI), // = 4 sqrt(D t / pi)
    rmsRadius3d: s * Math.sqrt(3), // = sqrt(6 D t)
  };
  for (const [id, value] of Object.entries(expected)) close(numeric(r, id), value, 1e-9);
  // The 2D most-likely radius is the 1D RMS displacement (bead's own stated identity); the two
  // owner functions compute sqrt(2*D*t) in a different operation order, so this is a numeric
  // closeness check, not bitwise equality.
  close(numeric(r, "mostLikelyRadius2d"), numeric(r, "rmsDisplacement1d"), 1e-12);
  // A wiring bug that swapped the 2D and 3D slots, or reused one dimension for both, would be
  // caught here: the two dimensions' moments are genuinely different numbers.
  assert.notEqual(numeric(r, "meanRadius2d"), numeric(r, "meanRadius3d"));
  assert.notEqual(numeric(r, "rmsRadius2d"), numeric(r, "rmsRadius3d"));
});
test("activeDiffusionCoefficient equals the model D with no copy, and the copied value once one is recorded", async () => {
  const plain = await run();
  assert.equal(
    numeric(plain, "activeDiffusionCoefficient"),
    numeric(plain, "diffusionCoefficient"),
  );
  const copied = await run({
    copiedDiffusivityInstanceId: "bm01-tracer-a",
    copiedDiffusivityRunId: "run-1",
    copiedDiffusivitySnapshotVersion: 1,
    copiedDiffusivityValue: 7e-13,
  });
  assert.equal(numeric(copied, "activeDiffusionCoefficient"), 7e-13);
  // diffusionCoefficient keeps reporting what T/eta/a alone give -- the copy never
  // misattributes its number to stokesEinsteinD.
  assert.equal(numeric(copied, "diffusionCoefficient"), numeric(plain, "diffusionCoefficient"));
  // Every downstream quantity uses the active (copied) D, not the model's own D.
  close(numeric(copied, "rmsDisplacement1d"), Math.sqrt(2 * 7e-13 * defaults.t), 1e-9);
  close(numeric(copied, "mostLikelyRadius2d"), Math.sqrt(2 * 7e-13 * defaults.t), 1e-9);
});
test("a copy with only some of the four fields set is refused, never partially applied", () => {
  for (const partial of [
    { copiedDiffusivityInstanceId: "bm01-a" },
    { copiedDiffusivityRunId: "run-1" },
    { copiedDiffusivitySnapshotVersion: 2 },
    { copiedDiffusivityValue: 1e-12 },
    { copiedDiffusivityInstanceId: "bm01-a", copiedDiffusivityValue: 0 },
  ]) {
    const r = validateBm06Parameters({ ...defaults, ...partial });
    assert.equal(r.kind, "refused");
    decodeRefusal(r.refusal);
  }
});
test("a real lab result and refusal obey the existing accepted-state store", async () => {
  const store = createInstanceStore({
    experimentId: "bm-06",
    instanceId: "test",
    initialParameters: defaults,
    parameterClasses: BM06_PARAMETER_CLASSES,
    outputs: BM06_OUTPUTS,
    allowPartial: true,
  });
  let token = store.issue("setup-change");
  const r = await run();
  assert.equal(store.publish({ ...token, ...r.data, final: true }).accepted, true);
  const snapshot = store.getSnapshot().accepted;
  token = store.issue("setup-change", { gridEnabled: true, steps: 1 });
  const bad = await run({ gridEnabled: true, steps: 1 });
  assert.equal(store.refuse(token, bad.refusal).accepted, true);
  assert.equal(store.getSnapshot().accepted, snapshot);
  assert.equal(store.getSnapshot().requested.parameters.steps, 1);
});
