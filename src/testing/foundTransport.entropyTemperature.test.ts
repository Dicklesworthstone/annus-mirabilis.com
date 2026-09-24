import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load as loadYaml } from "js-yaml";
import { LQ04_DEFAULTS } from "../experiments/lq04/definition.ts";
import { evaluateLq04 } from "../experiments/lq04/session.ts";
import { ENTROPY_TEMPERATURE_CHECK } from "../foundations/lessonInstruments.ts";
import { constantValue, getConstantSet, thermalConstant } from "../physics/reference/constants.ts";
import { wienSpectralEntropyDensity } from "../physics/reference/radiation/entropy.ts";
import { roundsTo, withinTolerance } from "../units/tolerance.ts";

/**
 * am-found-transport-thermo-smv3: "An entropy–temperature check that embeds
 * am-lq-04-entropy-workbench-senj at its preset lq-04-derived-temperature ... (600 THz, 3 000 K,
 * 1/T = 3.333×10⁻⁴ K⁻¹)." The construction opens the workbench, which starts at its defaults, so
 * the reference to the preset is honest only while the preset and the defaults agree. Every number
 * the construction prints is recomputed here through the owners.
 */

type Preset = { presetId: string; parameterValues: Record<string, number | boolean> };
const manifest = loadYaml(
  readFileSync(join(process.cwd(), "content/experiments/lq-04.yaml"), "utf8"),
) as { id: string; presets: Preset[] };
const modern = getConstantSet("modern-si-2019");
const h = constantValue(modern, "planckConstant").value;
const c = constantValue(modern, "speedOfLight").value;
const k = thermalConstant(modern).value;
const { frequencyTHz, temperatureK } = ENTROPY_TEMPERATURE_CHECK;
const nu = frequencyTHz * 1e12;

describe("the reference is to a preset that exists, and the workbench opens at it", () => {
  const preset = manifest.presets.find((p) => p.presetId === ENTROPY_TEMPERATURE_CHECK.presetId);

  test("the preset is declared in LQ-04's manifest", () => {
    expect(manifest.id).toBe(ENTROPY_TEMPERATURE_CHECK.instrumentId);
    expect(preset).toBeDefined();
  });

  test("every value the preset sets is the workbench's default", () => {
    const values = preset?.parameterValues ?? {};
    expect(Object.keys(values).length).toBeGreaterThan(0);
    for (const [name, value] of Object.entries(values)) {
      const fallback = (LQ04_DEFAULTS as Record<string, unknown>)[name];
      if (typeof value !== "number" || typeof fallback !== "number" || value === fallback) {
        expect(value, name).toBe(fallback);
        continue;
      }
      // The manifest writes the default dilute threshold, ln 100 = 4.605170..., as 4.6052. Where
      // the two differ, the default must round to the manifest's number at the digits the
      // manifest prints, and those must be at least four.
      const digits = String(value)
        .replace(/^0\.0*|\.|e.*$/g, "")
        .replace(/0+$/, "").length;
      expect(digits, name).toBeGreaterThanOrEqual(4);
      expect(roundsTo(fallback, value, { significantFigures: digits }).ok, name).toBe(true);
    }
  });

  test("the construction prints the preset's own state", () => {
    expect(preset?.parameterValues.frequency).toBe(nu);
    expect(preset?.parameterValues.referenceTemperature).toBe(temperatureK);
    expect(preset?.parameterValues.volumeRatio).toBe(1);
  });

  test("at that state the workbench recovers 3000 K at both ends, as the construction says", () => {
    const result = evaluateLq04(LQ04_DEFAULTS) as {
      status: string;
      initialTemperature?: number;
      finalTemperature?: number;
    };
    expect(result.status).toBe("value");
    expect(roundsTo(result.initialTemperature ?? 0, 3000, { significantFigures: 4 }).ok).toBe(true);
    expect(roundsTo(result.finalTemperature ?? 0, 3000, { significantFigures: 4 }).ok).toBe(true);
  });
});

describe("the numbers the construction prints", () => {
  test("1/T at 3000 K is 3.333 × 10⁻⁴ per kelvin", () => {
    expect(roundsTo(1 / temperatureK, 3.333e-4, { significantFigures: 4 }).ok).toBe(true);
  });

  test("βν = hν/k is about 28 800 K, and βν/T about 9.60, inside Wien's dilute range", () => {
    const betaNu = (h * nu) / k;
    expect(roundsTo(betaNu, 28_800, { significantFigures: 3 }).ok).toBe(true);
    expect(roundsTo(betaNu / temperatureK, 9.6, { significantFigures: 3 }).ok).toBe(true);
    expect(betaNu / temperatureK).toBeGreaterThan(LQ04_DEFAULTS.diluteThresholdX);
  });

  test("the owner's entropy density has slope 1/T at Wien's density, as the check derives", () => {
    const A = (8 * Math.PI * h) / c ** 3;
    const B = h / k;
    const rho = A * nu ** 3 * Math.exp((-B * nu) / temperatureK);
    const s = (r: number) => {
      const out = wienSpectralEntropyDensity(r, nu, modern);
      if (out.status !== "value") throw new TypeError(out.status);
      return out.value;
    };
    const step = rho * 1e-6;
    const slope = (s(rho + step) - s(rho - step)) / (2 * step);
    expect(withinTolerance(slope, 1 / temperatureK, { relative: 1e-6 }).ok).toBe(true);
  });
});
