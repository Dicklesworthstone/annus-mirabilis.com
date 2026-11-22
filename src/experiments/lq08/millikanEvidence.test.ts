import { describe, expect, test } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadHistoricalDataset } from "../../content/datasets/loader.ts";
import type { HistoricalDataset } from "../../content/schemas/experiment.ts";
import {
  loadMillikanOverlay,
  millikanOverlayForRecord,
} from "./millikanRecord.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const record = loadHistoricalDataset(resolve(ROOT, "content/datasets/millikan-1916-sodium.yaml"));
const citation = "Millikan, Physical Review 7 (1916), 355–388";
const frequencyColumn = record.columns.findIndex((column) => column.quantityId === "frequency");

function omitFrequencies(indices: readonly number[]): HistoricalDataset {
  return {
    ...record,
    rows: record.rows.map((row, index) => ({
      ...row,
      cells: row.cells.map((cell, column) =>
        column === frequencyColumn && indices.includes(index)
          ? { kind: "missing" as const, reason: "A source cell omitted for this admission test." }
          : cell,
      ),
    })),
  };
}

describe("the live Millikan source-inspection payload", () => {
  test("carries admitted original rows, the excluded row's reason and source page locators", () => {
    const overlay = loadMillikanOverlay(ROOT);
    expect(overlay.kind).toBe("plottable");
    if (overlay.kind !== "plottable") throw new TypeError("The current source record was withheld.");
    expect(overlay.points.map((point) => point.rowIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(overlay.points.map((point) => point.usedForSlope)).toEqual([
      true, true, true, true, true, false,
    ]);
    expect(overlay.points[5]?.slopeExclusionReason).toBe(record.fits?.[0]?.rowsExcluded[0]?.reason);
    expect(overlay.points[0]?.slopeExclusionReason).toBeUndefined();
    expect(overlay.evidence?.dataset).toEqual(record);
    expect(overlay.evidence?.sourceLinks.map((link) => new URL(link.href).hash)).toEqual([
      "#page=93",
      "#page=94",
      "#page=102",
    ]);
    expect(overlay.evidence?.sourceLinks.every((link) => new URL(link.href).hostname === "archive.org"))
      .toBe(true);
    expect(overlay.citation).toContain("A Direct Photoelectric Determination");
    expect(overlay.citation).not.toBe("cit-millikan-1916");
    // No asset publication decision can be manufactured from the dataset's rights status.
    expect(overlay.evidence && "publicationDecision" in overlay.evidence).toBe(false);
    expect(JSON.parse(JSON.stringify(overlay)).evidence.dataset.digitizer.digitizationRevision).toBe(2);
  });

  test("an omitted source cell never renumbers a later plotted row or its exclusion", () => {
    const overlay = millikanOverlayForRecord(omitFrequencies([1]), citation);
    expect(overlay.kind).toBe("plottable");
    if (overlay.kind !== "plottable") throw new TypeError(overlay.reason);
    expect(overlay.points.map((point) => point.rowIndex)).toEqual([0, 2, 3, 4, 5]);
    expect(overlay.points.at(-1)?.rowIndex).toBe(5);
    expect(overlay.points.at(-1)?.slopeExclusionReason).toBe(record.fits?.[0]?.rowsExcluded[0]?.reason);
    expect(overlay.evidence?.dataset.rows[1]?.cells[frequencyColumn]?.kind).toBe("missing");
  });

  const refusals: readonly [string, HistoricalDataset][] = [
    [
      "withdrawn measurements",
      {
        ...record,
        evidenceStatus: "withdrawn",
        withdrawal: { date: "2026-11-22", reason: "Withdrawn for this admission test." },
      },
    ],
    ["another dataset", { ...record, id: "another-source" }],
    ["a fit the source does not admit", { ...record, allowedInferenceModelIds: [] }],
    ["a missing slope record", { ...record, fits: [] }],
    ["fewer than three retained slope points", omitFrequencies([1, 2, 3, 4])],
    [
      "incompatible plotted units",
      {
        ...record,
        columns: record.columns.map((column) =>
          column.quantityId === "frequency" ? { ...column, unit: "THz" } : column,
        ),
      },
    ],
  ];
  for (const [name, dataset] of refusals) {
    test(`${name} serializes its reason, with no data rows or source-inspection payload`, () => {
      const overlay = millikanOverlayForRecord(dataset, citation);
      expect(overlay.kind).toBe("withheld");
      if (overlay.kind !== "withheld") throw new TypeError("The refusal leaked an admitted panel.");
      expect(overlay.reason.length).toBeGreaterThan(0);
      expect(overlay.citation).toBe(citation);
      expect("evidence" in overlay).toBe(false);
      expect("points" in overlay).toBe(false);
      const serialized = JSON.stringify(overlay);
      expect(serialized).not.toContain("547400000000000");
      expect(serialized).not.toContain("118.2 × 10¹³");
      expect(serialized).not.toContain("p373-fig6-600dpi.webp");
      expect(serialized).not.toContain("sourceLinks");
    });
  }
});
