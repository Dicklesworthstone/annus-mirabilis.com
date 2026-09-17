import assert from "node:assert/strict";
import test from "node:test";
import {
  kolmogorovDistanceToGaussian,
  kolmogorovShapeTerm,
} from "../physics/reference/diffusion/walkLaws.ts";
import { observeWalks, recordWalks, WALK_BUDGET } from "../physics/reference/diffusion/walks.ts";
import { createPhiloxStream } from "../physics/reference/philox.ts";

const p = { walkers: 2000, runSteps: 400, stepRms: 0.5e-6, tau: 0.1, kernel: "coin", seed: "1905" };
const options = { yieldControl: async () => {} };
const accepted = (r) => {
  assert.equal(r.kind, "accepted", JSON.stringify(r));
  return r.data;
};
test("reduced recordings store all-member checkpoints and only twenty full traces", async () => {
  const r = accepted(await recordWalks(p, 4, options));
  assert.equal(r.draws, 800000);
  assert.equal(r.traceValues.length, 20 * 401);
  assert.equal(r.checkpoints.get(400).length, 2000);
  assert.ok(r.retainedBytes < 150000);
  assert.ok(r.retainedBytes < (p.walkers * (p.runSteps + 1) * 8) / 30);
});
test("chunks, prefix population, and arbitrary observation replay preserve the identical realization", async () => {
  for (const kernel of ["coin", "uniform", "gaussian"]) {
    const setup = { ...p, kernel, walkers: 23, runSteps: 80 };
    const a = accepted(await recordWalks(setup, 7, { ...options, chunkWork: 37 })),
      b = accepted(
        await recordWalks({ ...setup, walkers: 31 }, 7, { ...options, chunkWork: 1000 }),
      );
    assert.deepEqual(a.traceValues, b.traceValues);
    assert.deepEqual(a.checkpoints.get(80), b.checkpoints.get(80).slice(0, 23));
    const observed = accepted(await observeWalks(a, 43, options));
    assert.ok(observed.replayedDraws > 0);
    const cached = accepted(await observeWalks(a, 43, options));
    assert.equal(cached.replayedDraws, 0);
    assert.deepEqual(cached.positions, observed.positions);
    const fresh = accepted(await recordWalks(setup, 43, options));
    assert.deepEqual(observed.positions, fresh.checkpoints.get(43));
    assert.equal(a.draws, setup.walkers * 80 * (kernel === "gaussian" ? 2 : 1));
  }
});
test("small coin walks preserve the pinned sign mapping, not an invented stream", async () => {
  const setup = { ...p, walkers: 1, runSteps: 8, stepRms: 1 };
  const r = accepted(await recordWalks(setup, 4, options));
  const rng = createPhiloxStream({ seed: p.seed, kernel: 0x19050001, tile: 0 });
  let x = 0;
  for (let n = 1; n <= 8; n++) {
    x += rng.nextU64() >> 63n ? 1 : -1;
    assert.equal(r.traceValues[n], x);
  }
});
test("fixed-seed ensembles detect convergence AND the finite-step coin disagreement", {
  timeout: 30000,
}, async () => {
  // Four prespecified assertions. DKW alpha=2.5e-7 each, total <=1e-6; no reruns.
  const bound = Math.sqrt(Math.log(2 / 2.5e-7) / (2 * 10000));
  for (const kernel of ["coin", "uniform", "gaussian"]) {
    const r = accepted(await recordWalks({ ...p, kernel, walkers: 10000 }, 4, options));
    for (const n of kernel === "coin" ? [4, 400] : [400]) {
      const d = accepted(kolmogorovDistanceToGaussian(r.checkpoints.get(n), n * p.stepRms ** 2)),
        shape = accepted(kolmogorovShapeTerm(kernel, n)).distance;
      assert.ok(d <= shape + bound, `${kernel} n=${n}: ${d} > ${shape + bound}`);
      if (n === 4) assert.ok(d >= shape - bound);
    }
  }
});
test("budgets and cancelled generation never publish reduced or partial trials", async () => {
  const over = await recordWalks({ ...p, walkers: 10000, runSteps: 10000 }, 4, options);
  assert.equal(over.kind, "outcome");
  assert.equal(over.outcome.outcome, "budget-exhausted");
  assert.equal(over.outcome.allowed.workUnits, WALK_BUDGET.workUnits);
  let stop = false;
  const r = await recordWalks(p, 4, {
    cancelled: () => stop,
    yieldControl: async () => {
      stop = true;
    },
  });
  assert.equal(r.outcome.outcome, "cancelled");
  const recording = accepted(await recordWalks({ ...p, walkers: 20, runSteps: 80 }, 4, options));
  const count = recording.checkpoints.size;
  stop = false;
  const observation = await observeWalks(recording, 33, {
    cancelled: () => stop,
    yieldControl: async () => {
      stop = true;
    },
  });
  assert.equal(observation.outcome.outcome, "cancelled");
  assert.equal(recording.checkpoints.size, count);
});
test("observation cache remains bounded and full u64 seeds never round together", async () => {
  const setup = { ...p, walkers: 3, runSteps: 50 };
  const a = accepted(await recordWalks({ ...setup, seed: "9007199254740992" }, 4, options)),
    b = accepted(await recordWalks({ ...setup, seed: "9007199254740993" }, 4, options));
  assert.notDeepEqual(a.traceValues, b.traceValues);
  for (let n = 1; n < 50; n++) accepted(await observeWalks(a, n, options));
  assert.ok(a.checkpoints.size <= 8);
  assert.equal((await recordWalks({ ...p, seed: "01" }, 4, options)).refusal.code, "invalid-seed");
  assert.equal((await recordWalks(p, 0.5, options)).kind, "refused");
});
