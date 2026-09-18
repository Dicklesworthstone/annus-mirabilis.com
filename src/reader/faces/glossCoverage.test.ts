import { describe, expect, test } from "bun:test";
import {
  FIXTURE_MASS_ENERGY_GLOSS_UNITS,
  FIXTURE_MASS_ENERGY_SOURCE_BLOCKS,
} from "../../testing/fixtures/bilingual/massEnergyGlossFixture.ts";
import { computeGlossCoverageReport } from "./glossCoverage.ts";

describe("glossCoverage: per-class counts, non-percentage reporting, and zero-count tolerance", () => {
  const modalityClasses = [
    "konjunktiv-i",
    "konjunktiv-ii",
    "hedge",
    "necessity",
    "condition",
    "consequence",
    "restriction",
  ];

  test("computes per-class counts for mass-energy paper fixture", () => {
    const report = computeGlossCoverageReport(
      "mass-energy",
      FIXTURE_MASS_ENERGY_SOURCE_BLOCKS,
      FIXTURE_MASS_ENERGY_GLOSS_UNITS,
      modalityClasses,
    );

    expect(report.paperSlug).toBe("mass-energy");
    expect(report.totalSentences).toBe(6);
    expect(report.glossedSentences).toBe(3);
    expect(report.unglossedSentences).toBe(3);

    // Checks that konjunktiv-i (es sei) and consequence are marked
    expect(report.modalityCounts["konjunktiv-i"]).toBeGreaterThanOrEqual(1);
    expect(report.modalityCounts.consequence).toBeGreaterThanOrEqual(1);

    // Report strictly contains per-class integer counts and NO percentages
    expect(report).not.toHaveProperty("percentage");
    expect(report).not.toHaveProperty("coveragePercentage");
    expect(report).not.toHaveProperty("modalityPercentage");
    expect(typeof report.markedTokens).toBe("number");
  });

  test("glossed section with zero marked reasoning tokens appears in report without failure", () => {
    // Only gloss unit me-p1-s1 (which has only formula-phrase, no modality classes)
    const pureCalculationGloss = [FIXTURE_MASS_ENERGY_GLOSS_UNITS[0]!];
    const report = computeGlossCoverageReport(
      "mass-energy",
      [FIXTURE_MASS_ENERGY_SOURCE_BLOCKS[1]!], // only me-p1
      pureCalculationGloss,
      modalityClasses,
    );

    expect(report.glossedSentences).toBe(1);
    expect(report.markedTokens).toBe(0);
    expect(report.modalityCounts).toEqual({});
    expect(report.totalTokens).toBeGreaterThan(0);
  });
});
