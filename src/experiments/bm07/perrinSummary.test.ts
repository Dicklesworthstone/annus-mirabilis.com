import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { loadHistoricalDataset } from "../../content/datasets/loader.ts";
import type { HistoricalDataset } from "../../content/schemas/experiment.ts";
import { PERRIN_1909_DATASET_ID } from "../bm01/perrin.ts";
import { evaluatePerrinSummaryRecord, PERRIN_SUMMARY_MODEL_ID } from "./perrinSummary.ts";
import { loadPerrinSummaryRecord } from "./perrinSummaryRecord.ts";

const dataset = () =>
  loadHistoricalDataset(
    resolve(process.cwd(), "content/datasets", `${PERRIN_1909_DATASET_ID}.yaml`),
  );
const evaluate = (source: HistoricalDataset) =>
  evaluatePerrinSummaryRecord(source, "Perrin, pp. 76–77");

describe("Perrin's source-limited historical summary workflow", () => {
  test("the actual published record yields four point estimates without independent counts or intervals", () => {
    const record = loadPerrinSummaryRecord();
    expect(record.kind).toBe("available");
    if (record.kind !== "available") return;
    expect(record.modelId).toBe(PERRIN_SUMMARY_MODEL_ID);
    expect(record.evidenceLabel).toBe("later evidence, published 1909");
    expect(record.sourcePageImage).toContain("#page=75");
    expect(record.citation).toContain("First-series table, p. 77");
    expect(record.points.map((point) => point.elapsedTimeSeconds)).toEqual([30, 60, 90, 120]);
    expect(record.points.map((point) => point.observedMeanSquareM2)).toEqual([
      5.02e-11, 1.135e-10, 1.28e-10, 1.44e-10,
    ]);
    // Independent hand reductions in µm²/s: the overlapping rows are not pooled or fitted.
    const expected = [0.8366666666666667, 0.9458333333333333, 0.7111111111111111, 0.6];
    record.points.forEach((point, index) => {
      expect(point.diffusivityM2PerSecond * 1e12).toBeCloseTo(expected[index] ?? 0, 12);
      expect(point.independentCoordinateCount).toBeNull();
    });
    expect(record.intervalStatus).toBe("not-applicable");
    expect(record.intervalReason).toContain("independent displacement count is unreported");
    expect(JSON.stringify(record)).not.toMatch(
      /nHat|avogadro|molecularNumber|lower|upper|increments/,
    );
  });

  test("the data admit only the summary point owner, never increment inference or an inversion", () => {
    const source = dataset();
    expect(source.allowedInferenceModelIds).toEqual([PERRIN_SUMMARY_MODEL_ID]);
    expect(source.calibrationIds).toEqual([]);
    for (const ids of [
      [],
      ["estimateIncrements"],
      ["invertToMolecularNumber"],
      ["summaryChiSquareInterval"],
    ]) {
      const record = evaluate({ ...source, allowedInferenceModelIds: ids });
      expect(record.kind).toBe("withheld");
      expect(JSON.stringify(record)).not.toContain("diffusivityM2PerSecond");
      expect(JSON.stringify(record)).not.toContain("5.02");
    }
  });

  test("withdrawal withholds both the observations and every derived number before serialization", () => {
    const record = evaluate({
      ...dataset(),
      evidenceStatus: "withdrawn",
      withdrawal: { date: "2026-11-12", reason: "Transcription withdrawn for this test." },
    });
    expect(record).toEqual({
      kind: "withheld",
      citation: "Perrin, pp. 76–77",
      reason: "Transcription withdrawn for this test.",
    });
    expect(JSON.stringify(record)).not.toMatch(/points|diffusivity|5\.02|meanSquare/);
  });

  test("an incomplete table, wrong units or a different series never silently changes the statistic", () => {
    const source = dataset();
    const defects: HistoricalDataset[] = [
      { ...source, rows: source.rows.slice(0, 3) },
      { ...source, rows: source.rows.map((row) => ({ ...row, seriesId: "other-series" })) },
      {
        ...source,
        columns: source.columns.map((column) =>
          column.quantityId === "meanSquareDisplacement1d" ? { ...column, unit: "m" } : column,
        ),
      },
      {
        ...source,
        columns: source.columns.map((column) =>
          column.quantityId === "meanSquareDisplacement1d"
            ? { ...column, role: "controlled" as const }
            : column,
        ),
      },
      {
        ...source,
        rows: source.rows.map((row, index) =>
          index === 0
            ? {
                ...row,
                cells: [
                  { kind: "number" as const, value: 30 },
                  { kind: "missing" as const, reason: "Not transcribed" },
                ],
              }
            : row,
        ),
      },
    ];
    for (const defect of defects) {
      const record = evaluate(defect);
      expect(record.kind).toBe("withheld");
      expect(JSON.stringify(record)).not.toContain("points");
    }
  });

  test("later evidence cannot be relabeled onto the 1904 shelf", () => {
    const source = dataset();
    const record = evaluate({
      ...source,
      publications: source.publications.map((publication) => ({
        ...publication,
        publicationDate: {
          ...publication.publicationDate,
          text: "September 1904",
          earliest: "1904-09-01",
          latest: "1904-09-30",
        },
      })),
    });
    expect(record.kind).toBe("withheld");
    expect(JSON.stringify(record)).not.toContain("points");
  });
});
