import { describe, expect, test } from "bun:test";
import { logField, logFieldFailure } from "../physics/reference/fields.log.ts";
import {
  maxwellResidualsPlaneWave,
  type PlaneWaveKind,
  type Polarization,
  seededPlaneWaveEvents,
} from "../physics/reference/fields.ts";

describe("fields.planeWave.test.ts: Transformed plane waves and Maxwell residuals (SR-07)", () => {
  test("Maxwell residuals stay below 1e-12 relative for declared directions, polarizations, and speeds", () => {
    const t0 = performance.now();
    const directions: PlaneWaveKind[] = ["plus-x", "minus-x", "plus-y", "oblique"];
    const polarizations: Polarization[] = ["primary", "secondary"];
    const speeds = [-0.95, -0.6, 0, 0.6, 0.95];
    const events = seededPlaneWaveEvents();

    for (const beta of speeds) {
      for (const wave of directions) {
        for (const polarization of polarizations) {
          const res = maxwellResidualsPlaneWave({
            beta,
            wave,
            polarization,
            events,
            convention: "printed",
            E0: 1.0,
            omega: 1.0,
          });

          if (!res.passed) {
            logFieldFailure("fields-plane-wave-fail", { beta, wave, polarization, res });
          }

          expect(res.passed).toBe(true);
          expect(res.maxResidual).toBeLessThan(1e-12);
        }
      }
    }

    logField({
      testId: "fields-plane-wave-maxwell-residuals",
      resultStatus: "value",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Source-free Maxwell residuals in moving frame stay below 1e-12 for all declared directions and polarizations.",
    });
  });

  test("at beta=0.6, transformed amplitude and frequency factors are exactly 0.5 for +x wave", () => {
    const t0 = performance.now();
    const beta = 0.6;
    const res = maxwellResidualsPlaneWave({
      beta,
      wave: "plus-x",
      polarization: "primary",
      E0: 2.0,
      omega: 4.0,
    });

    // gamma = 1.25, Doppler factor = gamma * (1 - beta) = 1.25 * 0.4 = 0.5
    expect(res.amplitudeFactor).toBeCloseTo(0.5, 12);
    expect(res.frequencyFactor).toBeCloseTo(0.5, 12);

    logField({
      testId: "fields-plane-wave-0.6c-doppler-amplitude",
      beta,
      resultStatus: "value",
      expected: 0.5,
      actual: res.amplitudeFactor,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "At beta=0.6, amplitude and frequency scaling factors are 0.5 matching Doppler shift.",
    });
  });

  test("deliberately sign-flipped transform variant fails with residuals far above tolerance", () => {
    const t0 = performance.now();
    const beta = 0.6;
    const res = maxwellResidualsPlaneWave({
      beta,
      wave: "oblique",
      polarization: "secondary",
      convention: "flipped-z-prime",
      E0: 1.0,
      omega: 1.0,
    });

    expect(res.passed).toBe(false);
    expect(res.maxResidual).toBeGreaterThan(0.1); // Far above 1e-12!

    logField({
      testId: "fields-plane-wave-flipped-variant-fails",
      beta,
      resultStatus: "value",
      expected: "failure",
      actual: res.maxResidual,
      outcome: "passed",
      durationMs: performance.now() - t0,
      message: "Deliberately sign-flipped transformation fails Maxwell residuals with large error.",
    });
  });
});
