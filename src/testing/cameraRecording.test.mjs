import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMERA_KERNELS,
  observeCameraPath,
  recordCameraPath,
} from "../physics/reference/inference/camera.ts";
import {
  cameraMoments,
  covarianceEstimator,
  disjointPairsKnownNoiseInterval,
  stationaryClickNoiseEstimate,
} from "../physics/reference/inference/observation.ts";

const ok = (r) => {
  assert.equal(r.kind, "accepted", JSON.stringify(r));
  return r.data;
};
const setup = { seed: "9007199254740993", D: 0.42944e-12, flowDrift: 0 };
const p = {
  dt: 1,
  M: 50,
  d: 2,
  exposure: 0.5,
  sigma: 0.2e-6,
  stageDrift: 0,
  noiseSeed: "1905",
  clickSeed: "1926",
  clicks: 30,
};
const options = { yieldControl: async () => {} };
test("latent endpoint and bridge streams are reproducible across chunking, with exact high seeds", async () => {
  const a = ok(await recordCameraPath(setup, { ...options, chunkSteps: 7 }, 0, 240)),
    b = ok(await recordCameraPath(setup, { ...options, chunkSteps: 53 }, 0, 240));
  assert.deepEqual(a, b);
  assert.equal(a.draws, 1920);
  assert.equal(a.bytes, (241 + 240) * 16);
  assert.notDeepEqual(
    a.positions,
    ok(await recordCameraPath({ ...setup, seed: "9007199254740992" }, options, 0, 240)).positions,
  );
  assert.deepEqual(CAMERA_KERNELS, {
    latent: 0x19050001,
    localization: 0x19050002,
    stationary: 0x19050008,
  });
});
test("noise, exposure, dimension and stage changes re-observe the same path without mutation", async () => {
  const r = ok(await recordCameraPath(setup, options, 0, 240)),
    before = r.positions.slice(),
    bridge = r.averages.slice();
  const a = ok(observeCameraPath(r, p)),
    b = ok(observeCameraPath(r, { ...p, sigma: 0 }));
  assert.deepEqual(a.ideal, b.ideal);
  assert.deepEqual(a.blurred, b.blurred);
  assert.notDeepEqual(a.observed, b.observed);
  const c = ok(observeCameraPath(r, { ...p, exposure: 0 }));
  assert.deepEqual(c.ideal, c.blurred);
  assert.deepEqual(c.ideal, a.ideal);
  const d = ok(observeCameraPath(r, { ...p, d: 1 }));
  for (let i = 0; i <= p.M; i++) assert.equal(a.observed[i * 2], d.observed[i]);
  const e = ok(observeCameraPath(r, { ...p, stageDrift: 1e-6 }));
  for (let i = 0; i <= p.M; i++)
    assert.ok(Math.abs(e.observed[2 * i] - a.observed[2 * i] - 1e-6 * (i + 0.25)) < 1e-19);
  assert.deepEqual(r.positions, before);
  assert.deepEqual(r.averages, bridge);
  assert.deepEqual(a, ok(observeCameraPath(r, p)));
});
test("frame timestamp noise and stationary clicks have stable prefixes and independent seeds", async () => {
  const r = ok(await recordCameraPath(setup, options, 0, 240)),
    a = ok(observeCameraPath(r, p)),
    b = ok(observeCameraPath(r, { ...p, dt: 2, M: 25 }));
  for (let i = 0; i <= 25; i++)
    for (let c = 0; c < 2; c++) assert.equal(a.observed[4 * i + c], b.observed[2 * i + c]);
  const changed = ok(observeCameraPath(r, { ...p, clickSeed: "1927" }));
  assert.deepEqual(a.observed, changed.observed);
  assert.notDeepEqual(a.stationary, changed.stationary);
  assert.deepEqual(
    a.stationary.slice(0, 10),
    ok(observeCameraPath(r, { ...p, clicks: 5 })).stationary,
  );
});
test("exposure off-grid repairs are executable and overlong exposures never shorten observations", async () => {
  const r = ok(await recordCameraPath(setup, options, 0, 240));
  const bad = observeCameraPath(r, { ...p, exposure: 0.3 });
  assert.equal(bad.kind, "refused");
  assert.equal(bad.refusal.code, "off-replay-grid");
  const repair = bad.refusal.rankedRepairs[0].action;
  assert.equal(observeCameraPath(r, { ...p, [repair.parameterId]: repair.value }).kind, "accepted");
  assert.equal(observeCameraPath(r, { ...p, dt: 2 }).kind, "refused");
  assert.equal(observeCameraPath(r, { ...p, exposure: 2 }).kind, "refused");
});
test("cancelled generation never exposes a partial latent or bridge recording", async () => {
  let stop = false;
  const r = await recordCameraPath(setup, {
    chunkSteps: 5,
    yieldControl: async () => {
      stop = true;
    },
    cancelled: () => stop,
  });
  assert.equal(r.kind, "outcome");
  assert.equal(r.outcome.outcome, "cancelled");
});
test("Brownian bridge exposure produces the predicted variance AND signed adjacent covariance", async () => {
  for (const patch of [
    { sigma: 0, exposure: 1 },
    { sigma: 0.4e-6, exposure: 0 },
    { sigma: 0.2e-6, exposure: 0.5 },
  ]) {
    const params = { ...p, ...patch, M: 1000 };
    let variance = 0,
      covariance = 0;
    for (let i = 0; i < 12; i++) {
      const r = ok(await recordCameraPath(setup, options, i)),
        f = ok(observeCameraPath(r, params)),
        m = ok(covarianceEstimator(f.increments, 1, { d: 2, exposure: params.exposure }));
      variance += m.variance / 12;
      covariance += m.covariance / 12;
    }
    const theory = ok(
      cameraMoments({
        D: setup.D,
        dt: 1,
        exposure: params.exposure,
        sigma: params.sigma,
        drift: 0,
        d: 2,
      }),
    );
    assert.ok(Math.abs(variance / theory.variance - 1) < 0.05, `${variance}/${theory.variance}`);
    assert.ok(
      Math.abs(covariance - theory.covariance) < 0.04 * theory.variance,
      `${covariance}/${theory.covariance}`,
    );
  }
});
test("prespecified repeated experiments retain pair-interval misses and cover with exact or estimated noise", async () => {
  let exact = 0,
    estimated = 0;
  const N = 160;
  // 80 independent stream tiles, two independently seeded populations. No retrying misses.
  for (let i = 0; i < N; i++) {
    const r = ok(
        await recordCameraPath({ ...setup, seed: i < 80 ? "1905" : "1906" }, options, i % 80, 202),
      ),
      f = ok(observeCameraPath(r, p));
    for (const kind of ["exact", "stationary-clicks"]) {
      const noise =
        kind === "exact"
          ? { kind, sigma2: p.sigma ** 2 }
          : { kind, estimate: ok(stationaryClickNoiseEstimate(f.stationary, { d: 2 })) };
      const result = ok(
        disjointPairsKnownNoiseInterval({
          positions: f.observed,
          dt: 1,
          exposure: p.exposure,
          d: 2,
          alpha: 0.05,
          noise,
        }),
      );
      if (result.interval && result.interval.lower <= setup.D && result.interval.upper >= setup.D) {
        if (kind === "exact") exact++;
        else estimated++;
      }
    }
  }
  assert.ok(exact >= 140 && exact <= 160, `exact coverage ${exact}/${N}`);
  assert.ok(estimated >= 140 && estimated <= 160, `conservative coverage ${estimated}/${N}`);
});
