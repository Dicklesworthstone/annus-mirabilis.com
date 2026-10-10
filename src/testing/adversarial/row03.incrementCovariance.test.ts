/**
 * ROW 3: "Camera noise leaves neighbouring increments independent" (am-ver-adversarial-audit-1ef).
 *
 * Localization error enters two consecutive increments with OPPOSITE sign, so it induces a negative
 * covariance even when the latent walk has independent steps. The row's two stated values are
 * -sigma^2 for an instantaneous measurement and D*Te/3 - sigma^2 under a uniform exposure Te, and
 * both were measured against the owner before being written here.
 *
 * WHY THE WRONG MODEL IS PLAUSIBLE, which is the reason this fixture earns its place: the variance
 * is inflated in the right direction either way, so a variance-only check passes under both. Only
 * the covariance separates them, and AGENTS.md names this exact countermodel -- "camera noise leaves
 * neighboring increments independent".
 */

import { expect, test } from "bun:test";
import { cameraMoments } from "../../physics/reference/inference/observation.ts";
import { wrongNeighbouringCovariance } from "./wrongComputations.ts";

const D = 2e-13;
const DT = 0.1;
const SIGMA = 2e-8;
const model = (exposure: number) => ({ D, dt: DT, exposure, sigma: SIGMA, drift: 0, d: 1 });

function moments(exposure: number) {
  const out = cameraMoments(model(exposure));
  expect(out.kind).toBe("accepted");
  if (out.kind !== "accepted") throw new Error("owner refused");
  return out.data;
}

test("an instantaneous measurement gives covariance = -sigma^2, not zero", () => {
  const { covariance } = moments(0);
  expect(covariance).toBeCloseTo(-(SIGMA ** 2), 20);
  expect(covariance).toBeLessThan(0);
  // The failing assertion for this row: the wrong model's zero is not the owner's value.
  expect(wrongNeighbouringCovariance()).not.toBeCloseTo(covariance, 20);
});

test("with a uniform exposure the covariance is D*Te/3 - sigma^2", () => {
  for (const exposure of [DT / 2, DT]) {
    const { covariance } = moments(exposure);
    expect(covariance).toBeCloseTo((D * exposure) / 3 - SIGMA ** 2, 20);
  }
  // The exposure term can outweigh the noise term and turn the covariance POSITIVE, which is why
  // the row states a formula rather than "the covariance is negative".
  expect(moments(DT).covariance).toBeGreaterThan(0);
  expect(moments(0).covariance).toBeLessThan(0);
});

test("the variance alone cannot discriminate, which is why the covariance is the check", () => {
  // Both models agree that the variance is inflated; a fixture asserting only that would pass
  // under the error. Stated as an assertion so the choice of check is itself tested.
  const { variance } = moments(0);
  const latentOnly = 2 * D * DT;
  expect(variance).toBeGreaterThan(latentOnly);
});
