import { describe, expect, test } from "bun:test";
import { logField, logFieldFailure } from "../physics/reference/fields.log.ts";
import { C_SI, type SpacetimeScalarFn, transformDerivatives } from "../physics/reference/fields.ts";

describe("fields.derivatives.test.ts: Derivative transformations via Richardson central differences", () => {
  const field1: SpacetimeScalarFn = (x, y, z, t) => {
    // Polynomial field with time scaled by C_SI
    const ct = C_SI * t;
    return x * x + 2 * x * ct - 3 * ct * ct + y * z;
  };

  const field2: SpacetimeScalarFn = (x, y, z, t) => {
    // Trigonometric wave field
    const k = 0.5;
    const omega = k * C_SI;
    return Math.sin(k * x - omega * t) * Math.cos(0.2 * y) * Math.exp(-0.01 * z * z);
  };

  const field3: SpacetimeScalarFn = (x, y, z, t) => {
    // Smooth 4D Gaussian wave packet
    const L = 100.0;
    const ct = C_SI * t;
    const r2 = (x * x + y * y + z * z + ct * ct) / (L * L);
    return Math.exp(-r2);
  };

  test("chain rule relations hold on 3 declared smooth test fields within 1e-8 relative", () => {
    const t0 = performance.now();
    const testFields = [
      { name: "polynomial", fn: field1 },
      { name: "trigonometric", fn: field2 },
      { name: "gaussian", fn: field3 },
    ];

    const points = [
      { x: 10.0, y: 5.0, z: 2.0, t: 1e-8 },
      { x: -50.0, y: 20.0, z: -10.0, t: 3e-8 },
    ];

    const speeds = [-0.6, 0.2, 0.6];

    for (const tf of testFields) {
      for (const pt of points) {
        for (const beta of speeds) {
          const res = transformDerivatives(tf.fn, pt, beta, C_SI, 1e-8);

          if (!res.passed) {
            logFieldFailure("fields-derivatives-chain-rule-fail", {
              field: tf.name,
              pt,
              beta,
              res,
            });
          }

          expect(res.passed).toBe(true);
          expect(res.relErrorDx).toBeLessThan(1e-8);
          expect(res.relErrorDt).toBeLessThan(1e-8);
        }
      }
    }

    logField({
      testId: "fields-derivatives-richardson-check",
      resultStatus: "value",
      outcome: "passed",
      durationMs: performance.now() - t0,
      message:
        "Derivative transformations d/dx = gamma(d/dx' - v/c^2 d/dt') and d/dt = gamma(d/dt' - v d/dx') pass on 3 smooth fields within 1e-8.",
    });
  });
});
