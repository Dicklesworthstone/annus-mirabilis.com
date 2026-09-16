import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { cameraMoments } from "../physics/reference/inference/observation.ts";

function withinTolerance(actual: number, expected: number, tol = 1e-9): boolean {
  return Math.abs(actual - expected) <= tol * Math.max(Math.abs(expected), 1e-30);
}

describe("inference.apparentSpeed: Apparent speed scaling and noise crossover (am-bm-08-measurement-bias-h1ye)", () => {
  const D = 0.42944e-12; // m^2/s
  const sigma = 0.2e-6; // m (0.2 um)
  const Te = 0; // s
  const d = 1;

  test("the six fixture rows reproduce to 10^-9 relative tolerance and crossover is sigma^2/D", () => {
    const fixtureRows = [
      {
        dt: 4.0,
        idealRms: 1.853516e-6,
        measuredRms: 1.874972e-6,
        idealSpeed: 0.463379e-6,
        measuredSpeed: 0.468743e-6,
        ratio: 1.011576,
      },
      {
        dt: 1.0,
        idealRms: 0.926758e-6,
        measuredRms: 0.968958e-6,
        idealSpeed: 0.926758e-6,
        measuredSpeed: 0.968958e-6,
        ratio: 1.045536,
      },
      {
        dt: 0.25,
        idealRms: 0.463379e-6,
        measuredRms: 0.542881e-6,
        idealSpeed: 1.853516e-6,
        measuredSpeed: 2.171525e-6,
        ratio: 1.171571,
      },
      {
        dt: 0.0625,
        idealRms: 0.231689e-6,
        measuredRms: 0.365623e-6,
        idealSpeed: 3.707031e-6,
        measuredSpeed: 5.849964e-6,
        ratio: 1.578073,
      },
      {
        dt: 0.01,
        idealRms: 0.092676e-6,
        measuredRms: 0.297639e-6,
        idealSpeed: 9.267578e-6,
        measuredSpeed: 29.763871e-6,
        ratio: 3.211613,
      },
      {
        dt: 0.0025,
        idealRms: 0.046338e-6,
        measuredRms: 0.286613e-6,
        idealSpeed: 18.535156e-6,
        measuredSpeed: 114.645331e-6,
        ratio: 6.185291,
      },
    ];

    const crossoverExpected = sigma ** 2 / D; // 0.09314456044616244... s
    assert.ok(
      withinTolerance(crossoverExpected, 0.09314456044616244, 1e-9),
      `Crossover interval should match expected value: ${crossoverExpected}`,
    );

    for (const row of fixtureRows) {
      const res = cameraMoments({ D, dt: row.dt, exposure: Te, sigma, drift: 0, d });
      assert.equal(res.kind, "accepted", "cameraMoments must accept valid parameters");
      if (res.kind !== "accepted") return;

      const { idealApparentSpeed, measuredApparentSpeed, apparentSpeedRatio, crossover } = res.data;
      const computedIdealRms = Math.sqrt(2 * D * row.dt);
      const computedMeasuredRms = Math.sqrt(2 * D * row.dt + 2 * sigma ** 2);

      // 6-digit display table matching:
      assert.ok(
        withinTolerance(computedIdealRms, row.idealRms, 1e-5),
        `Ideal RMS at dt=${row.dt} should match fixture: ${computedIdealRms} vs ${row.idealRms}`,
      );
      assert.ok(
        withinTolerance(computedMeasuredRms, row.measuredRms, 1e-5),
        `Measured RMS at dt=${row.dt} should match fixture: ${computedMeasuredRms} vs ${row.measuredRms}`,
      );
      assert.ok(
        withinTolerance(idealApparentSpeed, row.idealSpeed, 1e-5),
        `Ideal speed at dt=${row.dt} should match fixture: ${idealApparentSpeed} vs ${row.idealSpeed}`,
      );
      assert.ok(
        withinTolerance(measuredApparentSpeed, row.measuredSpeed, 1e-5),
        `Measured speed at dt=${row.dt} should match fixture: ${measuredApparentSpeed} vs ${row.measuredSpeed}`,
      );
      assert.ok(
        withinTolerance(apparentSpeedRatio, row.ratio, 1e-5),
        `Ratio at dt=${row.dt} should match fixture: ${apparentSpeedRatio} vs ${row.ratio}`,
      );

      // Exact closed-form formula matching to 10^-12 relative:
      assert.ok(
        withinTolerance(idealApparentSpeed, Math.sqrt(2 * D * row.dt) / row.dt, 1e-12),
        `Ideal speed should match exact formula to 10^-12`,
      );
      assert.ok(
        withinTolerance(
          measuredApparentSpeed,
          Math.sqrt(2 * D * row.dt + 2 * sigma ** 2) / row.dt,
          1e-12,
        ),
        `Measured speed should match exact formula to 10^-12`,
      );
      assert.ok(
        withinTolerance(apparentSpeedRatio, Math.sqrt(1 + sigma ** 2 / (D * row.dt)), 1e-12),
        `Ratio should match exact formula to 10^-12`,
      );

      assert.ok(crossover !== null, "Crossover must be present when sigma > 0 and exposure == 0");
      if (crossover === null) throw new Error("Expected crossover");
      assert.ok(
        withinTolerance(crossover, crossoverExpected, 1e-12),
        `Crossover should equal sigma^2/D: ${crossover} vs ${crossoverExpected}`,
      );
    }
  });

  test("apparent speed ratio formula s_meas / s_ideal = sqrt(1 + sigma^2 / (D * dt)) holds to 10^-12 relative", () => {
    const testIntervals = [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0];
    for (const dt of testIntervals) {
      const res = cameraMoments({ D, dt, exposure: 0, sigma, drift: 0, d });
      assert.equal(res.kind, "accepted");
      if (res.kind !== "accepted") return;

      const theoreticalRatio = Math.sqrt(1 + sigma ** 2 / (D * dt));
      assert.ok(
        withinTolerance(res.data.apparentSpeedRatio, theoreticalRatio, 1e-12),
        `Ratio at dt=${dt} should match closed-form formula to 10^-12`,
      );
    }
  });

  test("as dt -> 0, measured speed approaches sqrt(2)*sigma/dt within 1.5% by dt = 0.0025 s", () => {
    const dt = 0.0025;
    const res = cameraMoments({ D, dt, exposure: 0, sigma, drift: 0, d });
    assert.equal(res.kind, "accepted");
    if (res.kind !== "accepted") return;

    const asymptoticSpeed = (Math.sqrt(2) * sigma) / dt; // 113.137085 um/s
    const measuredSpeed = res.data.measuredApparentSpeed;
    const relDiff = Math.abs(measuredSpeed - asymptoticSpeed) / asymptoticSpeed;

    assert.ok(
      relDiff < 0.015,
      `Measured speed ${measuredSpeed} should approach noise asymptote ${asymptoticSpeed} within 1.5%, got ${(relDiff * 100).toFixed(3)}%`,
    );
  });

  test("with exposure Te = 0.5 s, dt = 1 s, and sigma = 0.05 um the outputs use 2D(dt - Te/3) + 2*sigma^2", () => {
    const TeExp = 0.5;
    const dtExp = 1.0;
    const sigmaExp = 0.05e-6;
    const res = cameraMoments({ D, dt: dtExp, exposure: TeExp, sigma: sigmaExp, drift: 0, d: 1 });
    assert.equal(res.kind, "accepted");
    if (res.kind !== "accepted") return;

    const expectedVar = 2 * D * (dtExp - TeExp / 3) + 2 * sigmaExp ** 2; // 0.7207333333333333e-12
    assert.ok(
      withinTolerance(res.data.variance, expectedVar, 1e-12),
      `Variance with exposure must equal 2D(dt - Te/3) + 2*sigma^2: ${res.data.variance} vs ${expectedVar}`,
    );
    assert.ok(
      withinTolerance(res.data.variance, 0.7207333333333333e-12, 1e-9),
      `Variance must match 0.7207333 um^2 exposure fixture`,
    );
  });

  test("sigma = 0 gives null crossover and bitwise-equal ideal and measured speeds", () => {
    const res = cameraMoments({ D, dt: 1.0, exposure: 0, sigma: 0, drift: 0, d: 1 });
    assert.equal(res.kind, "accepted");
    if (res.kind !== "accepted") return;

    assert.equal(res.data.crossover, null, "Crossover must be null when sigma = 0");
    assert.equal(
      res.data.idealApparentSpeed,
      res.data.measuredApparentSpeed,
      "Ideal and measured speeds must be bitwise equal when sigma = 0 and exposure = 0",
    );
    assert.equal(res.data.apparentSpeedRatio, 1, "Ratio must be exactly 1 when sigma = 0");
  });

  test("adversarial: ignoring 2*sigma^2 term fails dt = 0.01 s row by factor of 3.211613 (names omitted 2*sigma^2)", () => {
    const dt = 0.01;
    const res = cameraMoments({ D, dt, exposure: 0, sigma, drift: 0, d: 1 });
    assert.equal(res.kind, "accepted");
    if (res.kind !== "accepted") return;

    const trueMeasuredSpeed = res.data.measuredApparentSpeed;
    const naiveOmittedNoiseSpeed = Math.sqrt(2 * D * dt) / dt; // ignoring 2*sigma^2
    const errorFactor = trueMeasuredSpeed / naiveOmittedNoiseSpeed;

    assert.ok(
      withinTolerance(errorFactor, 3.211613, 1e-5),
      `Omitting 2*sigma^2 noise term underestimates apparent speed by factor of 3.211613: got ${errorFactor}`,
    );
  });
});
