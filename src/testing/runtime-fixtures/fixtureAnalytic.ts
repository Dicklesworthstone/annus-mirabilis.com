/**
 * Closed-form analytic fixture (am-rt-snapshot-store-aft / am-rt-browser-conformance-09i5).
 * One number from the admitted seed and frame speed. No worker, no WASM: the
 * worker-side probe is a separate protocol payload. This module is the host
 * description of the same quantity, so two placements with the same inputs
 * agree, and an observer-only change does not change it.
 */
export const ANALYTIC_QUANTITY_ID = "fixtureProbe";
export const ANALYTIC_OWNER_ID = "runtime-fixture-analytic";

export function analyticProbe(seedDecimal: string, frameSpeedVc: number): number {
  let hash = 2166136261;
  for (let i = 0; i < seedDecimal.length; i++) {
    hash ^= seedDecimal.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const unit = (hash >>> 0) / 4294967296;
  return unit * (1 + frameSpeedVc * frameSpeedVc);
}
