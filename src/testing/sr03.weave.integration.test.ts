import { describe, expect, test } from "bun:test";
import type { ScientificResult } from "../experiments/results/types.ts";
import {
  SR03_BUDGET,
  SR03_DEFAULTS,
  SR03_MODEL,
  SR03_OUTPUTS,
  SR03_PRESETS,
} from "../experiments/sr03/definition.ts";
import { withinTolerance } from "../units/tolerance.ts";
import { evaluateSr03 } from "../workers/operations/sr03.ts";

function requireOutputContract(id: string) {
  const contract = SR03_OUTPUTS[id];
  if (!contract) {
    throw new Error(`Missing output contract for "${id}" in SR03_OUTPUTS`);
  }
  return contract;
}

function getRequiredResult(outputs: readonly ScientificResult[], id: string): ScientificResult {
  const found = outputs.find((o) => o.quantityId === id);
  if (!found) {
    throw new Error(`Output quantity "${id}" was not emitted by the evaluator`);
  }
  return found;
}

function requireNumericValue(res: ScientificResult, id: string): number {
  if (res.quantityId !== id) {
    throw new Error(`Expected quantity "${id}", but received "${res.quantityId}"`);
  }
  if (res.status !== "value") {
    throw new Error(
      `Expected output "${id}" to have status "value", but got status "${res.status}"`,
    );
  }
  if (typeof res.value !== "number") {
    throw new Error(`Expected output "${id}" to have numeric value, but got ${typeof res.value}`);
  }
  return res.value;
}

function getNumericOutput(outputs: readonly ScientificResult[], id: string): number {
  const result = getRequiredResult(outputs, id);
  return requireNumericValue(result, id);
}

describe("sr03.weave.integration: Spec clauses and physical invariants (am-sr-03-rod-simultaneity-0l5i)", () => {
  test("model metadata and budget are defined and positive", () => {
    expect(SR03_MODEL.id).toBe("sr03-rod-simultaneity-v1");
    expect(SR03_MODEL.label).toBe("Rod measurement and simultaneity, host calculation");
    expect(SR03_BUDGET.workUnits).toBeGreaterThan(0);
    expect(SR03_BUDGET.allocationBytes).toBeGreaterThan(0);
  });

  test("SR-03 §2 clause: platform-simultaneous pair transforms to desynchronized readings in moving frame", async () => {
    const res = await evaluateSr03(SR03_PRESETS["sr-03-boost-0.6c"]?.parameters ?? SR03_DEFAULTS);
    expect(res.kind).toBe("accepted");
    if (res.kind !== "accepted") {
      throw new Error(`Expected evaluator to accept parameters, got ${res.kind}`);
    }

    const dtK = getNumericOutput(res.data.outputs, "temporalSeparationK");
    const dxK = getNumericOutput(res.data.outputs, "spatialSeparationK");
    const dtPrime = getNumericOutput(res.data.outputs, "temporalSeparationKPrime");
    const dxPrime = getNumericOutput(res.data.outputs, "spatialSeparationKPrime");

    expect(dtK).toBe(0);
    expect(dxK).toBe(10);
    expect(withinTolerance(dtPrime, -7.5, { absolute: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(dxPrime, 12.5, { absolute: 1e-12 }).ok).toBe(true);
  });

  test("SR-03 §4 clause: valid frame-simultaneous measurement yields contracted rod length L = 8 ls", async () => {
    const res = await evaluateSr03(
      SR03_PRESETS["sr-03-valid-pair-0.6c"]?.parameters ?? SR03_DEFAULTS,
    );
    expect(res.kind).toBe("accepted");
    if (res.kind !== "accepted") {
      throw new Error(`Expected evaluator to accept parameters, got ${res.kind}`);
    }

    const meas = getNumericOutput(res.data.outputs, "measuredLength");
    expect(withinTolerance(meas, 8.0, { absolute: 1e-12 }).ok).toBe(true);
  });

  test("SR-03 §4 clause: moving sphere of radius R contracts to ellipsoid (R/gamma, R, R)", async () => {
    const res = await evaluateSr03(SR03_PRESETS["sr-03-sphere-0.6c"]?.parameters ?? SR03_DEFAULTS);
    expect(res.kind).toBe("accepted");
    if (res.kind !== "accepted") {
      throw new Error(`Expected evaluator to accept parameters, got ${res.kind}`);
    }

    const longAxis = getNumericOutput(res.data.outputs, "ellipsoidAxisLongitudinal");
    const transY = getNumericOutput(res.data.outputs, "ellipsoidAxisTransverseY");
    const transZ = getNumericOutput(res.data.outputs, "ellipsoidAxisTransverseZ");

    expect(withinTolerance(longAxis, 0.8, { absolute: 1e-12 }).ok).toBe(true);
    expect(transY).toBe(1.0);
    expect(transZ).toBe(1.0);
  });

  test("SR-03 §2/§4 clause: timelike causal order invariant under boost", async () => {
    const res = await evaluateSr03(
      SR03_PRESETS["sr-03-causal-timelike"]?.parameters ?? SR03_DEFAULTS,
    );
    expect(res.kind).toBe("accepted");
    if (res.kind !== "accepted") {
      throw new Error(`Expected evaluator to accept parameters, got ${res.kind}`);
    }

    const s2 = getNumericOutput(res.data.outputs, "spacetimeIntervalSquared");
    const causalOrder = getNumericOutput(res.data.outputs, "causalOrder");

    expect(s2 < 0).toBe(true);
    expect(causalOrder).toBe(-1); // timelike
  });

  test("SR-03 output contracts declare all required semantic kinds and units", () => {
    expect(requireOutputContract("spatialSeparationK").unit).toBe("ls");
    expect(requireOutputContract("temporalSeparationK").unit).toBe("s");
    expect(requireOutputContract("measuredLength").unit).toBe("ls");
    expect(requireOutputContract("spacetimeIntervalSquared").unit).toBe("ls^2");
    expect(requireOutputContract("gammaFactor").unit).toBe("1");
    expect(requireOutputContract("ellipsoidAxisLongitudinal").unit).toBe("ls");
  });
});
