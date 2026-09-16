import { afterAll, describe, expect, it } from "bun:test";
import { getQuantity, getQuantityRegistry } from "../content/quantities/registry.ts";
import { resolveQuantityId } from "../content/quantities/resolveQuantityId.ts";
import { getConstantSet } from "../physics/reference/constants.ts";
import {
  LOG_DOUBLE_MIN_NORMAL,
  planckFrequencyEnergyDensity,
} from "../physics/reference/radiation.ts";
import { withinTolerance } from "../units/tolerance.ts";
import { newRunIdentity, TestLogger } from "./log/logger.ts";

const SUITE = "reference-radiation";
const BEAD_ID = "am-ref-radiation-15c";

describe("radiation.representability (am-ref-radiation-15c)", () => {
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);

  afterAll(async () => {
    await logger.flush();
  });

  it("threshold fixtures at T = 500 K: representability lost at x = 686.1851 and log values accurate at x = 800", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 500;
    const kB = 1.380649e-23;
    const h = 6.62607015e-34;
    const c = 299792458;

    // Transition near x = 686.1871 at T = 500 K where lnU crosses LOG_DOUBLE_MIN_NORMAL (-708.3964)
    // Just below transition (e.g. x = 686.18): linearRepresentable is true
    const nuJustAboveMin = (686.18 * kB * T) / h;
    const resJustAboveMin = planckFrequencyEnergyDensity(nuJustAboveMin, T, set);
    expect(resJustAboveMin.status).toBe("value");
    if (resJustAboveMin.status === "value") {
      expect(resJustAboveMin.linearRepresentable).toBe(true);
      expect(resJustAboveMin.value).toBeGreaterThan(0);
    }

    // Just above transition (e.g. x = 686.19): linearRepresentable is false
    const nuThreshold = (686.19 * kB * T) / h;
    const resThreshold = planckFrequencyEnergyDensity(nuThreshold, T, set);
    expect(resThreshold.status).toBe("value");
    if (resThreshold.status === "value") {
      expect(resThreshold.linearRepresentable).toBe(false);
      expect(resThreshold.logFrequencyEnergyDensity).toBeLessThanOrEqual(LOG_DOUBLE_MIN_NORMAL);
    }

    // x = 800: nu = 8.3346476e15 Hz
    const nu800 = (800 * kB * T) / h;
    const res800 = planckFrequencyEnergyDensity(nu800, T, set);
    expect(res800.status).toBe("value");
    if (res800.status === "value") {
      expect(res800.linearRepresentable).toBe(false);
      expect(res800.logFrequencyEnergyDensity).toBeDefined();
      expect(res800.log10FrequencyEnergyDensity).toBeDefined();

      const expectedLn = -821.7509205;
      const expectedLog10 = -356.88189;
      if (res800.logFrequencyEnergyDensity !== undefined) {
        expect(res800.logFrequencyEnergyDensity).toBeCloseTo(expectedLn, 4);
      }
      if (res800.log10FrequencyEnergyDensity !== undefined) {
        expect(res800.log10FrequencyEnergyDensity).toBeCloseTo(expectedLog10, 4);
      }

      // Direct naive product in double precision evaluates to 0
      const naivePrefactor = (8 * Math.PI * h * nu800 ** 3) / c ** 3;
      const naiveProduct = naivePrefactor * Math.exp(-800);
      expect(naiveProduct).toBe(0);
    }

    logger.log({
      testId: "representability-threshold-500k",
      beadId: BEAD_ID,
      outcome: "passed",
      extra: {
        linearRepresentable: false,
        representationField: "logFrequencyEnergyDensity",
        x: 800,
        logFrequencyEnergyDensity:
          res800.status === "value" ? res800.logFrequencyEnergyDensity : undefined,
        log10FrequencyEnergyDensity:
          res800.status === "value" ? res800.log10FrequencyEnergyDensity : undefined,
      },
    });
  });

  it("agreement of linear and log forms across x in [10^-8, 10^3] to 10^-12 where both exist", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 500;
    const kB = 1.380649e-23;
    const h = 6.62607015e-34;

    const testXValues = [
      1e-8, 1e-6, 1e-4, 1e-2, 0.1, 1.0, 2.5, 5.0, 10.0, 50.0, 100.0, 500.0, 680.0, 700.0, 800.0,
      1000.0,
    ];

    for (const x of testXValues) {
      const nu = (x * kB * T) / h;
      const res = planckFrequencyEnergyDensity(nu, T, set);
      expect(res.status).toBe("value");
      if (res.status === "value") {
        expect(res.logFrequencyEnergyDensity).toBeDefined();
        if (res.linearRepresentable && res.logFrequencyEnergyDensity !== undefined) {
          const reconstructed = Math.exp(res.logFrequencyEnergyDensity);
          expect(withinTolerance(reconstructed, res.value, { relative: 1e-12 }).ok).toBe(true);
        } else if (res.logFrequencyEnergyDensity !== undefined) {
          expect(res.logFrequencyEnergyDensity).toBeLessThanOrEqual(LOG_DOUBLE_MIN_NORMAL);
        }
      }
    }

    logger.log({
      testId: "linear-log-agreement-domain",
      beadId: BEAD_ID,
      outcome: "passed",
      extra: { testXCount: testXValues.length },
    });
  });

  it("declared representation fields rule: representation fields are declared on quantities and do not shadow registry IDs", () => {
    const freq = getQuantity("frequencyEnergyDensity");
    expect(freq.representationFields).toContain("logFrequencyEnergyDensity");
    expect(freq.representationFields).toContain("log10FrequencyEnergyDensity");

    const wave = getQuantity("wavelengthEnergyDensity");
    expect(wave.representationFields).toContain("logWavelengthEnergyDensity");
    expect(wave.representationFields).toContain("log10WavelengthEnergyDensity");

    const prob = getQuantity("configurationProbability");
    expect(prob.representationFields).toContain("lnW");
    expect(prob.representationFields).toContain("log10W");

    // No declared representation field shadows a registry ID
    const registry = getQuantityRegistry();
    for (const q of registry.quantities.values()) {
      for (const rep of q.representationFields ?? []) {
        expect(registry.quantities.has(rep)).toBe(false);
      }
    }

    // resolveQuantityId on logFrequencyEnergyDensity returns unregistered, never legacy-spelling
    const resolved = resolveQuantityId("logFrequencyEnergyDensity");
    expect(resolved).toEqual({ ok: false, kind: "unregistered" });

    logger.log({
      testId: "declared-representation-fields-invariants",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });
});
