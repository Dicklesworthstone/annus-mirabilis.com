import assert from "node:assert/strict";
import { test } from "node:test";
import { projectDistributionComparison } from "./distributionComparison.mjs";

// Deliberately simple sampled shapes: these test projection, not a second Gaussian evaluator.
const narrow = Object.freeze({
  kind: "density",
  positions: Object.freeze([-2, -1, 0, 1, 2]),
  values: Object.freeze([0.1, 0.5, 1, 0.5, 0.1]),
});
const wide = Object.freeze({
  kind: "density",
  positions: Object.freeze([-4, -2, 0, 2, 4]),
  values: Object.freeze([0.05, 0.25, 0.5, 0.25, 0.05]),
});

test("a wider, lower accepted curve stays wider and lower on the shared physical axes", () => {
  const projected = projectDistributionComparison(narrow, wide);
  assert.equal(projected.kind, "comparison");
  assert.equal(projected.extent, 4);
  assert.equal(projected.peak, 1);
  assert.deepEqual(projected.held.points, [
    [98, 193],
    [128, 125],
    [158, 40],
    [188, 125],
    [218, 193],
  ]);
  assert.deepEqual(projected.current.points, [
    [38, 201.5],
    [98, 167.5],
    [158, 125],
    [218, 167.5],
    [278, 201.5],
  ]);
  // Independently normalizing each curve would put both peaks at y=40 and both widths at 240.
  assert.ok(projected.current.points[2][1] > projected.held.points[2][1]);
  assert.ok(
    projected.current.points[4][0] - projected.current.points[0][0] >
      projected.held.points[4][0] - projected.held.points[0][0],
  );
});

test("pin order changes the legend roles, not the physical projection or either input", () => {
  const before = JSON.stringify([narrow, wide]);
  const first = projectDistributionComparison(narrow, wide);
  const swapped = projectDistributionComparison(wide, narrow);
  assert.equal(first.kind, "comparison");
  assert.equal(swapped.kind, "comparison");
  assert.deepEqual(first.held, swapped.current);
  assert.deepEqual(first.current, swapped.held);
  assert.equal(JSON.stringify([narrow, wide]), before);
});

test("a point mass cannot invent a density or widen another curve", () => {
  const point = { kind: "point-mass", location: 0, extent: 4e-6 };
  const curve = { kind: "density", positions: [-4e-9, 0, 4e-9], values: [1e6, 1e8, 1e6] };
  const projected = projectDistributionComparison(point, curve);
  assert.equal(projected.kind, "comparison");
  assert.equal(projected.extent, 4e-9);
  assert.equal(projected.peak, 1e8);
  assert.deepEqual(projected.held, { kind: "point-mass", x: 158 });
  const both = projectDistributionComparison(point, point);
  assert.equal(both.kind, "comparison");
  assert.equal(both.peak, null);
  assert.equal(both.held.kind, "point-mass");
  assert.equal(both.current.kind, "point-mass");
});

test("finite extreme coordinates never overflow while mapping to pixels", () => {
  for (const extent of [1e308, Number.MIN_VALUE]) {
    const samples = { kind: "density", positions: [-extent, 0, extent], values: [0.1, 1, 0.1] };
    const projected = projectDistributionComparison(samples, samples);
    assert.equal(projected.kind, "comparison");
    assert.deepEqual(projected.current.points, [
      [38, 193],
      [158, 40],
      [278, 193],
    ]);
    assert.ok(projected.current.points.flat().every(Number.isFinite));
  }
});

test("malformed or empty samples cannot become a misleading comparison", () => {
  const invalid = [
    { kind: "density", positions: [], values: [] },
    { kind: "density", positions: [0, 1], values: [1] },
    { kind: "density", positions: [0, 0], values: [1, 1] },
    { kind: "density", positions: [1, 0], values: [1, 1] },
    { kind: "density", positions: [0, Number.NaN], values: [1, 1] },
    { kind: "density", positions: [0, 1], values: [1, Number.POSITIVE_INFINITY] },
    { kind: "density", positions: [0, 1], values: [0, 0] },
    { kind: "density", positions: [0, 1], values: [-1, 1] },
    { kind: "point-mass", location: 0, extent: 0 },
  ];
  assert.ok(invalid.length > 0);
  for (const samples of invalid) {
    assert.equal(projectDistributionComparison(samples, narrow).kind, "unavailable");
    assert.equal(projectDistributionComparison(narrow, samples).kind, "unavailable");
  }
});
