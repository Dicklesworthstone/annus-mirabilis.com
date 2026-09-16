import { afterAll, describe, expect, it } from "bun:test";
import { getConstantSet } from "../physics/reference/constants.ts";
import {
  bandLimitedMeanQuantumEnergyWien,
  effectiveIndependentCount,
  meanQuantumEnergyWien,
} from "../physics/reference/radiation.ts";
import { newRunIdentity, TestLogger } from "./log/logger.ts";

const SUITE = "reference-radiation";
const BEAD_ID = "am-ref-radiation-15c";

describe("radiation.quanta (am-ref-radiation-15c)", () => {
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);

  afterAll(async () => {
    await logger.flush();
  });

  it("effectiveIndependentCount returns E / (h * nu) and tracks quantum energy in eV", () => {
    const set = getConstantSet("modern-si-2019");
    const nu = 5.0e14; // Visible light frequency ~ 600 nm
    const h = 6.62607015e-34;
    const E = 1.0; // 1 Joule of monochromatic radiation

    const res = effectiveIndependentCount(E, nu, set);
    expect(res.status).toBe("value");
    expect(res.quantumEnergy).toBeCloseTo(h * nu, 25);
    expect(res.quantumEnergyEv).toBeCloseTo((h * nu) / 1.602176634e-19, 6);
    expect(res.count).toBeCloseTo(E / (h * nu), 0);

    logger.log({
      testId: "quanta-effective-count",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("meanQuantumEnergyWien evaluates to 3 * k_B * T and ratio to molecule kinetic energy is exactly 2", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 1700;
    const kB = 1.380649e-23;

    const res = meanQuantumEnergyWien(T, set);
    expect(res.status).toBe("value");
    expect(res.meanQuantumEnergyWien).toBeCloseTo(3 * kB * T, 20);
    expect(res.meanResonatorEnergy).toBeCloseTo(kB * T, 20);
    expect(res.ratioToMoleculeKinetic).toBeCloseTo(2.0, 12);

    // Visible light at 600 THz ratio check
    const h = 6.62607015e-34;
    const nu600 = 6.0e14;
    const expectedRatio = (h * nu600) / (3 * kB * T);
    expect(res.ratioAt600THz).toBeCloseTo(expectedRatio, 10);

    logger.log({
      testId: "quanta-mean-wien-energy-and-ratio",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("bandLimitedMeanQuantumEnergyWien converges to 3 * k_B * T as bounds expand to [0, infinity]", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 2000;
    const kB = 1.380649e-23;

    // Wide domain [0, 50]
    const resWide = bandLimitedMeanQuantumEnergyWien(T, 0, 50, set);
    expect(resWide.status).toBe("value");
    if (resWide.status === "value") {
      expect(resWide.modelStatus).toBe("editorial-variant");
      expect(resWide.meanQuantumEnergyWien).toBeCloseTo(3 * kB * T, 15);
      expect(resWide.wienAdmittedBoundaryX).toBeCloseTo(Math.log(100), 10);
      expect(resWide.energyShareBelowBoundary).toBeGreaterThan(0);
      expect(resWide.energyShareBelowBoundary).toBeLessThan(1);
    }

    // Narrow domain [4, 10]
    const resNarrow = bandLimitedMeanQuantumEnergyWien(T, 4, 10, set);
    expect(resNarrow.status).toBe("value");
    if (resNarrow.status === "value") {
      // On [4, 10], mean energy is higher than 3 * k_B * T
      expect(resNarrow.meanQuantumEnergyWien).toBeGreaterThan(3 * kB * T);
    }

    logger.log({
      testId: "quanta-band-limited-incomplete-gamma",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });
});
