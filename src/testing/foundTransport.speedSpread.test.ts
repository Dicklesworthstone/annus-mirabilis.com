import { describe, expect, test } from "bun:test";
import {
  FAST_PERCENT,
  MEAN_ENERGY_PER_AXIS,
  PARTICLES,
  SLOW_PERCENT,
  SPREAD_RATIO,
} from "../foundations/speedSpread.ts";
import { getConstantSet, thermalConstant } from "../physics/reference/constants.ts";
import { erf, erfc } from "../physics/reference/special/erf.ts";
import { roundsTo } from "../units/tolerance.ts";

/**
 * am-found-transport-thermo-smv3: the temperature lesson's "speed-distribution picture with the
 * shared 3/2 k_BT". Every fact the picture prints is recomputed here from the lesson's own inputs
 * (293 K, a nitrogen molecule of 4.65 × 10⁻²⁶ kg, a 0.5 μm grain of 1200 kg/m³), the modern
 * Boltzmann constant, and the erf owner.
 */

const kT = thermalConstant(getConstantSet("modern-si-2019")).value * 293;
const NITROGEN = 4.65e-26;
const GRAIN = 1200 * (4 / 3) * Math.PI * 5e-7 ** 3;
const printed = (value: number, shown: number, figures: number) =>
  roundsTo(value, shown, { significantFigures: figures }).ok;
const particle = (id: string) => PARTICLES.find((p) => p.id === id);

describe("the spreads, and how far apart they are", () => {
  test("a nitrogen molecule: √(k_BT/m) is about 295 m/s", () => {
    expect(particle("nitrogen")).toMatchObject({ spread: 295, unit: "m/s" });
    expect(printed(Math.sqrt(kT / NITROGEN), 295, 3)).toBe(true);
  });

  test("a 0.5 μm grain: about 2.5 mm/s", () => {
    expect(particle("grain")).toMatchObject({ spread: 2.5, unit: "mm/s" });
    expect(printed(Math.sqrt(kT / GRAIN) * 1000, 2.5, 2)).toBe(true);
  });

  test("the grain's spread is about 120 000 times smaller, the square root of the mass ratio", () => {
    expect(printed(Math.sqrt(GRAIN / NITROGEN), SPREAD_RATIO, 2)).toBe(true);
  });

  test("the mean energy along an axis is ½k_BT = 2.02 × 10⁻²¹ J, the same for both", () => {
    expect(printed(kT / 2, MEAN_ENERGY_PER_AXIS, 3)).toBe(true);
    for (const m of [NITROGEN, GRAIN])
      expect(printed(0.5 * m * (kT / m), MEAN_ENERGY_PER_AXIS, 3)).toBe(true);
  });
});

describe("the two marked regions", () => {
  // Energy along the axis over its average is u², with u the speed in widths: a quarter of the
  // average is half a width, four times the average is two widths.
  test("under a quarter of the average energy: |u| < 0.5, about 38 per cent", () => {
    expect(0.5 ** 2).toBe(0.25);
    expect(printed(100 * erf(0.5 / Math.SQRT2), SLOW_PERCENT, 2)).toBe(true);
  });

  test("over four times the average: |u| > 2, about 5 per cent", () => {
    expect(2 ** 2).toBe(4);
    expect(printed(100 * erfc(2 / Math.SQRT2), FAST_PERCENT, 1)).toBe(true);
  });
});
