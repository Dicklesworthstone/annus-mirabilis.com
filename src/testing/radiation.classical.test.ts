import { afterAll, describe, expect, it } from "bun:test";
import { getConstantSet } from "../physics/reference/constants.ts";
import {
  classicalCutoffEnergyDensity,
  classicalModeAllocation,
  classicalTotalEnergy,
  meanResonatorEnergy,
} from "../physics/reference/radiation.ts";
import { newRunIdentity, TestLogger } from "./log/logger.ts";

const SUITE = "reference-radiation";
const BEAD_ID = "am-ref-radiation-15c";

describe("radiation.classical (am-ref-radiation-15c)", () => {
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);

  afterAll(async () => {
    await logger.flush();
  });

  it("classical cutoff energy density satisfies cubic scaling U(2 * nu_c) / U(nu_c) = 8", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 1500;
    const nu1 = 1e14;
    const nu2 = 2e14;

    const u1 = classicalCutoffEnergyDensity(nu1, T, set);
    const u2 = classicalCutoffEnergyDensity(nu2, T, set);

    expect(u1.status).toBe("value");
    expect(u2.status).toBe("value");

    if (u1.status === "value" && u2.status === "value") {
      const ratio = u2.value / u1.value;
      expect(ratio).toBeCloseTo(8.0, 10);
    }

    logger.log({
      testId: "classical-cutoff-cubic-scaling",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("classical cutoff energy density table at T = 1500 K matches analytical values", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 1500;
    const kB = 1.380649e-23;
    const c = 299792458;

    const testFrequencies = [1e13, 5e13, 1e14, 5e14, 1e15];
    for (const nu of testFrequencies) {
      const res = classicalCutoffEnergyDensity(nu, T, set);
      expect(res.status).toBe("value");
      if (res.status === "value") {
        const expected = (8 * Math.PI * kB * T * nu ** 3) / (3 * c ** 3);
        const relDiff = Math.abs(res.value - expected) / expected;
        expect(relDiff).toBeLessThan(1e-12);
      }
    }

    logger.log({
      testId: "classical-cutoff-table-1500k",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("classicalTotalEnergy refuses with typed divergence condition 'classical-total-diverges'", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 1500;

    const res = classicalTotalEnergy(T, set);
    expect(res.status).toBe("outside-domain");
    if (res.status === "outside-domain") {
      expect(res.condition).toBe("classical-total-diverges");
      expect(res.quantityId).toBe("radiationEnergy");
      expect(res.reason).toContain("unbounded total energy");
    }

    logger.log({
      testId: "classical-total-energy-divergence-refusal",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("mean resonator energy is k_B * T and equals (R / N) * T with 2/3 ratio to translational kinetic energy", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 300;
    const kB = 1.380649e-23;

    const res = meanResonatorEnergy(T, set);
    expect(res.status).toBe("value");
    if (res.status === "value") {
      expect(res.value).toBeCloseTo(kB * T, 15);
      expect(res.ratioToFreeMoleculeKineticEnergy).toBeCloseTo(2 / 3, 12);
    }

    logger.log({
      testId: "classical-mean-resonator-energy-ratio",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("classicalModeAllocation handles symbolic lq-02:1904 mode and parallel-work-1905 mode", () => {
    const set = getConstantSet("modern-si-2019");
    const T = 1500;
    const nuCutoff = 1e14;

    // Symbolic without reveal
    const alloc1904 = classicalModeAllocation("lq-02:1904", nuCutoff, T, set);
    expect(alloc1904.status).toBe("symbolic");
    if (alloc1904.status === "symbolic") {
      expect(alloc1904.expressionRef).toBe("eq-lq-02-1904-mode-allocation");
      expect(alloc1904.unspecifiedSymbols).toContain("universalGasConstantPerMolecule");
    }

    // Revealed historical status
    const allocRevealed = classicalModeAllocation("lq-02:1904", nuCutoff, T, set, {
      revealCoefficient: true,
    });
    expect(allocRevealed.status).toBe("value");
    if (allocRevealed.status === "value") {
      expect(allocRevealed.historicalStatus).toBe("parallel-work-1905");
    }

    // Standard 1905
    const alloc1905 = classicalModeAllocation("standard", nuCutoff, T, set);
    expect(alloc1905.status).toBe("value");

    logger.log({
      testId: "classical-mode-allocation-options",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });
});
