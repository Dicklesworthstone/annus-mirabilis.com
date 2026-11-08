import { afterAll, describe, expect, test } from "bun:test";
import { newRunIdentity, TestLogger } from "../../../testing/log/logger.ts";
import {
  planckFrequencyBandSeries,
  wienFrequencyBandSeries,
} from "../../../testing/references/radiationSeries.ts";
import { withinTolerance } from "../../../units/tolerance.ts";
import { getConstantSet } from "../constants.ts";
import {
  planckBandEnergyDensity,
  planckWavelengthBandEnergyDensity,
  wienBandEnergyDensity,
} from "./bandIntegration.ts";
import type { RadiationResult } from "./types.ts";

const SET = getConstantSet("modern-si-2019");
const C = 299792458;
const BEAD = "am-ref-radiation-15c";
const logger = new TestLogger("radiation-band-integration", newRunIdentity());
afterAll(() => logger.flush());

function value(result: RadiationResult<number>): number {
  expect(result.status).toBe("value");
  if (result.status !== "value") throw new Error(JSON.stringify(result));
  expect(result.linearRepresentable).toBe(true);
  expect(Number.isFinite(result.value)).toBe(true);
  expect(result.value).toBeGreaterThan(0);
  return result.value;
}

function matches(actual: number, reference: number, relative = 1e-12) {
  expect(withinTolerance(actual, reference, { relative }).ok).toBe(true);
}

describe("bounded radiation band integration", () => {
  for (const temperature of [500, 3000, 5000, 10000]) {
    test(`the 400–600 THz band converges at ${temperature} K against independent integrals`, () => {
      const before = performance.now();
      const frequency = value(planckBandEnergyDensity(4e14, 6e14, temperature, SET));
      const wavelength = value(
        planckWavelengthBandEnergyDensity(C / 6e14, C / 4e14, temperature, SET),
      );
      const wien = value(wienBandEnergyDensity(4e14, 6e14, temperature, SET));
      const planckReference = planckFrequencyBandSeries(4e14, 6e14, temperature, SET);
      const wienReference = wienFrequencyBandSeries(4e14, 6e14, temperature, SET);

      // The old Kronrod weight biased the integral by about 5e-11 and prevented
      // convergence. With bounded work it would refuse the 5000/10000 K cases,
      // so these are a deterministic performance regression without a clock gate.
      matches(frequency, planckReference);
      matches(wavelength, planckReference);
      matches(wien, wienReference);
      matches(wavelength, frequency);
      logger.log({
        testId: `teaching-band-${temperature}K`,
        beadId: BEAD,
        instrumentId: "lq-03",
        expected: planckReference,
        actual: frequency,
        durationMs: performance.now() - before,
        comparisonKind: "tolerance",
        tolerance: { relative: 1e-12 },
        outcome: "passed",
      });
    });
  }

  test("the full selectable band converges and preserves energy across coordinates", () => {
    // The series has a finite tail at the very low lower edge. Its established
    // 1e-9 accuracy is distinct from the tighter coordinate-identity check.
    for (const temperature of [500, 3000, 10000]) {
      const frequency = value(planckBandEnergyDensity(1e11, 1e16, temperature, SET));
      const wavelength = value(
        planckWavelengthBandEnergyDensity(C / 1e16, C / 1e11, temperature, SET),
      );
      matches(frequency, planckFrequencyBandSeries(1e11, 1e16, temperature, SET), 1e-9);
      matches(wavelength, frequency);
      matches(
        value(wienBandEnergyDensity(1e11, 1e16, temperature, SET)),
        wienFrequencyBandSeries(1e11, 1e16, temperature, SET),
      );
    }
    logger.log({ testId: "full-selectable-bands", beadId: BEAD, outcome: "passed" });
  });

  test("an unrepresentable integral is a numerical refusal, never an unconverged value", () => {
    // Each sampled density is representable, but its integral over this finite
    // band overflows. A depth-only algorithm recursively subdivides this range
    // before returning infinity; the numerical limit must instead be explicit.
    for (const result of [
      planckBandEnergyDensity(1e110, 2e110, 1e120, SET),
      wienBandEnergyDensity(1e110, 2e110, 1e120, SET),
    ]) {
      expect(result.status).toBe("outside-domain");
      if (result.status !== "outside-domain") throw new Error(JSON.stringify(result));
      expect(result.domainKind).toBe("numerical");
      expect(result.condition).toBe("band-integration-not-converged");
      expect(result.reason).toContain("not a zero energy or a physical prohibition");
      expect("value" in result).toBe(false);
    }
    logger.log({ testId: "unrepresentable-integral", beadId: BEAD, outcome: "passed" });
  });

  test("invalid or reversed bounds still refuse before numerical integration", () => {
    for (const integrate of [planckBandEnergyDensity, wienBandEnergyDensity]) {
      for (const [low, high, temperature] of [
        [0, 6e14, 5000],
        [6e14, 4e14, 5000],
        [4e14, 4e14, 5000],
        [4e14, Number.POSITIVE_INFINITY, 5000],
        [4e14, 6e14, Number.NaN],
      ] as const) {
        expect(integrate(low, high, temperature, SET).status).toBe("outside-domain");
      }
    }
    expect(planckWavelengthBandEnergyDensity(1e-6, 0, 5000, SET).status).toBe("outside-domain");
    logger.log({ testId: "invalid-band-inputs", beadId: BEAD, outcome: "passed" });
  });
});
