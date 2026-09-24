import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { OSMOTIC_ROWS, OSMOTIC_TEMPERATURE } from "../foundations/osmoticRows.ts";
import { constantValue, getConstantSet } from "../physics/reference/constants.ts";
import { osmoticPressure } from "../physics/reference/diffusion.ts";
import { roundsTo } from "../units/tolerance.ts";

/**
 * am-found-transport-thermo-smv3: the osmotic-pressure lesson's "selective-partition construction
 * with number density and pressure". Every pressure the table prints is recomputed through the
 * owner at the temperature it states; every share of the volume as ν(4/3)πa³.
 */

const modern = getConstantSet("modern-si-2019");
const printed = (value: number, shown: number, figures: number) =>
  roundsTo(value, shown, { significantFigures: figures }).ok;
const pressure = (n: number) => {
  const r = osmoticPressure({ n, T: OSMOTIC_TEMPERATURE }, modern);
  if (r.result.status !== "value" || typeof r.result.value !== "number")
    throw new TypeError(r.result.status);
  return r.result.value;
};
const share = (n: number, radius: number) => n * (4 / 3) * Math.PI * (radius * 1e-6) ** 3;
/** Dilute enough for p = νk_BT: the table refuses any row whose grains fill a tenth or more. */
const DILUTE = 0.1;

describe("every row, recomputed", () => {
  test("sugar at 0.1 gram-molecule per litre: 6.02 × 10²⁵ per m³ and about 2.4 × 10⁵ Pa", () => {
    const sugar = OSMOTIC_ROWS[0];
    const n = 0.1 * 1000 * constantValue(modern, "avogadroConstant").value;
    expect(printed(n, sugar?.perCubicMetre ?? 0, 3)).toBe(true);
    expect(printed(pressure(n), sugar?.pressure ?? 0, 2)).toBe(true);
  });

  for (const row of OSMOTIC_ROWS.filter((r) => r.radius !== null))
    test(row.what, () => {
      const filled = share(row.perCubicMetre, row.radius as number);
      expect(printed(filled, row.share as number, 1)).toBe(true);
      if (filled < DILUTE)
        expect(printed(pressure(row.perCubicMetre), row.pressure as number, 2)).toBe(true);
      else expect(row.pressure).toBeNull();
    });
});

describe("what the words around the table claim", () => {
  test("the two grain sizes at the same count push equally, one a thousand times the other's volume", () => {
    const grains = OSMOTIC_ROWS.filter((r) => r.perCubicMetre === 1e15);
    expect(grains.map((r) => r.radius)).toEqual([0.5, 0.05]);
    expect(grains[0]?.pressure).toBe(grains[1]?.pressure);
    expect(printed((0.5 / 0.05) ** 3, 1000, 4)).toBe(true);
  });

  test("the crowded row is the only refused one, and its grains fill about half the volume", () => {
    const refused = OSMOTIC_ROWS.filter((r) => r.pressure === null);
    expect(refused.map((r) => r.perCubicMetre)).toEqual([1e18]);
    expect(printed(share(1e18, 0.5), 0.5, 1)).toBe(true);
  });

  test("the lesson's own numbers agree: about 2.4 × 10⁵ Pa and about 4 × 10⁻⁶ Pa", () => {
    expect(printed(pressure(6.02e25), 2.4e5, 2)).toBe(true);
    expect(printed(pressure(1e15), 4e-6, 1)).toBe(true);
  });

  test("the linked laboratory has a page", () => {
    expect(existsSync(join(process.cwd(), "src/app/lab/bm-02/page.tsx"))).toBe(true);
  });
});
