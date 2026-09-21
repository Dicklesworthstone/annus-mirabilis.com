import assert from "node:assert/strict";
import { test } from "node:test";
import { getConstantSet } from "../physics/reference/constants.ts";
import { driftDiffusionFrames1d } from "../physics/reference/diffusion/driftDiffusion.ts";

const defaults = {
  cells: 20, width: 1e-5, frames: 3, stepsPerFrame: 20, dt: 0.001,
  kickDiffusivity: 4e-13, mobility: 1e8, force: 4e-15,
  temperature: 293.15, profile: "uniform", set: getConstantSet("modern-si-2019"),
};

function accepted(overrides = {}) {
  const result = driftDiffusionFrames1d({ ...defaults, ...overrides });
  assert.equal(result.kind, "accepted", JSON.stringify(result));
  return result.data;
}

function near(actual, expected, tolerance = 1e-11) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

for (const profile of ["uniform", "step", "spike", "equilibrium", 0, 1, 2]) {
  test(`BM-04 ${profile}: every frame preserves one unit of probability`, () => {
    const data = accepted({ profile });
    for (let f = 0; f < data.shape[0]; f++) {
      const row = data.values.subarray(f * defaults.cells, (f + 1) * defaults.cells);
      assert.ok(row.every((x) => Number.isFinite(x) && x >= 0));
      near(row.reduce((sum, x) => sum + x, 0) * data.dx, 1);
    }
  });
}

test("BM-04 grid refinement does not change total particles or uniform density", () => {
  for (const cells of [3, 10, 100]) {
    const data = accepted({ cells, frames: 1 });
    for (const density of data.values) near(density * defaults.width, 1);
  }
});

for (const force of [-4e-15, 0, 4e-15]) {
  test(`BM-04 equilibrium is stationary for force ${force}`, () => {
    const data = accepted({ profile: "equilibrium", force });
    const n = data.shape[1];
    for (let i = 0; i < n; i++) near(data.values[i] * data.dx, data.values[2 * n + i] * data.dx);
    for (const face of data.faceFlux) near(face.total, 0, 1e-12);
  });
}

for (const force of [-1000, 1000]) {
  test(`BM-04 strong drift ${force}: finite equilibrium and positivity bound`, () => {
    const options = { cells: 10, width: 10, kickDiffusivity: 1, mobility: 1, force, dt: 0.0001 };
    const data = accepted({ ...options, profile: "equilibrium" });
    assert.ok(Number.isFinite(data.sigma));
    near(data.sigma, 0.1);
    assert.ok(data.values.every((x) => Number.isFinite(x) && x >= 0));
    near(data.values.subarray(0, 10).reduce((sum, x) => sum + x, 0), 1);
    const invalid = driftDiffusionFrames1d({ ...defaults, ...options, dt: 0.002 });
    assert.equal(invalid.kind, "refused");
    assert.equal(invalid.refusal.code, "drift-diffusion-unstable");
    assert.ok(Number.isFinite(invalid.refusal.details.dtMax));
  });
}

test("BM-04 zero kicks and zero force preserve the selected normalized step", () => {
  const data = accepted({ kickDiffusivity: 0, force: 0, profile: "step" });
  assert.deepEqual(data.values.subarray(0, 20), data.values.subarray(40, 60));
  near(data.values.subarray(0, 20).reduce((sum, x) => sum + x, 0) * data.dx, 1);
  assert.equal(data.sigma, 0);
  assert.ok(data.faceFlux.every((face) => face.total === 0));
});

test("BM-04 final fluxes describe the accepted density, including a zero-step frame", () => {
  for (const frames of [1, 2]) {
    const data = accepted({ frames, stepsPerFrame: 1, force: 0, profile: "step" });
    const row = data.values.subarray((frames - 1) * defaults.cells);
    for (let i = 0; i < defaults.cells - 1; i++) {
      near(data.faceFlux[i + 1].total, (defaults.kickDiffusivity / data.dx) * (row[i] - row[i + 1]));
    }
    assert.equal(data.faceFlux[0].total, 0);
    assert.equal(data.faceFlux[defaults.cells].total, 0);
  }
});

test("BM-04 refuses unrepresentable drift and cell scales before publishing a field", () => {
  for (const overrides of [{ mobility: Number.MAX_VALUE, force: 2 }, { width: Number.MIN_VALUE }]) {
    assert.equal(driftDiffusionFrames1d({ ...defaults, ...overrides }).kind, "refused");
  }
});
