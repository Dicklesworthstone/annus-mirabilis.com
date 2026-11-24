import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import type { ComparisonSnapshot } from "../compare/Baseline.ts";
import labDigests from "../../generated/lab-source-digests.json";
import { LQ03_DEFAULTS, type Lq03Parameters } from "./definition.ts";
import { createLq03Session, evaluateLq03Spectrum } from "./session.ts";
import {
  createTemperatureComparison,
  LQ03_TEMPERATURE_COMPARISON,
  temperatureComparisonSpectra,
} from "./temperatureComparison.ts";

function fixture(parameters: Lq03Parameters = LQ03_DEFAULTS) {
  const main = createLq03Session("temperature-main", parameters);
  const accepted = main.getSnapshot().accepted;
  assert.ok(accepted);
  const comparison = createTemperatureComparison(
    "temperature-comparison",
    accepted,
    labDigests["lq-03"],
  );
  comparison.connect();
  expect(comparison.start()).toBe(true);
  return { main, comparison };
}

function value(snapshot: ComparisonSnapshot, id: string): number {
  const output = snapshot.outputs.find((entry) => entry.quantityId === id);
  assert.ok(output && output.status === "value" && typeof output.value === "number");
  return output.value;
}

function close(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-12 * Math.max(Math.abs(expected), 1e-300));
}

describe("temperature-only spectrum comparison", () => {
  test("a new temperature branches the variant and keeps the accepted baseline and all other inputs", () => {
    const { main, comparison } = fixture();
    const before = comparison.getSnapshot();
    const baselineJSON = JSON.stringify(before.baseline);
    const mainBefore = main.getSnapshot();
    expect(comparison.apply({ ...before.baseline.parameters, T: 7500 })).toBe(true);
    const after = comparison.getSnapshot();
    expect(after.baseline).toBe(before.baseline);
    expect(JSON.stringify(after.baseline)).toBe(baselineJSON);
    expect(after.variant.runId).not.toBe(before.baseline.runId);
    expect(after.variant.acceptedInputRevision).toBeGreaterThan(before.baseline.acceptedInputRevision);
    expect(after.result.kind).toBe("accepted");
    if (after.result.kind === "accepted") expect(after.result.variation.changedInput).toBe("T");
    for (const key of Object.keys(LQ03_TEMPERATURE_COMPARISON.inputs)) {
      if (key !== "T") expect(after.variant.parameters[key]).toBe(after.baseline.parameters[key]);
    }
    expect(main.getSnapshot()).toBe(mainBefore);
    close(
      value(after.variantSnapshot, "peakFrequency") / value(after.baselineSnapshot, "peakFrequency"),
      1.5,
    );
    close(
      value(after.variantSnapshot, "peakWavelength") /
        value(after.baselineSnapshot, "peakWavelength"),
      1 / 1.5,
    );
    expect(value(after.variantSnapshot, "bandEnergy")).toBeGreaterThan(
      value(after.baselineSnapshot, "bandEnergy"),
    );
    comparison.disconnect();
    main.disconnect();
  });

  test("continued exploration of the main apparatus cannot replace the pinned comparison", () => {
    const { main, comparison } = fixture();
    const held = comparison.getSnapshot();
    expect(main.apply({ ...LQ03_DEFAULTS, T: 8000, nu1: 1e14, probeNu: 2e14 }).kind).toBe("accepted");
    expect(comparison.getSnapshot()).toBe(held);
    expect(held.baseline.parameters.nu1).toBe(LQ03_DEFAULTS.nu1);
    expect(held.baseline.parameters.probeNu).toBe(LQ03_DEFAULTS.probeNu);
    comparison.disconnect();
    main.disconnect();
  });

  test("band, probe, tolerance, calibration and saved display settings are enforced below the UI", () => {
    const { main, comparison } = fixture();
    const baseline = comparison.getSnapshot().baseline;
    const changes = {
      nu1: 3e14,
      nu2: 7e14,
      probeNu: 5e14,
      epsilon: 0.02,
      constantSetId: "einstein-1905-light-quanta-printed",
      coordinate: "wavelength",
      convention: "per-m",
      axisScale: "linear",
      showPlanck: false,
      showWien: false,
      showClassical: false,
    };
    for (const [key, changed] of Object.entries(changes)) {
      const accepted = comparison.getSnapshot().variant;
      expect(comparison.apply({ ...baseline.parameters, [key]: changed })).toBe(false);
      expect(comparison.getSnapshot().variant).toBe(accepted);
      expect(comparison.getSnapshot().error).toContain("held fixed");
    }
    expect(comparison.apply({ ...baseline.parameters, T: 7500, nu1: 3e14 })).toBe(false);
    expect(comparison.getSnapshot().error).toContain("one input");
    comparison.disconnect();
    main.disconnect();
  });

  test("out-of-domain temperature preserves the last completed pair and its typed refusal", () => {
    const { main, comparison } = fixture();
    expect(comparison.apply({ ...comparison.getSnapshot().baseline.parameters, T: 7500 })).toBe(true);
    const accepted = comparison.getSnapshot().variant;
    for (const T of [499, 10001]) {
      expect(comparison.apply({ ...comparison.getSnapshot().baseline.parameters, T })).toBe(false);
      const refused = comparison.getSnapshot();
      expect(refused.variant).toBe(accepted);
      expect(refused.failure?.kind).toBe("refused");
      expect(refused.error).toContain("500");
      expect(refused.variant.parameters.T).toBe(7500);
    }
    expect(comparison.apply({ ...comparison.getSnapshot().baseline.parameters, T: 6000 })).toBe(true);
    expect(comparison.getSnapshot().error).toBe("");
    comparison.disconnect();
    main.disconnect();
  });

  test("return and re-pin operate on completed results", () => {
    const { main, comparison } = fixture();
    const initial = comparison.getSnapshot().baseline;
    expect(comparison.apply({ ...initial.parameters, T: 10000 })).toBe(true);
    expect(comparison.pinCurrent()).toBe(true);
    expect(comparison.getSnapshot().baseline.parameters.T).toBe(10000);
    expect(comparison.apply({ ...comparison.getSnapshot().baseline.parameters, T: 5000 })).toBe(true);
    expect(comparison.getSnapshot().baseline.parameters.T).toBe(10000);
    close(
      value(comparison.getSnapshot().variantSnapshot, "bandEnergy"),
      value(main.getSnapshot().accepted as ComparisonSnapshot, "bandEnergy"),
    );
    expect(comparison.apply(comparison.getSnapshot().baseline.parameters)).toBe(true);
    if (comparison.getSnapshot().result.kind === "accepted") {
      expect(comparison.getSnapshot().variant.parameters.T).toBe(10000);
    }
    comparison.disconnect();
    main.disconnect();
  });

  test("the historical calibration remains explicit throughout the comparison", () => {
    const parameters = {
      ...LQ03_DEFAULTS,
      constantSetId: "einstein-1905-light-quanta-printed" as const,
    };
    const { main, comparison } = fixture(parameters);
    expect(comparison.apply({ ...comparison.getSnapshot().baseline.parameters, T: 7500 })).toBe(true);
    const state = comparison.getSnapshot();
    for (const entry of [state.baseline, state.variant]) {
      expect(entry.identity.constantSetId).toBe(parameters.constantSetId);
      expect(entry.parameters.constantSetId).toBe(parameters.constantSetId);
      expect(entry.identity.sourceDigest).toBe(labDigests["lq-03"]);
    }
    const independent = createLq03Session("historical-check", { ...parameters, T: 7500 });
    assert.ok(independent.getSnapshot().accepted);
    close(
      value(state.variantSnapshot, "bandEnergy"),
      value(independent.getSnapshot().accepted as ComparisonSnapshot, "bandEnergy"),
    );
    independent.disconnect();
    comparison.disconnect();
    main.disconnect();
  });

  test("an underflowed probe keeps its nonnumeric evidence instead of becoming zero or a logarithm", () => {
    const { main, comparison } = fixture({ ...LQ03_DEFAULTS, T: 500, probeNu: 1e16 });
    const density = comparison.getSnapshot().baseline.outputs.frequencyEnergyDensity;
    expect(density?.status).toBe("outside-domain");
    expect(density?.value).toBeNull();
    expect(density?.evidence?.status).toBe("outside-domain");
    expect(comparison.apply({ ...comparison.getSnapshot().baseline.parameters, T: 1000 })).toBe(true);
    const result = comparison.getSnapshot().result;
    assert.equal(result.kind, "accepted");
    const row = result.rows.find((entry) => entry.id === "frequencyEnergyDensity");
    expect(row?.ratio.status).toBe("not-applicable");
    comparison.disconnect();
    main.disconnect();
  });

  test("missing, misowned and incomplete accepted evidence cannot be pinned", () => {
    const main = createLq03Session("bad-source");
    const source = main.getSnapshot().accepted;
    assert.ok(source);
    for (const malformed of [
      { ...source, final: false },
      { ...source, experimentId: "lq-08" },
      { ...source, outputs: source.outputs.filter((output) => output.quantityId !== "bandEnergy") },
      {
        ...source,
        outputs: source.outputs.map((output) =>
          output.quantityId === "bandEnergy" ? { ...output, ownerId: "other.owner" } : output,
        ),
      },
    ]) {
      expect(() =>
        createTemperatureComparison("refused", malformed, labDigests["lq-03"]),
      ).toThrow();
    }
    expect(() => createTemperatureComparison("refused", source, "unidentified")).toThrow(
      "identified source",
    );
    main.disconnect();
  });
});

describe("common-axis spectrum projection", () => {
  test("both coordinates and both axis scales use shared bounds while retaining owner samples", () => {
    const baseline = { ...LQ03_DEFAULTS, T: 500 };
    const variant = { ...LQ03_DEFAULTS, T: 10000 };
    for (const coordinate of ["frequency", "wavelength"] as const) {
      for (const axisScale of ["linear", "logarithmic"] as const) {
        const pair = temperatureComparisonSpectra(baseline, variant, coordinate, axisScale);
        expect(pair.baseline.xRange).toEqual(pair.variant.xRange);
        expect(pair.baseline.yRange).toEqual(pair.variant.yRange);
        expect(pair.baseline.xLinearTicks).toEqual(pair.variant.xLinearTicks);
        expect(pair.baseline.yDecades).toEqual(pair.variant.yDecades);
        expect(pair.baseline.bandLog10X).toEqual(pair.variant.bandLog10X);
        expect(pair.baseline.probeLog10X).toBe(pair.variant.probeLog10X);
        for (const [parameters, spectrum] of [
          [baseline, pair.baseline],
          [variant, pair.variant],
        ] as const) {
          const original = evaluateLq03Spectrum({
            ...parameters,
            coordinate,
            axisScale,
            convention: coordinate === "frequency" ? "per-hz" : "per-m",
          });
          expect(spectrum.points).toEqual(original.points);
          expect(spectrum.peak).toEqual(original.peak);
          assert.ok(spectrum.peak);
          expect(10 ** spectrum.peak.log10X).toBeGreaterThanOrEqual(spectrum.xRange[0]);
          expect(10 ** spectrum.peak.log10X).toBeLessThanOrEqual(spectrum.xRange[1]);
        }
      }
    }
  });

  test("changing density representation preserves accepted energies and does not equate the two peaks", () => {
    const { main, comparison } = fixture();
    comparison.apply({ ...comparison.getSnapshot().baseline.parameters, T: 7500 });
    const before = comparison.getSnapshot();
    const a = before.baseline.parameters as Lq03Parameters;
    const b = before.variant.parameters as Lq03Parameters;
    const frequency = temperatureComparisonSpectra(a, b, "frequency", "logarithmic");
    const wavelength = temperatureComparisonSpectra(a, b, "wavelength", "logarithmic");
    expect(comparison.getSnapshot()).toBe(before);
    assert.ok(frequency.baseline.peak && wavelength.baseline.peak);
    const nuPeak = 10 ** frequency.baseline.peak.log10X;
    const cOverLambdaPeak = 299792458 / 10 ** wavelength.baseline.peak.log10X;
    expect(Math.abs(cOverLambdaPeak / nuPeak - 1)).toBeGreaterThan(0.5);
    const originalBand = value(before.baselineSnapshot, "bandEnergy");
    expect(value(comparison.getSnapshot().baselineSnapshot, "bandEnergy")).toBe(originalBand);
    comparison.disconnect();
    main.disconnect();
  });
});
