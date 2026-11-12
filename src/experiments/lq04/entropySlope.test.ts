import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { loadQuantityRegistry } from "../../content/quantities/registry.ts";
import {
  compareWienEntropySlope,
  wienSpectralEntropyDensity,
} from "../../physics/reference/radiation.ts";
import { LQ04_WORKBENCH_OWNER } from "../../testing/scenario-registry/coreNumericOwners.ts";
import { registryExponents, unitDimension } from "../../units/outputUnitDimension.ts";
import { type ToleranceSpec, withinTolerance } from "../../units/tolerance.ts";
import type { AcceptedSnapshot } from "../store/instanceStore.ts";
import {
  LQ04_DEFAULTS,
  LQ04_ENTROPY_SLOPE_COMPARISON,
  LQ04_OUTPUTS,
} from "./definition.ts";
import { buildLq04Snapshot, evaluateLq04 } from "./session.ts";

function scalar(snapshot: AcceptedSnapshot, id: string): number {
  const output = snapshot.outputs.find((entry) => entry.quantityId === id);
  assert.ok(output?.status === "value" && typeof output.value === "number", id);
  return output.value;
}

test("accepted entropy slopes track each endpoint's own temperature and actual probe spacing", () => {
  for (const parameters of [
    LQ04_DEFAULTS,
    { ...LQ04_DEFAULTS, volumeRatio: 0.5 },
    { ...LQ04_DEFAULTS, volumeRatio: 2 },
    { ...LQ04_DEFAULTS, volumeRatio: 0.01 },
    { ...LQ04_DEFAULTS, referenceTemperature: 2500, volumeRatio: 2 },
    { ...LQ04_DEFAULTS, frequency: 9e14, volumeRatio: 0.5 },
  ]) {
    const evaluation = evaluateLq04(parameters);
    assert.equal(evaluation.status, "value");
    if (evaluation.status !== "value") return;
    const snapshot = buildLq04Snapshot("entropy-slope", "accepted", parameters);
    for (const state of ["initial", "final"] as const) {
      const slope = scalar(snapshot, `${state}EntropyDensitySlope`);
      const inverseTemperature = scalar(snapshot, `${state}InverseTemperature`);
      const temperature = scalar(snapshot, `${state}Temperature`);
      const halfSpacing = scalar(snapshot, `${state}EntropySlopeDensityStep`);
      const volume = state === "initial" ? parameters.referenceVolume : evaluation.volume;
      const density = evaluation.energy / (volume * parameters.bandwidth);
      expect(
        withinTolerance(slope, 1 / temperature, {
          relative: LQ04_ENTROPY_SLOPE_COMPARISON.relativeTolerance,
        }).ok,
      ).toBe(true);
      expect(inverseTemperature).toBe(1 / temperature);
      expect(
        withinTolerance(
          halfSpacing,
          density * LQ04_ENTROPY_SLOPE_COMPARISON.relativeDensityStep,
          { relative: 1e-9 },
        ).ok,
      ).toBe(true);
      const discrepancy = scalar(snapshot, `${state}EntropySlopeRelativeDiscrepancy`);
      expect(discrepancy).toBeGreaterThanOrEqual(0);
      expect(discrepancy).toBeLessThanOrEqual(LQ04_ENTROPY_SLOPE_COMPARISON.relativeTolerance);
    }
    if (parameters.volumeRatio !== 1)
      expect(scalar(snapshot, "initialEntropyDensitySlope")).not.toBe(
        scalar(snapshot, "finalEntropyDensitySlope"),
      );
  }
});

test("the witness comes from entropy probes: a deliberately coarse secant fails the same tolerance", () => {
  const coefficients = { A: 1, B: 1 };
  const rho = Math.exp(-5);
  const options = { ...LQ04_ENTROPY_SLOPE_COMPARISON, epsilonW: 0.01 };
  const fine = compareWienEntropySlope(rho, 1, coefficients, options);
  assert.equal(fine.status, "value");
  if (fine.status !== "value") return;
  expect(withinTolerance(fine.slope, 5, { relative: 1e-8 }).ok).toBe(true);
  // Both coarse probes remain in the selected dilute regime. This fails numerically, so
  // replacing the secant with the temperature's reciprocal would make the regression fail.
  const coarse = compareWienEntropySlope(rho, 1, coefficients, {
    ...options,
    relativeDensityStep: 0.2,
  });
  expect(coarse).toMatchObject({
    status: "outside-domain",
    domainKind: "numerical",
    condition: "entropy-slope-comparison-unresolved",
  });
  const coarseWithLooseTolerance = compareWienEntropySlope(rho, 1, coefficients, {
    ...options,
    relativeDensityStep: 0.2,
    relativeTolerance: 0.01,
  });
  assert.equal(coarseWithLooseTolerance.status, "value");
  if (coarseWithLooseTolerance.status !== "value") return;
  expect(coarseWithLooseTolerance.slope).toBeGreaterThan(fine.slope);
  expect(coarseWithLooseTolerance.relativeDiscrepancy).toBeGreaterThan(0.001);
});

test("a valid central volume result survives a density probe crossing the chosen Wien boundary", () => {
  const parameters = { ...LQ04_DEFAULTS, diluteThresholdX: 9.59845, volumeRatio: 2 };
  const evaluation = evaluateLq04(parameters);
  assert.equal(evaluation.status, "value");
  if (evaluation.status !== "value") return;
  expect(evaluation.initialEntropySlopeComparison).toMatchObject({
    status: "outside-domain",
    domainKind: "model",
    condition: "entropy-slope-probe-outside-wien-domain",
  });
  expect(evaluation.finalEntropySlopeComparison.status).toBe("value");
  const snapshot = buildLq04Snapshot("entropy-slope-boundary", "accepted", parameters);
  expect(scalar(snapshot, "radiationEntropy")).toBeGreaterThan(0);
  expect(scalar(snapshot, "finalEntropyDensitySlope")).toBeGreaterThan(0);
  for (const output of snapshot.outputs.filter((entry) =>
    entry.quantityId.startsWith("initialEntropy"),
  )) {
    expect(output.status).toBe("outside-domain");
    expect("value" in output).toBe(false);
  }
});

test("subnormal entropy probes are explicitly unavailable while finite volume entropy remains accepted", () => {
  const parameters = {
    ...LQ04_DEFAULTS,
    frequency: 1e16,
    referenceTemperature: 700,
    volumeRatio: 2,
  };
  const evaluation = evaluateLq04(parameters);
  assert.equal(evaluation.status, "value");
  if (evaluation.status !== "value") return;
  expect(evaluation.initialSpectralEntropyDensity).toBeGreaterThan(0);
  expect(evaluation.initialSpectralEntropyDensity).toBeLessThan(2 ** -1022);
  expect(evaluation.initialEntropySlopeComparison).toMatchObject({
    status: "outside-domain",
    domainKind: "numerical",
    condition: "entropy-slope-probes-unresolved",
  });
  const snapshot = buildLq04Snapshot("entropy-slope-subnormal", "accepted", parameters);
  expect(Number.isFinite(scalar(snapshot, "radiationEntropy"))).toBe(true);
  expect(scalar(snapshot, "radiationEntropy")).toBeGreaterThan(0);
  for (const output of snapshot.outputs)
    if (output.status === "value" && typeof output.value === "number")
      expect(Number.isFinite(output.value)).toBe(true);
});

test("zero density's analytic entropy limit does not supply a finite derivative witness", () => {
  const coefficients = { A: 1, B: 1 };
  expect(wienSpectralEntropyDensity(0, 1, coefficients).status).toBe("analytic-limit");
  for (const rho of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
    expect(
      compareWienEntropySlope(rho, 1, coefficients, {
        ...LQ04_ENTROPY_SLOPE_COMPARISON,
        epsilonW: 0.01,
      }).status,
    ).toBe("outside-domain");
  expect(
    compareWienEntropySlope(Math.exp(-5), 1, coefficients, {
      ...LQ04_ENTROPY_SLOPE_COMPARISON,
      epsilonW: 0.01,
      relativeDensityStep: Number.EPSILON / 4,
    }),
  ).toMatchObject({
    status: "outside-domain",
    domainKind: "numerical",
    condition: "entropy-slope-probes-not-representable",
  });
});

test("new endpoint outputs bind canonical physical quantities with matching units", () => {
  const registry = loadQuantityRegistry();
  const manifest = load(
    readFileSync(new URL("../../../content/experiments/lq-04.yaml", import.meta.url), "utf8"),
  ) as {
    outputs: { id: string; quantityId: string; allowedStatuses: string[] }[];
  };
  for (const state of ["initial", "final"] as const)
    for (const [suffix, canonical] of [
      ["EntropyDensitySlope", "spectralEntropyDensitySlope"],
      ["InverseTemperature", "inverseTemperature"],
      ["EntropySlopeDensityStep", "frequencyEnergyDensity"],
      ["EntropySlopeRelativeDiscrepancy", "entropySlopeRelativeDiscrepancy"],
    ] as const) {
      const outputId = `${state}${suffix}`;
      const binding = manifest.outputs.find((entry) => entry.id === outputId);
      expect(binding?.quantityId).toBe(canonical);
      expect(binding?.allowedStatuses).toContain("outside-domain");
      const contract = LQ04_OUTPUTS[outputId];
      assert.ok(contract);
      const quantity = registry.quantities.get(canonical);
      assert.ok(quantity?.dimension);
      const unit = unitDimension(contract.unit);
      assert.equal(unit.kind, "dimension");
      if (unit.kind === "dimension")
        expect(unit.exponents).toEqual(registryExponents(quantity.dimension));
    }
});

test("the registered derived-temperature preset exercises the actual accepted derivative owner", () => {
  const scenario = load(
    readFileSync(
      new URL("../../../content/scenarios/lq-04-derived-temperature.yaml", import.meta.url),
      "utf8",
    ),
  ) as {
    constantSetId: string;
    inputs: Record<string, { value: number }>;
    expected: { outputs: { outputId: string; value: number; tolerance: ToleranceSpec }[] };
  };
  const actual = LQ04_WORKBENCH_OWNER.fn({
    inputs: Object.fromEntries(
      Object.entries(scenario.inputs).map(([id, input]) => [id, input.value]),
    ),
    constantSetId: scenario.constantSetId,
  });
  assert.ok(!("refused" in actual));
  if ("refused" in actual) return;
  const expectedIds = scenario.expected.outputs.map((entry) => entry.outputId);
  for (const state of ["initial", "final"] as const) {
    expect(expectedIds).toContain(`${state}EntropyDensitySlope`);
    expect(expectedIds).toContain(`${state}InverseTemperature`);
    expect(expectedIds).toContain(`${state}EntropySlopeDensityStep`);
    expect(expectedIds).toContain(`${state}EntropySlopeRelativeDiscrepancy`);
  }
  for (const expected of scenario.expected.outputs) {
    const value = actual[expected.outputId];
    assert.equal(typeof value, "number", expected.outputId);
    expect(
      withinTolerance(value as number, expected.value, expected.tolerance).ok,
      expected.outputId,
    ).toBe(true);
  }
});
