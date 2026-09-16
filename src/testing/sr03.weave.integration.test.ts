import { describe, expect, test } from "bun:test";
import {
  SR03_BUDGET,
  SR03_DEFAULTS,
  SR03_MODEL,
  SR03_OUTPUTS,
  SR03_PRESETS,
} from "../experiments/sr03/definition.ts";
import { evaluateSr03 } from "../workers/operations/sr03.ts";
import { withinTolerance } from "../units/tolerance.ts";

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
    if (res.kind === "accepted") {
      const dtK = res.data.outputs.find((o) => o.quantityId === "temporalSeparationK")?.value;
      const dxK = res.data.outputs.find((o) => o.quantityId === "spatialSeparationK")?.value;
      const dtPrime = res.data.outputs.find(
        (o) => o.quantityId === "temporalSeparationKPrime",
      )?.value;
      const dxPrime = res.data.outputs.find(
        (o) => o.quantityId === "spatialSeparationKPrime",
      )?.value;

      expect(dtK).toBe(0);
      expect(dxK).toBe(10);
      expect(withinTolerance(dtPrime as number, -7.5, { absolute: 1e-12 }).ok).toBe(true);
      expect(withinTolerance(dxPrime as number, 12.5, { absolute: 1e-12 }).ok).toBe(true);
    }
  });

  test("SR-03 §4 clause: valid frame-simultaneous measurement yields contracted rod length L = 8 ls", async () => {
    const res = await evaluateSr03(
      SR03_PRESETS["sr-03-valid-pair-0.6c"]?.parameters ?? SR03_DEFAULTS,
    );
    expect(res.kind).toBe("accepted");
    if (res.kind === "accepted") {
      const meas = res.data.outputs.find((o) => o.quantityId === "measuredLength");
      expect(meas?.status).toBe("value");
      expect(withinTolerance(meas?.value as number, 8.0, { absolute: 1e-12 }).ok).toBe(true);
    }
  });

  test("SR-03 §4 clause: moving sphere of radius R contracts to ellipsoid (R/gamma, R, R)", async () => {
    const res = await evaluateSr03(SR03_PRESETS["sr-03-sphere-0.6c"]?.parameters ?? SR03_DEFAULTS);
    expect(res.kind).toBe("accepted");
    if (res.kind === "accepted") {
      const longAxis = res.data.outputs.find(
        (o) => o.quantityId === "ellipsoidAxisLongitudinal",
      )?.value;
      const transY = res.data.outputs.find(
        (o) => o.quantityId === "ellipsoidAxisTransverseY",
      )?.value;
      const transZ = res.data.outputs.find(
        (o) => o.quantityId === "ellipsoidAxisTransverseZ",
      )?.value;

      expect(withinTolerance(longAxis as number, 0.8, { absolute: 1e-12 }).ok).toBe(true);
      expect(transY).toBe(1.0);
      expect(transZ).toBe(1.0);
    }
  });

  test("SR-03 §2/§4 clause: timelike causal order invariant under boost", async () => {
    const res = await evaluateSr03(
      SR03_PRESETS["sr-03-causal-timelike"]?.parameters ?? SR03_DEFAULTS,
    );
    expect(res.kind).toBe("accepted");
    if (res.kind === "accepted") {
      const s2 = res.data.outputs.find((o) => o.quantityId === "spacetimeIntervalSquared")?.value;
      const causalOrder = res.data.outputs.find((o) => o.quantityId === "causalOrder")?.value;

      expect((s2 as number) < 0).toBe(true);
      expect(causalOrder).toBe(-1); // timelike
    }
  });

  test("SR-03 output contracts declare all required semantic kinds and units", () => {
    expect(SR03_OUTPUTS.spatialSeparationK.unit).toBe("ls");
    expect(SR03_OUTPUTS.temporalSeparationK.unit).toBe("s");
    expect(SR03_OUTPUTS.measuredLength.unit).toBe("ls");
    expect(SR03_OUTPUTS.spacetimeIntervalSquared.unit).toBe("ls^2");
    expect(SR03_OUTPUTS.gammaFactor.unit).toBe("1");
    expect(SR03_OUTPUTS.ellipsoidAxisLongitudinal.unit).toBe("ls");
  });
});
