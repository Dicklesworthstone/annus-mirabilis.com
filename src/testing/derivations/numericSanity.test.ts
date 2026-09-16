import assert from "node:assert/strict";
import test from "node:test";
import { withinTolerance } from "../../units/tolerance.ts";

test("numericSanity: Fixture 5 (Lorentz boost) independent arithmetic at v = 0.6c", () => {
  const v_rel = 0.6; // v / c
  const v2_over_c2 = v_rel * v_rel; // 0.36
  const one_minus_beta2 = 1 - v2_over_c2; // 0.64
  const a = 1 / Math.sqrt(one_minus_beta2); // 1 / 0.8 = 1.25

  assert.equal(a, 1.25);

  // d = -a * (v / c^2), represented as coefficient of 1/c:
  const d_coeff = -a * v_rel; // -1.25 * 0.6 = -0.75
  assert.equal(d_coeff, -0.75);

  // Inverse boost composition identity: a(v) * a(-v) * (1 - v^2/c^2) = 1.25 * 1.25 * 0.64 = 1.5625 * 0.64 = 1
  const product = a * a * one_minus_beta2;
  const verdict = withinTolerance(product, 1.0, { absolute: 1e-12, relative: 1e-12 });
  assert.ok(verdict.ok, `a(v)*a(-v)*(1-0.36) must equal 1 within 1e-12. Diff: ${verdict.diff}`);
});

test("numericSanity: Fixture 4 (Mass-Energy two ledgers) series truncation at v = 0.1c and L = 1 J", () => {
  const L = 1.0; // 1 Joule
  const v_rel = 0.1; // v / c
  const beta2 = v_rel * v_rel; // 0.01

  const gamma = 1 / Math.sqrt(1 - beta2); // 1 / sqrt(0.99)
  const exactTerm = L * (gamma - 1); // approx 5.03781526e-3 J

  // Truncation to second order: (1/2) * (L / c^2) * v^2 = (1/2) * L * beta^2 = 0.5 * 1.0 * 0.01 = 5.0e-3 J
  const truncation = 0.5 * L * beta2;
  const verdictTrunc = withinTolerance(truncation, 5.0e-3, { absolute: 1e-12, relative: 1e-12 });
  assert.ok(verdictTrunc.ok, `truncation must be 5.0e-3 within tolerance`);

  const diff = exactTerm - truncation; // approx 3.781526e-5 J
  const ratio = diff / truncation; // approx 7.56305e-3

  // Next series term in Taylor expansion: (3/8) * L * beta^4 = 0.375 * 1.0 * (0.01)^2 = 3.75e-5 J
  const nextOrder = (3 / 8) * L * (beta2 * beta2);

  const verdictExact = withinTolerance(exactTerm, 5.03781526e-3, {
    absolute: 1e-8,
    relative: 1e-6,
  });
  assert.ok(verdictExact.ok, `exact term L(gamma-1) must match 5.03781526e-3`);

  const verdictDiff = withinTolerance(diff, 3.781526e-5, { absolute: 1e-8, relative: 1e-4 });
  assert.ok(verdictDiff.ok, `difference must match 3.78e-5 J`);

  const verdictRatio = withinTolerance(ratio, 7.563e-3, { absolute: 1e-5, relative: 1e-3 });
  assert.ok(verdictRatio.ok, `difference ratio to truncation must match 7.563e-3`);

  const verdictNextOrder = withinTolerance(nextOrder, 3.75e-5, { absolute: 1e-8, relative: 1e-4 });
  assert.ok(verdictNextOrder.ok, `next series term (3/8) L (v/c)^4 must match 3.75e-5 J`);
});
