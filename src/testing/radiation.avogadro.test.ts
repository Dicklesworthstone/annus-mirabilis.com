import { afterAll, describe, expect, it } from "bun:test";
import type { ConstantSet } from "../physics/reference/constants.ts";
import {
  avogadroFromPlanckConstants,
  MODERN_AVOGADRO,
  MODERN_BOLTZMANN,
  MODERN_H1_ATOM_MASS_GRAMS,
  MODERN_RECIPROCAL_GRAM,
} from "../physics/reference/radiation.ts";
import { newRunIdentity, TestLogger } from "./log/logger.ts";

const SUITE = "reference-radiation";
const BEAD_ID = "am-ref-radiation-15c";

describe("radiation.avogadro (am-ref-radiation-15c)", () => {
  const logRunId = newRunIdentity();
  const logger = new TestLogger(SUITE, logRunId);

  afterAll(async () => {
    await logger.flush();
  });

  it("Avogadro from 1905 Planck constants matches unrounded and printed values", () => {
    const res = avogadroFromPlanckConstants();
    expect(res.status).toBe("value");

    // N_unrounded = (4.866e-11 / 6.1e-57) * (8 * pi * 8.31e7 / 27e30) = 6.170486...e23
    expect(res.avogadroConstant).toBeCloseTo(6.170486e23, -18);
    expect(res.printedAvogadroConstant).toBe(6.17e23);

    // Hydrogen atom mass: 1/N = 1.620618e-24 g, printed 1.62e-24 g
    expect(res.unroundedHydrogenAtomMassGrams).toBeCloseTo(1.620618e-24, 29);
    expect(res.printedHydrogenAtomMassGrams).toBe(1.62e-24);

    // R/N: 8.31e7 / N = 1.346733e-16 erg/K, printed 1.346839e-16 erg/K
    expect(res.unroundedROverN).toBeCloseTo(1.346733e-16, 21);

    logger.log({
      testId: "avogadro-1905-unrounded-and-printed",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("Printed-value markers: alpha is printed-corrected, R and L are editorial-inputs with sensitivity annotations", () => {
    const res = avogadroFromPlanckConstants();
    const alphaMarker = res.markers.wienConstantAlpha;
    expect(alphaMarker).toBeDefined();
    if (alphaMarker) {
      expect(alphaMarker.printedStatus).toBe("printed-corrected");
      expect(alphaMarker.reason).toContain("10^-57");
    }

    const rMarker = res.markers.molarGasConstant;
    expect(rMarker).toBeDefined();
    if (rMarker) {
      expect(rMarker.printedStatus).toBe("editorial-input");
      expect(rMarker.sensitivity).toContain("Linear");
    }

    const lMarker = res.markers.speedOfLight;
    expect(lMarker).toBeDefined();
    if (lMarker) {
      expect(lMarker.printedStatus).toBe("editorial-input");
      expect(lMarker.sensitivity).toContain("Inverse cubic");
    }

    logger.log({
      testId: "avogadro-markers-and-sensitivities",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("Modern comparison lines: N_A, 1/N_A, 1H mass, k_B", () => {
    const res = avogadroFromPlanckConstants();
    expect(res.modernComparisons.modernAvogadro).toBe(MODERN_AVOGADRO);
    expect(res.modernComparisons.modernReciprocalGram).toBeCloseTo(MODERN_RECIPROCAL_GRAM, 30);
    expect(res.modernComparisons.modernHydrogenAtomMassGrams).toBe(MODERN_H1_ATOM_MASS_GRAMS);
    expect(res.modernComparisons.modernBoltzmannConstant).toBe(MODERN_BOLTZMANN);

    // Modern 1H mass vs 1/N_A has small excess due to mass defect / nucleon binding
    expect(res.modernComparisons.modernHydrogenAtomMassGrams).toBeGreaterThan(
      res.modernComparisons.modernReciprocalGram,
    );

    logger.log({
      testId: "avogadro-modern-comparisons",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });

  it("Planck 1900-1901 set readout returns 6.175e23", () => {
    const mockPlanckSet = {
      id: "planck-1900-1901-printed",
      label: "Planck 1900-1901 Printed",
      authority: "Planck 1900, 1901",
      year: 1901,
      entries: [],
    } as unknown as ConstantSet;

    const res = avogadroFromPlanckConstants(mockPlanckSet);
    expect(res.status).toBe("value");
    expect(res.avogadroConstant).toBe(6.175e23);
    expect(res.printedAvogadroConstant).toBe(6.175e23);

    logger.log({
      testId: "avogadro-planck-1900-set",
      beadId: BEAD_ID,
      outcome: "passed",
    });
  });
});
