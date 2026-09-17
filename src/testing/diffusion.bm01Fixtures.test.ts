import { describe, expect, test } from "bun:test";
import { getConstantSet } from "../physics/reference/constants.ts";
import {
  apparentSpeed,
  moments,
  rmsDisplacement,
  stokesEinsteinD,
} from "../physics/reference/diffusion.ts";

/**
 * Three BM-01 fixture groups (am-bm-01-tracer-ensemble-hdly's own Test Plan) not covered by
 * `diffusion.einsteinPrinted.test.ts` (which owns the historical and modern-kB fixtures) or by
 * any generic scenario YAML (that mechanism owns one `elapsedTime` per scenario; these fixtures
 * each need two). Direct assertions against the real owner, same convention as the sibling file.
 */

function val(e: { result: { status: string; value?: number | Float64Array } }): number {
  expect(e.result.status).toBe("value");
  return e.result.value as number;
}

describe("diffusion-modern-golden (T=293.15 K, eta=1.000 mPa s, a=0.500 um, modern-si-2019)", () => {
  const modern = getConstantSet("modern-si-2019");
  const D = val(stokesEinsteinD({ T: 293.15, eta: 1.0e-3, a: 0.5e-6 }, modern));

  test("D = 0.4294396 um^2/s", () => {
    expect(Math.abs(D * 1e12 - 0.4294396)).toBeLessThan(5e-7);
  });

  test("RMS displacement is 0.9267573 um at 1 s and 2.9306640 um at 10 s", () => {
    const oneSecond = val(rmsDisplacement(D, 1));
    const tenSeconds = val(rmsDisplacement(D, 10));
    expect(Math.abs(oneSecond / 0.9267573e-6 - 1)).toBeLessThan(1e-6);
    expect(Math.abs(tenSeconds / 2.930664e-6 - 1)).toBeLessThan(1e-6);
  });

  test("1D mean absolute displacement is 0.7394454 um at 1 s", () => {
    const meanAbsolute = val(moments(1, D, 1).meanRadius);
    expect(Math.abs(meanAbsolute / 0.7394454e-6 - 1)).toBeLessThan(1e-5);
  });
});

describe("diffusion-modern-viscosity-17c (T=290.15 K, eta=1.08 mPa s, a=0.5 um, modern-si-2019)", () => {
  const modern = getConstantSet("modern-si-2019");
  const D = val(stokesEinsteinD({ T: 290.15, eta: 1.08e-3, a: 0.5e-6 }, modern));

  test("RMS displacement is 0.8871979 um at 1 s and 6.872205 um at 60 s", () => {
    const oneSecond = val(rmsDisplacement(D, 1));
    const sixtySeconds = val(rmsDisplacement(D, 60));
    expect(Math.abs(oneSecond / 0.8871979e-6 - 1)).toBeLessThan(1e-6);
    expect(Math.abs(sixtySeconds / 6.872205e-6 - 1)).toBeLessThan(1e-6);
  });

  test("this is a materially different number from the printed-viscosity modern-kB comparison (0.7935339 um), never conflated", () => {
    const oneSecond = val(rmsDisplacement(D, 1));
    expect(Math.abs(oneSecond / 0.7935339e-6 - 1)).toBeGreaterThan(0.01);
  });
});

describe("apparent-speed identity under the Einstein historical constant set (D = 0.3158402 um^2/s)", () => {
  // D is taken as given here (a fixture value, not recomputed from a constant set), matching
  // this bead's own Test Plan statement of it; diffusion.einsteinPrinted.test.ts is the file
  // that derives this D from the declared historical scenario's stated R and N.
  const D = 0.3158402e-12;

  test("quartering the observation interval doubles the apparent speed: 0.7947833 um/s at 1 s, 1.589567 um/s at 0.25 s", () => {
    const atOneSecond = val(apparentSpeed(D, 1));
    const atQuarterSecond = val(apparentSpeed(D, 0.25));
    expect(Math.abs(atOneSecond / 0.7947833e-6 - 1)).toBeLessThan(1e-6);
    expect(Math.abs(atQuarterSecond / 1.589567e-6 - 1)).toBeLessThan(1e-6);
    expect(Math.abs(atQuarterSecond / atOneSecond - 2)).toBeLessThan(1e-9);
  });

  test("this is exactly the displayed pair of the bm-01-velocity-trap preset", () => {
    // The preset's own displayed values, restated here as the same identity so a rename of
    // either fixture's numbers cannot silently drift from the other.
    const atOneSecond = val(apparentSpeed(D, 1));
    const atQuarterSecond = val(apparentSpeed(D, 0.25));
    expect(Math.abs(atOneSecond * 1e6 - 0.7947833)).toBeLessThan(1e-6);
    expect(Math.abs(atQuarterSecond * 1e6 - 1.589567)).toBeLessThan(1e-5);
  });
});
