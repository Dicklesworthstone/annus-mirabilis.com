import { afterEach, describe, expect, test } from "bun:test";
import type { Baseline, ComparisonValue } from "../compare/Baseline.ts";
import {
  lq08ComparisonIdentity,
  lq08ComparisonParameters,
  verifyLq08Comparison,
  verifyLq08SavedComparison,
} from "./comparison.ts";
import { createLq08ComparisonSession } from "./comparisonSession.ts";
import { LQ08_DEFAULTS, type Lq08Parameters } from "./definition.ts";

const SOURCE = Object.freeze({ sourceDigest: "source:sha256:" + "a".repeat(64) });
const ELEMENTARY_CHARGE = 1.602176634e-19;
const PLANCK_CONSTANT = 6.62607015e-34;
type Comparison = ReturnType<typeof createLq08ComparisonSession>;
const active: Comparison[] = [];

afterEach(() => {
  for (const comparison of active.splice(0)) comparison.disconnect();
});

function live(parameters: Lq08Parameters = LQ08_DEFAULTS): Comparison {
  const comparison = createLq08ComparisonSession("photoelectric-comparison", parameters, SOURCE);
  active.push(comparison);
  comparison.connect();
  expect(comparison.start()).toBe(true);
  expect(comparison.getSnapshot().phase).toBe("live");
  expect(comparison.getSnapshot().pending).toBe(false);
  return comparison;
}

function row(comparison: Comparison, id: string) {
  const result = comparison.getSnapshot().result;
  if (result.kind !== "accepted") throw new Error("Expected a completed comparison.");
  const found = result.rows.find((item) => item.id === id);
  if (!found) throw new Error("Missing comparison row: " + id);
  return found;
}

function numeric(output: ComparisonValue | undefined): number {
  if (output?.status !== "value" || output.value === null)
    throw new Error("Expected the owner's numeric result.");
  return output.value;
}

describe("photoelectric controlled comparisons retain the physical distinctions", () => {
  test("doubling power doubles rates and current, with identical per-electron energy", () => {
    const comparison = live();
    const baseline = comparison.getSnapshot().baseline;
    expect(comparison.apply({ ...LQ08_DEFAULTS, incidentPower: 0.002 })).toBe(true);
    const state = comparison.getSnapshot();
    expect(state.baseline).toBe(baseline);
    expect(state.variant.runId).not.toBe(baseline.runId);
    expect(state.variant.parameters.frequency).toBe(baseline.parameters.frequency);
    for (const id of ["quantumRate", "emissionRate", "photocurrent"]) {
      const output = row(comparison, id);
      expect(numeric(output.variant)).toBe(2 * numeric(output.baseline));
      expect(output.ratio).toEqual({ status: "value", value: 2 });
    }
    for (const id of [
      "quantumEnergy",
      "thresholdFrequency",
      "maxKineticEnergy",
      "stoppingPotentialMagnitude",
    ]) {
      const output = row(comparison, id);
      expect(numeric(output.variant)).toBe(numeric(output.baseline));
      expect(output.difference).toEqual({ status: "value", value: 0 });
    }
  });

  test("higher frequency at fixed power raises electron energy while fewer quanta arrive", () => {
    const comparison = live();
    expect(comparison.apply({ ...LQ08_DEFAULTS, frequency: 8e14 })).toBe(true);
    for (const id of ["quantumRate", "emissionRate", "photocurrent"]) {
      const output = row(comparison, id);
      expect(numeric(output.variant) / numeric(output.baseline)).toBeCloseTo(0.75, 12);
    }
    const energy = row(comparison, "maxKineticEnergy");
    const stopping = row(comparison, "stoppingPotentialMagnitude");
    expect((numeric(energy.variant) - numeric(energy.baseline)) / ELEMENTARY_CHARGE).toBeCloseTo(
      0.827133539384772,
      12,
    );
    expect(numeric(stopping.variant) - numeric(stopping.baseline)).toBeCloseTo(
      0.827133539384772,
      12,
    );
    const threshold = row(comparison, "thresholdFrequency");
    expect(numeric(threshold.variant)).toBe(numeric(threshold.baseline));
  });

  test("hypothetical escape work shifts stopping potential at fixed quantum energy", () => {
    const comparison = live();
    expect(comparison.apply({ ...LQ08_DEFAULTS, workFunction: 2.4 })).toBe(true);
    const stopping = row(comparison, "stoppingPotentialMagnitude");
    expect(numeric(stopping.variant) - numeric(stopping.baseline)).toBeCloseTo(-0.2, 12);
    const threshold = row(comparison, "thresholdFrequency");
    expect(numeric(threshold.variant)).toBeGreaterThan(numeric(threshold.baseline));
    for (const id of ["quantumEnergy", "quantumRate", "emissionRate", "photocurrent"]) {
      const output = row(comparison, id);
      expect(numeric(output.variant)).toBe(numeric(output.baseline));
    }
  });

  test("below threshold has no electron energy or stopping potential, but zero emission", () => {
    const comparison = live();
    expect(comparison.apply({ ...LQ08_DEFAULTS, frequency: 4.5e14 })).toBe(true);
    for (const id of ["maxKineticEnergy", "stoppingPotentialMagnitude"]) {
      const output = row(comparison, id);
      expect(output.variant.status).toBe("not-applicable");
      expect(output.variant.value).toBeNull();
      expect(output.variant.reason).toContain("no emitted electron");
      expect(output.ratio.status).toBe("not-applicable");
      expect(output.difference.status).toBe("not-applicable");
    }
    for (const id of ["emissionRate", "photocurrent"])
      expect(numeric(row(comparison, id).variant)).toBe(0);
    expect(numeric(row(comparison, "quantumRate").variant)).toBeGreaterThan(0);
  });

  test("the exact threshold is numeric zero, and ratios to that zero remain undefined", () => {
    const parameters = {
      ...LQ08_DEFAULTS,
      workFunction: (PLANCK_CONSTANT * LQ08_DEFAULTS.frequency) / ELEMENTARY_CHARGE,
    };
    // This fixture reaches the reference owner's exact equality branch, not a rounded display.
    expect(parameters.workFunction * ELEMENTARY_CHARGE).toBe(
      PLANCK_CONSTANT * parameters.frequency,
    );
    const comparison = live(parameters);
    for (const id of ["maxKineticEnergy", "stoppingPotentialMagnitude"]) {
      const output = row(comparison, id);
      expect(numeric(output.baseline)).toBe(0);
      expect(numeric(output.variant)).toBe(0);
      expect(output.difference).toEqual({ status: "value", value: 0 });
      expect(output.ratio.status).toBe("not-applicable");
    }
    expect(comparison.apply({ ...parameters, frequency: 8e14 })).toBe(true);
    for (const id of ["maxKineticEnergy", "stoppingPotentialMagnitude"]) {
      const output = row(comparison, id);
      expect(numeric(output.variant)).toBeGreaterThan(0);
      expect(output.ratio.status).toBe("not-applicable");
      if (output.ratio.status !== "not-applicable") throw new Error("Expected no zero ratio.");
      expect(output.ratio.reason).toContain("baseline is zero");
    }
  });

  test("zero lamp power has zero rates, without erasing the conditional energy limit", () => {
    const parameters = { ...LQ08_DEFAULTS, incidentPower: 0 };
    const comparison = live(parameters);
    expect(comparison.apply(LQ08_DEFAULTS)).toBe(true);
    for (const id of ["quantumRate", "emissionRate", "photocurrent"]) {
      const output = row(comparison, id);
      expect(numeric(output.baseline)).toBe(0);
      expect(numeric(output.variant)).toBeGreaterThan(0);
      expect(output.ratio.status).toBe("not-applicable");
      expect(output.difference.status).toBe("value");
    }
    for (const id of ["quantumEnergy", "maxKineticEnergy", "stoppingPotentialMagnitude"]) {
      const output = row(comparison, id);
      expect(numeric(output.baseline)).toBeGreaterThan(0);
      expect(numeric(output.variant)).toBe(numeric(output.baseline));
    }
  });

  test("an undeclared electron distribution cannot become a numeric retarding current", () => {
    const parameters = { ...LQ08_DEFAULTS, collectorPotential: -0.1 };
    const comparison = live(parameters);
    expect(comparison.apply({ ...parameters, incidentPower: 0.002 })).toBe(true);
    const output = row(comparison, "photocurrent");
    for (const evidence of [output.baseline, output.variant]) {
      expect(evidence.status).toBe("underdetermined");
      expect(evidence.value).toBeNull();
      expect(evidence.evidence?.status).toBe("underdetermined");
      if (evidence.evidence?.status !== "underdetermined")
        throw new Error("Missing the owner's underdetermination evidence.");
      expect(evidence.evidence.neededInformation).toContain(
        "electron-energy-distribution-in-emitter",
      );
      expect(evidence.evidence.neededInformation).toContain("collector-geometry");
    }
    expect(output.ratio.status).toBe("not-applicable");
    expect(output.difference.status).toBe("not-applicable");

    const stopped = live({ ...LQ08_DEFAULTS, collectorPotential: -1 });
    expect(numeric(row(stopped, "photocurrent").variant)).toBe(0);
    expect(numeric(row(stopped, "emissionRate").variant)).toBeGreaterThan(0);
  });

  test("two changed inputs and held apparatus settings preserve the completed result", () => {
    const comparison = live();
    const before = comparison.getSnapshot();
    for (const parameters of [
      { ...LQ08_DEFAULTS, incidentPower: 0.002, frequency: 8e14 },
      { ...LQ08_DEFAULTS, quantumEfficiency: 0.2 },
      { ...LQ08_DEFAULTS, collectorPotential: -0.1 },
      { ...LQ08_DEFAULTS, frequency: 1e20 },
    ]) {
      expect(comparison.apply(parameters)).toBe(false);
      expect(comparison.getSnapshot().baseline).toBe(before.baseline);
      expect(comparison.getSnapshot().variant).toBe(before.variant);
      expect(comparison.getSnapshot().error).not.toBe("");
      expect(comparison.getSnapshot().pending).toBe(false);
    }
  });

  test("an explicit new baseline permits a different single change without mixing the two", () => {
    const comparison = live();
    const brighter = { ...LQ08_DEFAULTS, incidentPower: 0.002 };
    expect(comparison.apply(brighter)).toBe(true);
    const brighterResult = comparison.getSnapshot().variant;
    expect(comparison.apply({ ...brighter, frequency: 8e14 })).toBe(false);
    expect(comparison.pinCurrent()).toBe(true);
    expect(comparison.getSnapshot().baseline).toBe(brighterResult);
    expect(comparison.apply({ ...brighter, frequency: 8e14 })).toBe(true);
    const result = comparison.getSnapshot().result;
    if (result.kind !== "accepted") throw new Error("Expected the newly pinned comparison.");
    expect(result.variation.changedInput).toBe("frequency");
    expect(comparison.getSnapshot().baseline.parameters.incidentPower).toBe(0.002);
    expect(comparison.getSnapshot().variant.parameters.incidentPower).toBe(0.002);
  });
  test(
    "photoelectric-comparison-evidence refuses false source and settings (comparison.ts:94)",
    () => {
      for (const sourceDigest of ["", "anonymous", "source:sha256:abc"]) {
        expect(() => lq08ComparisonIdentity({ sourceDigest })).toThrow("identified source");
      }
      for (const parameters of [
        { ...LQ08_DEFAULTS, frequency: 0 },
        { ...LQ08_DEFAULTS, incidentPower: -0.001 },
        { ...LQ08_DEFAULTS, workFunction: 7 },
      ]) {
        expect(() => lq08ComparisonParameters(parameters)).toThrow("valid, complete");
      }
    },
  );

  test("saved readouts cannot detach a numeric value from its scientific owner evidence", () => {
    const comparison = live();
    expect(comparison.apply({ ...LQ08_DEFAULTS, incidentPower: 0.002 })).toBe(true);
    const { baseline, variant, result } = comparison.getSnapshot();
    expect(verifyLq08SavedComparison(baseline, variant, result)).toBeNull();
    const original = variant.outputs.maxKineticEnergy;
    if (!original?.evidence) throw new Error("Missing the control's accepted evidence.");
    const { evidence: _evidence, ...withoutEvidence } = original;
    const corruptions: ComparisonValue[] = [
      { ...original, value: 3 * numeric(original) },
      { ...original, evidence: { ...original.evidence, ownerId: "another.scientific.owner" } },
      { ...original, evidence: { ...original.evidence, unit: "V" } },
      withoutEvidence,
    ];
    for (const corrupted of corruptions) {
      const altered: Baseline = {
        ...variant,
        outputs: { ...variant.outputs, maxKineticEnergy: corrupted },
      };
      expect(verifyLq08SavedComparison(baseline, altered, result)).not.toBeNull();
    }
  });

  test("accepted input evidence must identify the same settings as the live snapshot", () => {
    const comparison = live();
    expect(comparison.apply({ ...LQ08_DEFAULTS, frequency: 8e14 })).toBe(true);
    const state = comparison.getSnapshot();
    const corrupted = {
      ...state.variantSnapshot,
      outputs: state.variantSnapshot.outputs.map((output) =>
        output.quantityId === "frequency" ? { ...output, value: 7e14 } : output,
      ),
    };
    expect(verifyLq08Comparison(state.baselineSnapshot, corrupted, state.result)).not.toBeNull();
  });

});
