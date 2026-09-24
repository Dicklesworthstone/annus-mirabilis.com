import { describe, expect, test } from "bun:test";
import { EINSTEIN_ONE_SECOND } from "../discovery/brownian/numericExercises.ts";
import { SINKING, SINKING_ROWS } from "../foundations/sinkingSpheres.ts";
import { stokesMobility } from "../physics/reference/diffusion/routeA.ts";
import { roundsTo } from "../units/tolerance.ts";

/**
 * am-found-transport-thermo-smv3: the Stokes-drag lesson's "sinking-sphere drag table". The table
 * is printed in src/foundations/sinkingSpheres.ts; every cell is recomputed here through the Stokes
 * owner, stokesMobility, at the figures the table prints. The only other arithmetic is the grain's
 * weight less its buoyancy.
 */

const { grainDensity, waterDensity, viscosity, gravity } = SINKING;
const mobility = (radius: number) => {
  const r = stokesMobility(viscosity, radius * 1e-6) as {
    result: { status: string; value?: unknown };
  };
  if (r.result.status !== "value" || typeof r.result.value !== "number")
    throw new TypeError(r.result.status);
  return r.result.value;
};
/** Sinking speed in m/s: excess weight times the owner's speed per unit force. */
const speed = (radius: number) =>
  (grainDensity - waterDensity) *
  gravity *
  (4 / 3) *
  Math.PI *
  (radius * 1e-6) ** 3 *
  mobility(radius);
const printed = (value: number, shown: number, figures: number) =>
  roundsTo(value, shown, { significantFigures: figures }).ok;

describe("every cell of the table, recomputed", () => {
  test("five rows, from 0.25 to 5 μm, with the lesson's 0.5 μm sphere among them", () => {
    expect(SINKING_ROWS.map((r) => r.radius)).toEqual([0.25, 0.5, 1, 2.5, 5]);
  });

  for (const row of SINKING_ROWS)
    test(`${row.radius} μm`, () => {
      const v = speed(row.radius);
      expect(printed(1e-6 / mobility(row.radius), row.drag, 3)).toBe(true);
      expect(printed(v * 1e6, row.speed, 3)).toBe(true);
      const seconds = 1e-3 / v;
      const inUnit = row.time.unit === "hours" ? seconds / 3600 : seconds / 60;
      expect(printed(inUnit, row.time.value, 2)).toBe(true);
      expect(printed((waterDensity * v * row.radius * 1e-6) / viscosity, row.inertiaRatio, 1)).toBe(
        true,
      );
    });
});

describe("what the words around the table claim", () => {
  test("ten times the radius sinks a hundred times as fast", () => {
    expect(printed(speed(5) / speed(0.5), 100, 3)).toBe(true);
  });

  test("the lesson's own 9.4 × 10⁻¹⁵ N is the 0.5 μm row at two figures", () => {
    const lessonSphere = SINKING_ROWS.find((r) => r.radius === 0.5);
    expect(printed(lessonSphere?.drag ?? 0, 9.4e-15, 2)).toBe(true);
  });

  test("§5's one-second wander, about 0.8 μm, is several times the 0.109 μm the sphere sinks", () => {
    const wander = EINSTEIN_ONE_SECOND.reference.value * 1e6;
    expect(printed(wander, 0.8, 1)).toBe(true);
    expect(wander / (speed(0.5) * 1e6)).toBeGreaterThan(3);
  });

  test("every row keeps inertia below a ten-thousandth of viscosity, so Stokes's law holds", () => {
    for (const row of SINKING_ROWS) expect(row.inertiaRatio).toBeLessThan(1e-4);
  });
});
