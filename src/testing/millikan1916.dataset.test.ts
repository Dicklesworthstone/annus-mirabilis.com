import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "../content/provenance/yaml.ts";
import { validateHistoricalDataset } from "../content/schemas/experiment.ts";
import {
  fitMillikanSodiumData,
  getOwnerTheoreticalLine,
  MILLIKAN_1916_SODIUM_POINTS,
} from "../experiments/lq08/millikan.ts";
import { getConstantSet } from "../physics/reference/constants.ts";

describe("Millikan 1916 Sodium Historical Dataset (am-lq-08-photoelectric-va5a)", () => {
  const datasetPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../content/datasets/millikan-1916-sodium.yaml",
  );
  const rawText = readFileSync(datasetPath, "utf-8");
  const rawYaml = parseYaml(rawText);

  it("validates strictly against the canonical HistoricalDataset schema", () => {
    const dataset = validateHistoricalDataset(rawYaml, "millikan-1916-sodium");
    expect(dataset.id).toBe("millikan-1916-sodium");
    expect(dataset.evidenceStatus).toBe("historical-measurement");
    expect(dataset.publications.length).toBeGreaterThan(0);
    expect(dataset.columns.length).toBe(3);
    expect(dataset.rows.length).toBe(6);
  });

  it("fits Millikan sodium stopping potentials via OLS to yield h/e close to 4.13e-15 V s", () => {
    const fit = fitMillikanSodiumData(MILLIKAN_1916_SODIUM_POINTS);
    expect(fit.sampleCount).toBe(6);
    // Slope ≈ 4.126e-15 V s
    expect(fit.slope).toBeGreaterThan(4.0e-15);
    expect(fit.slope).toBeLessThan(4.3e-15);
    // Extremely high linear correlation R^2 > 0.99
    expect(fit.rSquared).toBeGreaterThan(0.99);
    expect(fit.slopeStandardError).toBeGreaterThan(0);
  });

  it("enforces epistemic separation: theoretical model line slope is strictly owner-derived, never fit-derived", () => {
    const set = getConstantSet("modern-si-2019");
    const theoreticalLine = getOwnerTheoreticalLine(2.2, set);

    expect(theoreticalLine.source).toBe("owner");
    // Theoretical h/e = 6.62607015e-34 / 1.602176634e-19 ≈ 4.135667697e-15 V s
    expect(theoreticalLine.slope).toBeCloseTo(4.135667697e-15, 20);

    const fit = fitMillikanSodiumData(MILLIKAN_1916_SODIUM_POINTS);
    // Empirical slope and theoretical slope are close but distinct floating-point numbers
    expect(theoreticalLine.slope).not.toBe(fit.slope);
    expect(Math.abs(theoreticalLine.slope - fit.slope)).toBeLessThan(1e-16);
    expect(Math.abs(theoreticalLine.slope - fit.slope)).toBeGreaterThan(0);
  });
});
