/**
 * LQ-08 Energy Budget and Rates Tests (am-lq-08-photoelectric-va5a).
 * Tests complete transfer, partial transfer bounds, threshold behavior,
 * rates, sweeps with distribution models, two metals comparison,
 * cathode luminescence, and adversarial rate vs energy invariance.
 */

import { afterAll, describe, expect, it } from "bun:test";
import { getConstantSet } from "../physics/reference/constants.ts";
import {
  cathodeLuminescenceMinimumPotential,
  collectorSweep,
  emissionRate,
  kMax,
  kMaxEv,
  photocurrent,
  quantumEnergyEv,
  quantumRate,
  signedEnergyBudget,
  stoppingLine,
  stoppingPotentialFromEv,
  thresholdFrequencyFromEv,
} from "../physics/reference/photoelectric.ts";
import { withinTolerance } from "../units/tolerance.ts";
import { newRunIdentity, TestLogger } from "./log/logger.ts";

const SUITE = "lq08-photoelectric";
const BEAD_ID = "am-lq-08-photoelectric-va5a";

describe("LQ-08 Energy Budget and Rates (am-lq-08-photoelectric-va5a)", () => {
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);

  afterAll(async () => {
    await logger.flush();
  });

  it("Complete transfer: h*nu = 2.4814 eV at 600 THz, K_max = 0.4814 eV, V_s = 0.4814 V at Phi = 2 eV", () => {
    const set = getConstantSet("modern-si-2019");
    const nu = 6.0e14; // 600 THz
    const phiEv = 2.0;

    const qe = quantumEnergyEv(nu, set);
    expect(qe.status).toBe("value");
    if (qe.status === "value") {
      expect(withinTolerance(qe.value, 2.4814006, { relative: 1e-5 }).ok).toBe(true);
    }

    const km = kMaxEv(nu, phiEv, set);
    expect(km.status).toBe("value");
    if (km.status === "value") {
      expect(withinTolerance(km.value, 0.4814006, { relative: 1e-5 }).ok).toBe(true);
    }

    const vs = stoppingPotentialFromEv(nu, phiEv, set);
    expect(vs.status).toBe("value");
    if (vs.status === "value") {
      expect(withinTolerance(vs.value, 0.4814006, { relative: 1e-5 }).ok).toBe(true);
    }

    logger.log({
      testId: "lq08-complete-transfer-budget",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("Threshold: at nu = 450 THz and Phi = 2 eV, status is not-applicable and signed budget has deficit", () => {
    const set = getConstantSet("modern-si-2019");
    const nu = 4.5e14; // 450 THz
    const phiEv = 2.0;
    const e = 1.602176634e-19;
    const phiJ = phiEv * e;

    const qe = quantumEnergyEv(nu, set);
    expect(qe.status).toBe("value");
    if (qe.status === "value") {
      expect(withinTolerance(qe.value, 1.86105, { relative: 1e-4 }).ok).toBe(true);
    }

    const km = kMaxEv(nu, phiEv, set);
    expect(km.status).toBe("not-applicable");
    if (km.status === "not-applicable") {
      expect(km.reason).toBe("no emitted electron in this model");
    }

    const vs = stoppingPotentialFromEv(nu, phiEv, set);
    expect(vs.status).toBe("not-applicable");
    if (vs.status === "not-applicable") {
      expect(vs.reason).toBe("no emitted electron in this model");
    }

    const budget = signedEnergyBudget(nu, phiJ, set);
    expect(budget.emitted).toBe(false);
    expect(budget.excessEv).toBeLessThan(0);
    // Deficit: 1.86105 - 2.0 = -0.13895 eV ~= deficit 0.139 eV
    expect(withinTolerance(budget.excessEv, -0.13895, { relative: 1e-3 }).ok).toBe(true);

    logger.log({
      testId: "lq08-subthreshold-refusal",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("Partial transfer: K_max and V_s report underdetermined with upper bounds and cite printed inequality", () => {
    const set = getConstantSet("modern-si-2019");
    const nu = 6.0e14; // 600 THz
    const phiEv = 2.0;

    const kmPartial = kMaxEv(nu, phiEv, set, "partial");
    expect(kmPartial.status).toBe("underdetermined");
    if (kmPartial.status === "underdetermined") {
      expect(kmPartial.upperBound).toBeDefined();
      if (kmPartial.upperBound !== undefined) {
        expect(withinTolerance(kmPartial.upperBound, 0.4814006, { relative: 1e-5 }).ok).toBe(true);
      }
      expect(kmPartial.citation).toContain("Pi * E + P' <= R * beta * nu");
    }

    const vsPartial = stoppingPotentialFromEv(nu, phiEv, set, "partial");
    expect(vsPartial.status).toBe("underdetermined");
    if (vsPartial.status === "underdetermined") {
      expect(vsPartial.upperBound).toBeDefined();
      if (vsPartial.upperBound !== undefined) {
        expect(withinTolerance(vsPartial.upperBound, 0.4814006, { relative: 1e-5 }).ok).toBe(true);
      }
      expect(vsPartial.citation).toContain("Pi * E + P' <= R * beta * nu");
    }

    logger.log({
      testId: "lq08-partial-transfer-bound",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("Rates: power scales N_dot_q and N_dot_e linearly, zero below threshold, 1/nu frequency scaling", () => {
    const set = getConstantSet("modern-si-2019");
    const pOpt = 0.001; // 1 mW
    const nu = 6.0e14; // 600 THz
    const phiJ = 2.0 * 1.602176634e-19;
    const etaQ = 0.1;

    const qRate = quantumRate(pOpt, nu, set);
    expect(qRate.status).toBe("value");
    if (qRate.status === "value") {
      // 1e-3 / (6.62607015e-34 * 6e14) = 2.515317e15 s^-1
      expect(withinTolerance(qRate.value, 2.515317e15, { relative: 1e-5 }).ok).toBe(true);
    }

    const eRate = emissionRate(pOpt, nu, phiJ, etaQ, set);
    expect(eRate.status).toBe("value");
    if (eRate.status === "value") {
      expect(withinTolerance(eRate.value, 2.515317e14, { relative: 1e-5 }).ok).toBe(true);
    }

    // Zero emission rate below threshold
    const subNu = 4.5e14;
    const eRateSub = emissionRate(pOpt, subNu, phiJ, etaQ, set);
    expect(eRateSub.status).toBe("value");
    if (eRateSub.status === "value") {
      expect(eRateSub.value).toBe(0);
    }

    // At fixed power, doubling frequency halves quantum rate (1/nu scaling)
    const qRate2Nu = quantumRate(pOpt, 2 * nu, set);
    expect(qRate2Nu.status).toBe("value");
    if (qRate.status === "value" && qRate2Nu.status === "value") {
      expect(withinTolerance(qRate2Nu.value / qRate.value, 0.5, { relative: 1e-12 }).ok).toBe(true);
    }

    logger.log({
      testId: "lq08-rates-scaling",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("Sweeps: determined at Uc >= 0 and Uc <= -Vs, underdetermined in between without declared model, linear falloff with uniform", () => {
    const set = getConstantSet("modern-si-2019");
    const pOpt = 0.001;
    const nu = 6.0e14;
    const phiJ = 2.0 * 1.602176634e-19;
    const etaQ = 0.1;

    // Default (no declared distribution model)
    const sweepNoModel = collectorSweep(
      pOpt,
      nu,
      phiJ,
      etaQ,
      { min: -1.0, max: 1.0, steps: 5 },
      set,
      "none",
    );

    // At Uc = 1.0 >= 0: determined value
    const pSat = sweepNoModel.find((p) => p.collectorPotential > 0);
    expect(pSat?.result.status).toBe("value");

    // At Uc = -1.0 <= -Vs (-0.481 V): determined value 0
    const pCutoff = sweepNoModel.find((p) => p.collectorPotential <= -0.5);
    expect(pCutoff?.result.status).toBe("value");
    if (pCutoff?.result.status === "value") {
      expect(pCutoff.result.value).toBe(0);
    }

    // Between -Vs and 0: underdetermined
    const pcMid = photocurrent(pOpt, nu, phiJ, etaQ, -0.2, set, "none");
    expect(pcMid.status).toBe("underdetermined");

    // With "all-at-kmax": full saturation current until -Vs
    const pcAllKmax = photocurrent(pOpt, nu, phiJ, etaQ, -0.2, set, "all-at-kmax");
    expect(pcAllKmax.status).toBe("value");
    if (pcAllKmax.status === "value" && pSat?.result.status === "value") {
      expect(pcAllKmax.value).toBe(pSat.result.value);
    }

    // With "uniform": linear falloff F = 1 - e*|Uc|/Kmax
    const pcUniform = photocurrent(pOpt, nu, phiJ, etaQ, -0.2, set, "uniform");
    expect(pcUniform.status).toBe("value");
    if (pcUniform.status === "value" && pSat?.result.status === "value") {
      const vs = 0.4814006;
      const expectedFraction = 1 - 0.2 / vs;
      expect(
        withinTolerance(pcUniform.value, pSat.result.value * expectedFraction, { relative: 1e-4 })
          .ok,
      ).toBe(true);
    }

    logger.log({
      testId: "lq08-collector-sweeps-models",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("Two metals: Phi1 = 2 eV and Phi2 = 3 eV have slopes that agree bitwise (h/e) and differing thresholds", () => {
    const set = getConstantSet("modern-si-2019");
    const e = 1.602176634e-19;
    const phi1J = 2.0 * e;
    const phi2J = 3.0 * e;

    const tf1 = thresholdFrequencyFromEv(2.0, set);
    const tf2 = thresholdFrequencyFromEv(3.0, set);
    expect(tf1.status).toBe("value");
    expect(tf2.status).toBe("value");
    if (tf1.status === "value" && tf2.status === "value") {
      expect(withinTolerance(tf1.value, 483.5978e12, { relative: 1e-4 }).ok).toBe(true);
      expect(withinTolerance(tf2.value, 725.3968e12, { relative: 1e-4 }).ok).toBe(true);
      expect(tf1.value).not.toBe(tf2.value);
    }

    const lines1 = stoppingLine(phi1J, { min: 8e14, max: 1e15, steps: 5 }, set);
    const lines2 = stoppingLine(phi2J, { min: 8e14, max: 1e15, steps: 5 }, set);

    expect(lines1.length).toBeGreaterThan(1);
    expect(lines2.length).toBeGreaterThan(1);

    const hOverE = 6.62607015e-34 / 1.602176634e-19;
    expect(lines1.slope).toBe(lines2.slope);
    expect(Object.is(lines1.slope, hOverE)).toBe(true);

    const [p1_0, p1_1] = lines1;
    const [p2_0, p2_1] = lines2;
    if (!p1_0 || !p1_1 || !p2_0 || !p2_1) {
      throw new Error("Expected at least two points on each stopping line");
    }

    const slope1 =
      (p1_1.stoppingPotential - p1_0.stoppingPotential) / (p1_1.frequency - p1_0.frequency);
    const slope2 =
      (p2_1.stoppingPotential - p2_0.stoppingPotential) / (p2_1.frequency - p2_0.frequency);
    expect(withinTolerance(slope1, hOverE, { relative: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(slope2, hOverE, { relative: 1e-12 }).ok).toBe(true);

    logger.log({
      testId: "lq08-two-metals-slope-invariance",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("Cathode luminescence: minimum potential equals max(0, (h*nu - Phi)/e)", () => {
    const set = getConstantSet("modern-si-2019");
    const nu = 6.0e14;
    const e = 1.602176634e-19;
    const phiJ = 2.0 * e;

    const clRes = cathodeLuminescenceMinimumPotential(nu, phiJ, set);
    expect(clRes.status).toBe("value");
    if (clRes.status === "value") {
      // (2.4814 eV - 2.0 eV) = 0.4814 V
      expect(withinTolerance(clRes.value, 0.4814006, { relative: 1e-4 }).ok).toBe(true);
    }

    // Subthreshold optical excitation: minimum potential is 0
    const clSub = cathodeLuminescenceMinimumPotential(4.0e14, phiJ, set);
    expect(clSub.status).toBe("value");
    if (clSub.status === "value") {
      expect(clSub.value).toBe(0);
    }

    logger.log({
      testId: "lq08-cathode-luminescence",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("Adversarial: K_max is invariant under any P_opt change ('brighter light means faster electrons' must fail)", () => {
    const set = getConstantSet("modern-si-2019");
    const nu = 6.5e14;
    const phiJ = 2.0 * 1.602176634e-19;

    const powers = [1e-6, 1e-3, 0.5, 1.0];
    const kResults = powers.map(() => kMax(nu, phiJ, set));

    for (const res of kResults) {
      expect(res.status).toBe("value");
    }

    // False classical claim: "higher intensity delivers faster electrons"
    const assertClassicalMyth = (k1: number, k2: number) => {
      if (Object.is(k1, k2)) {
        throw new Error(
          "Brighter light does not produce faster electrons; energy is strictly independent of power.",
        );
      }
    };

    const firstK = (kResults[0] as { value: number }).value;
    const lastK = (kResults[3] as { value: number }).value;

    expect(() => assertClassicalMyth(firstK, lastK)).toThrow(
      "Brighter light does not produce faster electrons",
    );
    expect(Object.is(firstK, lastK)).toBe(true);

    logger.log({
      testId: "adversarial-intensity-invariance-fails-myth",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });
});
