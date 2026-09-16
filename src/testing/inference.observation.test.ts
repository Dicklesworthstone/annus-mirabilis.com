import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { cameraGrid } from "../physics/reference/inference/camera.ts";
import {
  bartlettBandsMA1,
  cameraMoments,
  covarianceEstimator,
  disjointPairsKnownNoiseInterval,
  stationaryClickNoiseEstimate,
} from "../physics/reference/inference/observation.ts";
import { independentModelAdmission } from "../physics/reference/inference.ts";

function withinTolerance(actual: number, expected: number, tol = 1e-9): boolean {
  return Math.abs(actual - expected) <= tol * Math.max(Math.abs(expected), 1e-30);
}

describe("inference.observation: Camera observation models, exposure blur, and covariance estimation (am-bm-08-measurement-bias-h1ye)", () => {
  const D = 0.42944e-12; // m^2/s

  test("exposure fixture moments and CVE expectations match to 10^-12 relative", () => {
    const dt = 1.0;
    const Te = 0.5;
    const sigma = 0.05e-6; // 0.05 um -> sigma^2 = 0.0025 um^2
    const d = 1;

    const res = cameraMoments({ D, dt, exposure: Te, sigma, drift: 0, d });
    assert.equal(res.kind, "accepted");
    if (res.kind !== "accepted") return;

    const expectedVar = 2 * D * (dt - Te / 3) + 2 * sigma ** 2; // 0.7207333333333333e-12
    const expectedCov = (D * Te) / 3 - sigma ** 2; // 0.06907333333333333e-12
    const expectedNaiveD = expectedVar / (2 * dt); // 0.3603666666666667e-12

    assert.ok(withinTolerance(res.data.variance, expectedVar, 1e-12));
    assert.ok(withinTolerance(res.data.variance, 0.7207333333333333e-12, 1e-9));
    assert.ok(withinTolerance(res.data.covariance, expectedCov, 1e-12));
    assert.ok(withinTolerance(res.data.covariance, 0.06907333333333333e-12, 1e-9));
    assert.ok(withinTolerance(res.data.naiveExpectation, expectedNaiveD, 1e-12));
    assert.ok(withinTolerance(res.data.naiveExpectation, 0.3603666666666667e-12, 1e-9));

    // Fundamental identity Var + 2*Cov = 2*D*dt holds for all Te and sigma:
    const identitySum = res.data.variance + 2 * res.data.covariance;
    const expectedIdentity = 2 * D * dt; // 0.85888e-12
    assert.ok(
      withinTolerance(identitySum, expectedIdentity, 1e-12),
      `Var + 2*Cov must equal 2*D*dt: ${identitySum} vs ${expectedIdentity}`,
    );

    // CVE expectations:
    const R = Te / (6 * dt); // 1/12
    const expectedCveD = (expectedVar / 2 + expectedCov) / dt;
    const expectedCveSigma2 = R * expectedVar + (2 * R - 1) * expectedCov;
    assert.ok(withinTolerance(expectedCveD, D, 1e-12));
    assert.ok(withinTolerance(expectedCveSigma2, sigma ** 2, 1e-12));
  });

  test("noise-only fixture (Te = 0, sigma = 0.05 um) has negative covariance and inflates naive estimate", () => {
    const dt = 1.0;
    const Te = 0;
    const sigma = 0.05e-6; // sigma^2 = 0.0025 um^2 = 0.0025e-12 m^2
    const res = cameraMoments({ D, dt, exposure: Te, sigma, drift: 0, d: 1 });
    assert.equal(res.kind, "accepted");
    if (res.kind !== "accepted") return;

    assert.ok(withinTolerance(res.data.covariance, -0.0025e-12, 1e-12));
    assert.ok(withinTolerance(res.data.naiveExpectation, 0.43194e-12, 1e-12));
    assert.ok(withinTolerance(res.data.variance + 2 * res.data.covariance, 2 * D * dt, 1e-12));
  });

  test("drift inflates uncentered naive estimate by v^2*dt / (2*d)", () => {
    const v = 0.1e-6; // 0.1 um/s
    const dt = 1.0;

    const res1 = cameraMoments({ D, dt, exposure: 0, sigma: 0, drift: v, d: 1 });
    assert.equal(res1.kind, "accepted");
    if (res1.kind !== "accepted") return;

    // d = 1 adds v^2 * dt / 2 = (0.01e-12)/2 = 0.005e-12 m^2/s
    assert.ok(withinTolerance(res1.data.naiveExpectation, D + 0.005e-12, 1e-12));

    const res2 = cameraMoments({ D, dt, exposure: 0, sigma: 0, drift: v, d: 2 });
    assert.equal(res2.kind, "accepted");
    if (res2.kind !== "accepted") return;

    // d = 2 adds v^2 * dt / 4 = 0.0025e-12 m^2/s
    assert.ok(withinTolerance(res2.data.naiveExpectation, D + 0.0025e-12, 1e-12));
  });

  test("Bartlett formula for MA(1) process matches standard deviation calculations", () => {
    const gamma0 = 0.7207333e-12;
    const gamma1 = 0.0690733e-12;
    const M = 20000;
    const d = 1;

    const bands = bartlettBandsMA1(gamma0, gamma1, M, d);
    assert.equal(bands.kind, "accepted");
    if (bands.kind !== "accepted") return;

    const expectedSdVar = Math.sqrt((2 * (gamma0 ** 2 + 2 * gamma1 ** 2)) / M);
    const expectedSdCov = Math.sqrt((gamma0 ** 2 + 3 * gamma1 ** 2) / M);

    assert.ok(withinTolerance(bands.data.sdVariance, expectedSdVar, 1e-12));
    assert.ok(withinTolerance(bands.data.sdCovariance, expectedSdCov, 1e-12));
  });

  test("disjoint pairs interval arithmetic matches exact chi-square fixture", () => {
    // Exact sigma = 0.2 um, Te = 0, dt = 1 s, q = 60, S = 28.8e-12
    const sigma2 = 0.2e-6 ** 2; // 0.04e-12
    const q = 60;
    const alpha = 0.05;
    const dt = 1.0;
    const exposure = 0;
    const d = 2;
    const pairs = 31; // pairs * d with centering: q = d*(pairs - 1) = 2 * 30 = 60
    const incMag = Math.sqrt(28.8e-12 / q);
    const positions = new Float64Array(2 * pairs * d);
    // 30 coordinates +incMag, 30 coordinates -incMag, 2 coordinates 0 => mean = 0, sum of squares = 60 * incMag^2 = 28.8e-12
    for (let k = 0; k < pairs; k++) {
      for (let c = 0; c < d; c++) {
        const index = k * d + c;
        const sign = index < 30 ? 1 : index < 60 ? -1 : 0;
        positions[2 * k * d + c] = 0;
        positions[(2 * k + 1) * d + c] = sign * incMag;
      }
    }

    const res = disjointPairsKnownNoiseInterval({
      positions,
      dt,
      exposure,
      d,
      alpha,
      noise: { kind: "exact", sigma2 },
    });
    assert.equal(res.kind, "accepted");
    if (res.kind !== "accepted") return;

    assert.equal(res.data.pairs, 31);
    assert.equal(res.data.q, 60);
    assert.equal(res.data.coverageKind, "exact");
    assert.ok(res.data.interval !== null);
    if (!res.data.interval) throw new Error("Expected pair interval");

    // v interval: [0.345745e-12, 0.711432e-12]
    // D interval: [0.132873e-12, 0.315716e-12]
    assert.ok(withinTolerance(res.data.interval.lower, 0.132873e-12, 1e-4));
    assert.ok(withinTolerance(res.data.interval.upper, 0.315716e-12, 1e-4));
  });

  test("bridge sampler: uniform exposure average has exact variance (4/3)*D*dt at Te = dt", () => {
    const dt = 1.0;
    const Te = 1.0;
    const expectedVar = (4 / 3) * D * dt; // 0.5725866666666667e-12
    const res = cameraMoments({ D, dt, exposure: Te, sigma: 0, drift: 0, d: 1 });
    assert.equal(res.kind, "accepted");
    if (res.kind !== "accepted") return;

    assert.ok(withinTolerance(res.data.variance, expectedVar, 1e-12));
    assert.ok(withinTolerance(res.data.variance, 0.5725866666666667e-12, 1e-9));
  });

  test("refusals: off-grid exposure and dt, overlapping windows, and CVE sample size < 3 are refused", () => {
    // Off-grid exposure 0.3 s:
    const gridRes = cameraGrid({
      dt: 1,
      M: 100,
      d: 1,
      exposure: 0.3,
      sigma: 0,
      stageDrift: 0,
      noiseSeed: "1905",
      clickSeed: "1926",
      clicks: 20,
    });
    assert.equal(gridRes.kind, "refused", "Te = 0.3 s must be refused as off-grid");

    // Off-grid dt = 1.5 s:
    const gridDtRes = cameraGrid({
      dt: 1.5,
      M: 100,
      d: 1,
      exposure: 0.5,
      sigma: 0,
      stageDrift: 0,
      noiseSeed: "1905",
      clickSeed: "1926",
      clicks: 20,
    });
    assert.equal(gridDtRes.kind, "refused", "dt = 1.5 s must be refused as off-grid");

    // Overlapping windows refused with outside-domain:
    const overlapRes = independentModelAdmission({
      equalSpacing: true,
      nonOverlapping: false,
      localizationStd: 0,
      exposureTime: 0,
      censored: false,
    });
    assert.equal(overlapRes.kind, "no-value");
    if (overlapRes.kind === "no-value") {
      assert.equal(overlapRes.status, "outside-domain");
    }

    // CVE with M = 2 is refused / missing:
    const cveRes = covarianceEstimator(new Float64Array([1e-6, 2e-6]), 1.0, { d: 1, exposure: 0 });
    assert.equal(cveRes.kind, "no-value");
    if (cveRes.kind === "no-value") {
      assert.equal(cveRes.status, "not-applicable");
    }
  });

  test("stationary click noise estimator requires at least 5 clicks per coordinate", () => {
    const fewClicks = new Float64Array([0.1e-6, 0.2e-6, 0.15e-6, 0.12e-6]); // only 4 clicks for d=1
    const res = stationaryClickNoiseEstimate(fewClicks, { d: 1 });
    assert.equal(res.kind, "refused");

    const validClicks = new Float64Array([0.1e-6, 0.2e-6, 0.15e-6, 0.12e-6, 0.18e-6]); // 5 clicks
    const validRes = stationaryClickNoiseEstimate(validClicks, { d: 1 });
    assert.equal(validRes.kind, "accepted");
    if (validRes.kind === "accepted") {
      assert.equal(validRes.data.clicks, 5);
      assert.equal(validRes.data.d, 1);
      assert.equal(validRes.data.q, 4);
    }
  });
});
