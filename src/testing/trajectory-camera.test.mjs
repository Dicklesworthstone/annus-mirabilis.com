import assert from "node:assert/strict";
import { test } from "node:test";
import {
  analyzeCameraTrajectory,
  cameraTrajectoryAnalysisJson,
  isCameraTrajectoryAnalysis,
} from "../experiments/bm07/trajectoryCamera.ts";
import { selectTrajectoryFramePairs } from "../experiments/bm07/trajectoryPairs.ts";

// These are orchestration-contract tests. The numerical owner's real integration
// tests live in trajectory-camera-reference.test.mjs; a spy is intentional here.
function trajectory(tracks = { A: [[0], [2], [999]], B: [[1000], [1004], [9999]] }) {
  let row = 2;
  const entries = Object.entries(tracks);
  const points = entries.flatMap(([track, coordinates]) =>
    coordinates.map((values, time) => ({ track, time, coordinates: [...values], row: row++ })),
  );
  const dimension = points[0]?.coordinates.length ?? 1;
  const increments = entries.flatMap(([, coordinates]) =>
    coordinates.slice(1).flatMap((values, i) => values.map((v, c) => v - coordinates[i][c])),
  );
  return {
    kind: "user-supplied-trajectory",
    dimension,
    units: { time: "s", position: "m" },
    points,
    trackCount: entries.length,
    incrementCount: increments.length / dimension,
    increments,
    dt: 1,
    timingIssue: null,
  };
}
function assumptions(patch = {}) {
  return {
    estimator: "drift-centered",
    coverage: 0.95,
    independentIsotropic: false, // Observed camera increments ARE correlated.
    commonDriftAndDiffusion: true,
    localizationStd: 1,
    exposureTime: 0.3,
    censored: false,
    independentRadius: null,
    ...patch,
  };
}
function reference(resultPatch = {}) {
  const calls = [];
  const owner = {
    disjointPairsKnownNoiseInterval(request) {
      calls.push(request);
      const pairs = request.positions.length / request.d / 2;
      const q = request.d * (pairs - 1);
      return {
        kind: "accepted",
        data: {
          estimate: 1.25,
          pairs,
          q,
          lowerClipped: false,
          interval: {
            lower: 0.25,
            upper: 3.5,
            q,
            coverage: 1 - request.alpha,
            uncertaintyKind: "statistical-interval",
            coverageKind: "exact",
            estimatorId: "disjoint-pairs; exact localization variance",
          },
          empty: false,
          noiseInterval: [request.noise.sigma2, request.noise.sigma2],
          coverage: 1 - request.alpha,
          coverageKind: "exact",
          ...resultPatch,
        },
      };
    },
  };
  return { owner, calls };
}

function rejectWithoutOwner(input, changes = {}, declared = true, pattern = /./) {
  const { owner, calls } = reference();
  const result = analyzeCameraTrajectory(input, assumptions(changes), declared, owner);
  assert.equal(result.kind, "unavailable");
  assert.equal(result.camera, null);
  assert.equal(result.interval, null);
  assert.equal(calls.length, 0);
  assert.match(result.message, pattern);
  return result;
}

test("odd track tails are recorded, never paired with another particle", () => {
  const input = trajectory();
  const original = structuredClone(input);
  const result = selectTrajectoryFramePairs(input);
  assert.equal(result.kind, "selected");
  assert.deepEqual(Array.from(result.positions), [0, 2, 1000, 1004]);
  assert.deepEqual(result.report.pairs, [
    { track: "A", firstRow: 2, secondRow: 3 },
    { track: "B", firstRow: 5, secondRow: 6 },
  ]);
  assert.deepEqual(result.report.unpairedRows, [4, 7]);
  assert.equal(result.report.contributingTracks, 2);
  assert.deepEqual(input, original);
  assert.ok(Object.isFrozen(result.report));
  assert.ok(Object.isFrozen(result.report.pairs));
  assert.ok(Object.isFrozen(result.report.pairs[0]));
});

test("interleaved two-coordinate tracks preserve every within-pair coordinate", () => {
  const input = trajectory({ A: [[0, 10], [1, 11], [2, 12]], B: [[30, 40], [31, 41], [32, 42]] });
  const [a, b, c, d, e, f] = input.points;
  input.points = [a, d, b, e, c, f].map((p, i) => ({ ...p, row: i + 2 }));
  const result = selectTrajectoryFramePairs(input);
  assert.equal(result.kind, "selected");
  assert.deepEqual(Array.from(result.positions), [0, 10, 1, 11, 30, 40, 31, 41]);
  assert.deepEqual(result.report.unpairedRows, [6, 7]);
  assert.deepEqual(result.report.pairs.map((p) => [p.firstRow, p.secondRow]), [[2, 4], [3, 5]]);
});

test("the first, third and fifth frame start pairs; frames are never reused", () => {
  const result = selectTrajectoryFramePairs(trajectory({ A: [[0], [1], [2], [3], [4], [5], [6]] }));
  assert.equal(result.kind, "selected");
  assert.deepEqual(Array.from(result.positions), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(result.report.unpairedRows, [8]);
  const used = result.report.pairs.flatMap((p) => [p.firstRow, p.secondRow]);
  assert.equal(new Set(used).size, used.length);
});

test("track labels are data, including prototype-looking names", () => {
  const tracks = Object.fromEntries([["__proto__", [[0], [1]]], ["constructor", [[2], [3]]]]);
  const result = selectTrajectoryFramePairs(trajectory(tracks));
  assert.equal(result.kind, "selected");
  assert.deepEqual(result.report.pairs.map((p) => p.track), ["__proto__", "constructor"]);
});

for (const dt of [null, 0, -1, NaN, Infinity]) {
  test(`unadmitted timing ${String(dt)} never reaches the owner`, () => {
    const input = trajectory();
    input.dt = dt;
    rejectWithoutOwner(input);
  });
}
test("three-dimensional camera data are refused without dropping a coordinate", () => {
  rejectWithoutOwner(trajectory({ A: [[0, 0, 0], [1, 2, 3], [2, 3, 4], [3, 4, 5]] }), {}, true, /one or two/);
});
test("too few pairs cannot fit a drift", () => {
  rejectWithoutOwner(trajectory({ A: [[0], [1], [2]] }), {}, true, /two disjoint/);
});
test("invalid rows, coordinates and track metadata fail closed", () => {
  const changes = [
    (t) => { t.points[1].row = t.points[0].row; },
    (t) => { t.points[1].time = t.points[0].time; },
    (t) => { t.points[1].coordinates[0] = Infinity; },
    (t) => { t.points[1].coordinates = []; },
    (t) => { t.trackCount = 20; },
  ];
  for (const change of changes) {
    const input = trajectory();
    change(input);
    rejectWithoutOwner(input);
  }
});
test("pairing is bounded before coordinate packing", () => {
  const input = trajectory();
  input.points = Array(20_001).fill(input.points[0]);
  rejectWithoutOwner(input, {}, true, /20000/);
});

test("a camera declaration is separate from ideal independent-increment assumptions", () => {
  rejectWithoutOwner(trajectory(), { independentIsotropic: true }, false, /Declare isotropic Brownian/);
  const { owner, calls } = reference();
  const result = analyzeCameraTrajectory(trajectory(), assumptions(), true, owner);
  assert.equal(result.kind, "analyzed");
  assert.equal(calls.length, 1);
  assert.equal(result.assumptions.independentIsotropic, false);
  assert.equal(result.cameraModelDeclared, true);
});
test("pooling requires a common drift and diffusion declaration", () => {
  rejectWithoutOwner(trajectory(), { commonDriftAndDiffusion: false }, true, /Pooling/);
});
test("one track does not require a multi-particle pooling declaration", () => {
  const { owner } = reference();
  const result = analyzeCameraTrajectory(
    trajectory({ A: [[0], [1], [2], [3]] }),
    assumptions({ commonDriftAndDiffusion: false }), true, owner,
  );
  assert.equal(result.kind, "analyzed");
});
for (const censored of [null, true]) {
  test(`selection declaration ${String(censored)} cannot supply a camera interval`, () => {
    rejectWithoutOwner(trajectory(), { censored }, true, /Selection/);
  });
}
for (const key of ["localizationStd", "exposureTime"]) {
  test(`unknown ${key} is not silently treated as zero`, () => {
    rejectWithoutOwner(trajectory(), { [key]: null }, true, /Unknown noise/);
  });
}
for (const sigma of [-1, NaN, Infinity, 1e200, 1e-200]) {
  test(`unrepresentable noise ${String(sigma)} is not sent to the owner`, () => {
    rejectWithoutOwner(trajectory(), { localizationStd: sigma }, true, /numerical scale/);
  });
}
for (const exposure of [-1, NaN, Infinity, 1.01]) {
  test(`invalid or overlapping exposure ${String(exposure)} is refused`, () => {
    rejectWithoutOwner(trajectory(), { exposureTime: exposure });
  });
}
test("finite exposure and nonzero noise are forwarded in SI with the exact pair selection", () => {
  const { owner, calls } = reference();
  const result = analyzeCameraTrajectory(trajectory(), assumptions({ localizationStd: 2, exposureTime: 1 }), true, owner);
  assert.equal(result.kind, "analyzed");
  assert.equal(calls.length, 1);
  assert.deepEqual(Array.from(calls[0].positions), [0, 2, 1000, 1004]);
  assert.equal(calls[0].dt, 1);
  assert.equal(calls[0].d, 1);
  assert.equal(calls[0].exposure, 1);
  assert.equal(calls[0].alpha, 1 - 0.95);
  assert.deepEqual(calls[0].noise, { kind: "exact", sigma2: 4 });
  assert.equal(calls[0].equalSpacing, true);
  assert.equal(calls[0].independentNoise, true);
});
test("an explicitly ideal camera (zero noise and zero exposure) remains admissible", () => {
  const { owner } = reference();
  assert.equal(analyzeCameraTrajectory(trajectory(), assumptions({ localizationStd: 0, exposureTime: 0 }), true, owner).kind, "analyzed");
});
test("coverage boundaries are admitted; invalid coverage throws before owner evaluation", () => {
  const { owner, calls } = reference();
  for (const coverage of [0.5, 0.999])
    assert.equal(analyzeCameraTrajectory(trajectory(), assumptions({ coverage }), true, owner).kind, "analyzed");
  for (const coverage of [0, 0.499, 1, NaN, Infinity])
    assert.throws(() => analyzeCameraTrajectory(trajectory(), assumptions({ coverage }), true, owner), /coverage/);
  assert.equal(calls.length, 2);
});
test("typed refusal and no-value explanations are propagated with the pairing receipt", () => {
  for (const response of [
    { kind: "refused", refusal: { message: "Outside the supported numerical range." } },
    { kind: "no-value", reason: "No variance is resolved." },
  ]) {
    const owner = { disjointPairsKnownNoiseInterval: () => response };
    const result = analyzeCameraTrajectory(trajectory(), assumptions(), true, owner);
    assert.equal(result.kind, "unavailable");
    assert.equal(result.message, response.reason ?? response.refusal.message);
    assert.equal(result.pairing.pairs.length, 2);
    assert.equal(result.camera, null);
  }
});
test("empty physical confidence sets and negative estimates are retained, not clipped", () => {
  const { owner } = reference({ estimate: -5, empty: true, interval: null, lowerClipped: true });
  const result = analyzeCameraTrajectory(trajectory(), assumptions(), true, owner);
  assert.equal(result.kind, "analyzed");
  assert.equal(result.camera.estimate, -5);
  assert.equal(result.camera.empty, true);
  assert.equal(result.interval, null);
  assert.equal(result.molecular, null);
  assert.match(result.message, /confidence set is empty/);
});
test("a boundary-reaching set retains an unclipped negative point estimate", () => {
  const { owner } = reference({ estimate: -1, lowerClipped: true });
  const result = analyzeCameraTrajectory(trajectory(), assumptions(), true, owner);
  assert.equal(result.camera.estimate, -1);
  assert.match(result.message, /point estimate is not clipped/);
});
test("export records all observations, the applied model and the exact included/omitted rows", () => {
  const input = trajectory();
  const draft = assumptions();
  const { owner } = reference();
  const result = analyzeCameraTrajectory(input, draft, true, owner);
  const text = cameraTrajectoryAnalysisJson(result);
  draft.localizationStd = 999;
  draft.coverage = 0.5;
  assert.equal(cameraTrajectoryAnalysisJson(result), text);
  assert.ok(text.endsWith("\n"));
  const exported = JSON.parse(text);
  assert.equal(exported.version, 1);
  assert.equal(exported.model, "camera-disjoint-pairs");
  assert.equal(exported.calculation, "reference-host");
  assert.equal(exported.sourceKind, "user-supplied-not-independently-verified");
  assert.equal(exported.trajectory.points.length, 6);
  assert.deepEqual(exported.pairing.unpairedRows, [4, 7]);
  assert.equal(exported.assumptions.localizationStd, 1);
  assert.equal(exported.cameraModelDeclared, true);
  assert.equal(exported.outputUnits.diffusion, "m^2/s");
  assert.equal(exported.molecular, null);
  assert.ok(isCameraTrajectoryAnalysis(result));
  assert.equal(isCameraTrajectoryAnalysis({ kind: "analyzed" }), false);
});
test("nonfinite values cannot silently become null in an accepted export", () => {
  const { owner } = reference();
  const result = analyzeCameraTrajectory(trajectory(), assumptions(), true, owner);
  assert.throws(() => cameraTrajectoryAnalysisJson({ ...result, camera: { ...result.camera, estimate: Infinity } }), /nonfinite/);
});
test("accepted owner arrays are copied before freezing the result", () => {
  const noiseInterval = [1, 1];
  const { owner } = reference({ noiseInterval });
  const result = analyzeCameraTrajectory(trajectory(), assumptions(), true, owner);
  noiseInterval[0] = 500;
  assert.deepEqual(result.camera.noiseInterval, [1, 1]);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.camera));
  assert.ok(Object.isFrozen(result.camera.noiseInterval));
});

test("execution outcomes remain unavailable and retain the owner's structured diagnostic", () => {
  const outcome = { outcome: "invariant-violation", details: { reason: "Unrepresentable result" } };
  const owner = { disjointPairsKnownNoiseInterval: () => ({ kind: "outcome", outcome }) };
  const result = analyzeCameraTrajectory(trajectory(), assumptions(), true, owner);
  assert.equal(result.kind, "unavailable");
  assert.equal(result.camera, null);
  assert.equal(result.interval, null);
  assert.match(result.message, /execution outcome/);
  assert.deepEqual(result.ownerOutcome, outcome);
  assert.equal(result.pairing.pairs.length, 2);
  assert.deepEqual(JSON.parse(cameraTrajectoryAnalysisJson(result)).ownerOutcome, outcome);
});
