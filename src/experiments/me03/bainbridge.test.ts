import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { loadHistoricalDataset } from "../../content/datasets/loader.ts";
import type { HistoricalDataset } from "../../content/schemas/experiment.ts";
import {
  BAINBRIDGE_1933_DATASET_ID,
  BAINBRIDGE_MASS_UNIT,
  compareBainbridgeReaction,
  evaluateBainbridgeRecord,
} from "./bainbridge.ts";
import { loadBainbridgeRecord } from "./bainbridgeRecord.ts";

const dataset = () =>
  loadHistoricalDataset(
    resolve(process.cwd(), "content/datasets", `${BAINBRIDGE_1933_DATASET_ID}.yaml`),
  );
const evaluate = (source: HistoricalDataset) =>
  evaluateBainbridgeRecord(source, "Bainbridge, p. 123");

describe("Bainbridge's source-backed comparisons", () => {
  test("loads both printed reactions, their different evidential roles and original mass scale", () => {
    const record = loadBainbridgeRecord();
    assert.equal(record.kind, "available");
    assert(record.kind === "available");
    expect(record.massUnit).toBe(BAINBRIDGE_MASS_UNIT);
    expect(record.evidenceLabel).toBe("later evidence, published 1933");
    expect(record.citation).toContain("Bainbridge");
    expect(record.sourcePageImage).toContain("page/n60.jpg");
    expect(
      record.reactions.map((row) => [
        row.id,
        row.energyGainMeV,
        row.reportedMassEquivalent,
        row.measuredMassDefect,
        row.quotedMassError,
        row.energyUncertainty.kind,
      ]),
    ).toEqual([
      ["lithium-7-proton", 16.97, 0.0182, 0.0181, 0.0006, "not-reported"],
      ["lithium-6-deuteron", 23.7, 0.0255, 0.0238, 0.0004, "not-reported"],
    ]);
    expect(record.uncertainty).toContain("probable error");
    expect(record.uncertainty).toContain("not a significance statistic");
  });

  test("shows the small first discrepancy without assigning a confidence level", () => {
    const comparison = compareBainbridgeReaction(loadBainbridgeRecord(), "lithium-7-proton");
    assert(comparison.kind === "available");
    expect(comparison.measuredMinusEquivalent).toBeCloseTo(-0.0001, 12);
    expect(comparison.differenceInQuotedMassErrors).toBeCloseTo(1 / 6, 12);
    expect(comparison.quotedMassRange.lower).toBeCloseTo(0.0175, 12);
    expect(comparison.quotedMassRange.upper).toBeCloseTo(0.0187, 12);
    expect(comparison.withinQuotedMassRange).toBe(true);
    expect(comparison.statisticalAgreement.status).toBe("underdetermined");
    expect(comparison.statisticalAgreement.reason).toContain("no numerical energy uncertainty");
    expect(comparison.statisticalAgreement).not.toHaveProperty("coverage");
  });

  test("retains the unsatisfactory second comparison and its missing energy error", () => {
    const comparison = compareBainbridgeReaction(loadBainbridgeRecord(), "lithium-6-deuteron");
    assert(comparison.kind === "available");
    expect(comparison.measuredMinusEquivalent).toBeCloseTo(-0.0017, 12);
    expect(comparison.differenceInQuotedMassErrors).toBeCloseTo(4.25, 12);
    expect(comparison.quotedMassRange.lower).toBeCloseTo(0.0234, 12);
    expect(comparison.quotedMassRange.upper).toBeCloseTo(0.0242, 12);
    expect(comparison.withinQuotedMassRange).toBe(false);
    expect(comparison.reaction.energyUncertainty.reason).toContain("alpha-particle ranges");
    expect(comparison.statisticalAgreement.status).toBe("underdetermined");
    expect(comparison.reaction.sourceDescription).toContain("Conditional interpretation");
  });

  test("does not regenerate the reported equivalent or independent mass from the energy", () => {
    const source = dataset();
    const changed: HistoricalDataset = {
      ...source,
      rows: source.rows.map((row) => ({
        ...row,
        cells: row.cells.map((cell, index) =>
          index === 0 && cell.kind === "number" ? { ...cell, value: cell.value * 2 } : cell,
        ),
      })),
    };
    const comparison = compareBainbridgeReaction(evaluate(changed), "lithium-7-proton");
    assert(comparison.kind === "available");
    expect(comparison.reaction.energyGainMeV).toBe(33.94);
    expect(comparison.reaction.reportedMassEquivalent).toBe(0.0182);
    expect(comparison.reaction.measuredMassDefect).toBe(0.0181);
    expect(comparison.measuredMinusEquivalent).toBeCloseTo(-0.0001, 12);
  });

  test("withdrawal removes every observation from the record sent to the browser", () => {
    const source: HistoricalDataset = {
      ...dataset(),
      evidenceStatus: "withdrawn",
      withdrawal: { date: "2026-11-14", reason: "Source withdrawn for this test." },
    };
    const record = evaluate(source);
    expect(record).toEqual({
      kind: "withheld",
      citation: "Bainbridge, p. 123",
      reason: "Source withdrawn for this test.",
    });
    expect(JSON.stringify(record)).not.toContain("0.0182");
    expect(record).not.toHaveProperty("reactions");
    expect(compareBainbridgeReaction(record, "lithium-7-proton").kind).toBe("unavailable");
  });

  test("refuses modern-u relabelling, swapped source roles and invented zero energy errors", () => {
    const source = dataset();
    const variants: HistoricalDataset[] = [
      {
        ...source,
        columns: source.columns.map((column) =>
          column.unit === BAINBRIDGE_MASS_UNIT ? { ...column, unit: "u" } : column,
        ),
      },
      {
        ...source,
        columns: source.columns.map((column) =>
          column.quantityId === "energyEquivalentMass" ? { ...column, role: "observed" } : column,
        ),
      },
      {
        ...source,
        rows: source.rows.map((row) => ({
          ...row,
          cells: row.cells.map((cell) =>
            cell.kind === "missing" ? { kind: "number", value: 0 } : cell,
          ),
        })),
      },
    ];
    for (const variant of variants) {
      const record = evaluate(variant);
      expect(record.kind).toBe("withheld");
      expect(record).not.toHaveProperty("reactions");
    }
    expect(evaluate(source).kind).toBe("available");
  });

  test("cannot drop the discrepant reaction, misdate the evidence or select an invented case", () => {
    const source = dataset();
    expect(evaluate({ ...source, rows: source.rows.slice(0, 1) }).kind).toBe("withheld");
    expect(
      evaluate({
        ...source,
        publications: source.publications.map((publication) => ({
          ...publication,
          publicationDate: {
            ...publication.publicationDate,
            earliest: "1904-07-15",
            latest: "1904-07-15",
          },
        })),
      }).kind,
    ).toBe("withheld");
    expect(compareBainbridgeReaction(loadBainbridgeRecord(), "invented-reaction").kind).toBe(
      "unavailable",
    );
  });
});
