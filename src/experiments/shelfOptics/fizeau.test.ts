import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { loadHistoricalDataset } from "../../content/datasets/loader.ts";
import type { HistoricalDataset } from "../../content/schemas/experiment.ts";
import { SHELF_DEFINITIONS } from "./definition.ts";
import { evaluateShelfOptics } from "./evaluation.ts";
import {
  compareFizeau,
  evaluateFizeauRecord,
  FIZEAU_DATASET_ID,
  fizeauSourceParameters,
} from "./fizeau.ts";
import { loadFizeauRecord } from "./fizeauRecord.ts";
import { shelfSnapshot } from "./state.ts";

const dataset = () =>
  loadHistoricalDataset(resolve(process.cwd(), "content/datasets", `${FIZEAU_DATASET_ID}.yaml`));
const read = (source: HistoricalDataset) => evaluateFizeauRecord(source, "Fizeau 1859, p. 392");
const sourceRecord = () => {
  const record = loadFizeauRecord();
  if (record.kind !== "plottable") throw new Error(record.reason);
  return record;
};
const sourceParameters = () => {
  const parameters = fizeauSourceParameters(sourceRecord());
  if (!parameters) throw new Error("The source setup was not admitted.");
  return parameters;
};

describe("Fizeau's primary-source table and admission", () => {
  test("all nineteen printed values, publication date and reported aggregate survive canonical loading", () => {
    const source = dataset();
    const record = sourceRecord();
    expect(source.primaryPublicationId).toBe("fizeau-1859-annales");
    expect(source.publications[0]?.publicationDate.text).toBe("December 1859");
    expect(record.evidenceLabel).toContain("available before 1905");
    expect(record.sourcePageImage).toContain("#page=8");
    expect(record.observations.map((row) => row.fringeShift)).toEqual([
      0.2, 0.22, 0.24, 0.167, 0.171, 0.225, 0.247, 0.225, 0.214, 0.23, 0.224, 0.247, 0.224, 0.307,
      0.307, 0.256, 0.24, 0.24, 0.189,
    ]);
    expect(record.meanFringeShift).toBeCloseTo(4.373 / 19, 14);
    expect(record.meanFringeShift.toFixed(5)).toBe("0.23016");
    expect(source.uncertainty.type).toBe("printed-rounding-only");
    expect(source.allowedInferenceModelIds).toEqual([]);
    expect(source.rows[18]?.cells[4]).toEqual({
      kind: "number",
      value: 0.189,
      originalToken: "0,189",
    });
  });

  test("source settings use two traversals and the selected E line, with an explicit modern index assumption", () => {
    expect(sourceRecord().sourceInputs).toEqual({
      waterSpeed: 7.059,
      tubeLength: 1.4875,
      waterPathPerBeam: 2.975,
      wavelength: 5.26e-7,
    });
    expect(sourceParameters()).toEqual({
      instrumentId: "shelf-fizeau",
      waterSpeed: 7.059,
      waterPathPerBeam: 2.975,
      wavelength: 5.26e-7,
      refractiveIndex: 1.333,
      reversal: false,
      showLater: false,
    });
  });

  test("withdrawal and absence withhold measurements before client serialization", () => {
    const result = read({
      ...dataset(),
      evidenceStatus: "withdrawn",
      withdrawal: { date: "2026-11-12", reason: "Withdrawn source for the test." },
    });
    expect(result).toEqual({
      kind: "withheld",
      citation: "Fizeau 1859, p. 392",
      reason: "Withdrawn source for the test.",
    });
    expect(JSON.stringify(result)).not.toContain("observations");
    expect(fizeauSourceParameters(result)).toBeNull();
    expect(loadFizeauRecord(resolve(process.cwd(), "src/experiments/shelfOptics"))).toMatchObject({
      kind: "withheld",
    });
  });

  test("the experiment's presentation year cannot replace the table's publication year", () => {
    const source = dataset();
    for (const year of ["1851", "1909"]) {
      expect(
        read({
          ...source,
          publications: source.publications.map((publication) => ({
            ...publication,
            publicationDate: {
              ...publication.publicationDate,
              earliest: `${year}-12-01`,
              latest: `${year}-12-31`,
            },
          })),
        }).kind,
      ).toBe("withheld");
    }
  });

  test("wrong units, missing rows and an absent observed cell cannot look like a complete measured table", () => {
    const source = dataset();
    expect(
      read({
        ...source,
        columns: source.columns.map((column) =>
          column.quantityId === "fringeShift" ? { ...column, unit: "m" } : column,
        ),
      }).kind,
    ).toBe("withheld");
    expect(read({ ...source, rows: source.rows.slice(1) }).kind).toBe("withheld");
    expect(
      read({
        ...source,
        rows: source.rows.map((row, i) =>
          i !== 0
            ? row
            : {
                ...row,
                cells: row.cells.map((cell, j) =>
                  j === 4 ? { kind: "missing", reason: "Unavailable row" } : cell,
                ),
              },
        ),
      }).kind,
    ).toBe("withheld");
  });

  test("changing the optical path to one tube or giving rows different reduction speeds is refused", () => {
    const source = dataset();
    expect(
      read({
        ...source,
        rows: source.rows.map((row) => ({
          ...row,
          cells: row.cells.map((cell, j) => (j === 2 ? { kind: "number", value: 1.4875 } : cell)),
        })),
      }).kind,
    ).toBe("withheld");
    expect(
      read({
        ...source,
        rows: source.rows.map((row, i) =>
          i !== 0
            ? row
            : {
                ...row,
                cells: row.cells.map((cell, j) =>
                  j === 0 ? { kind: "number", value: 7.069 } : cell,
                ),
              },
        ),
      }).kind,
    ).toBe("withheld");
  });
});

describe("the measured comparison consumes one accepted optical calculation", () => {
  test("modern predictions preserve the difference from both measurements and printed historical calculations", () => {
    const record = sourceRecord();
    const p = sourceParameters();
    const compared = compareFizeau(record, shelfSnapshot(evaluateShelfOptics(p)));
    expect(compared.kind).toBe("available");
    if (compared.kind !== "available") return;
    expect(compared.sourceConditionsMatch).toBe(true);
    const full = compared.predictions.find((row) => row.modelId === "fizeau-full-drag");
    const fresnel = compared.predictions.find((row) => row.modelId === "fresnel-drag");
    // Independent first-order formula, with explicit modern c, for a two-traversal path.
    const firstOrder =
      (2 * p.waterPathPerBeam * p.waterSpeed * (p.refractiveIndex ** 2 - 1)) /
      (299792458 * p.wavelength);
    expect(fresnel?.predictedFringeShift).toBeCloseTo(firstOrder, 13);
    expect(full?.predictedFringeShift).toBeCloseTo(0.4732754742756125, 12);
    expect(fresnel?.observedMinusModel).toBeGreaterThan(0.02);
    expect(full?.predictedFringeShift).not.toBeCloseTo(0.4597, 3);
    expect(fresnel?.predictedFringeShift).not.toBeCloseTo(0.2022, 3);
  });

  test("a changed accepted output is read exactly, proving the panel cannot silently recalculate optics", () => {
    const report = evaluateShelfOptics(sourceParameters());
    const changed = shelfSnapshot(
      {
        ...report,
        rows: report.rows.map((row) =>
          row.modelId !== "fresnel-drag"
            ? row
            : {
                ...row,
                metrics: row.metrics.map((metric) =>
                  metric.label === "Signed fringe shift" ? { ...metric, value: 0.123 } : metric,
                ),
              },
        ),
      },
      12,
    );
    const result = compareFizeau(sourceRecord(), changed);
    expect(result.kind).toBe("available");
    if (result.kind !== "available") return;
    expect(
      result.predictions.find((row) => row.modelId === "fresnel-drag")?.predictedFringeShift,
    ).toBe(0.123);
  });

  test("changed apparatus settings move only the model; reversed protocol never silently rewrites the measurements", () => {
    const record = sourceRecord();
    const original = JSON.stringify(record);
    const p = sourceParameters();
    const changed = compareFizeau(
      record,
      shelfSnapshot(evaluateShelfOptics({ ...p, waterSpeed: 0 })),
    );
    expect(changed.kind).toBe("available");
    if (changed.kind === "available") {
      expect(changed.sourceConditionsMatch).toBe(false);
      expect(changed.predictions.every((row) => row.predictedFringeShift === 0)).toBe(true);
    }
    for (const changes of [{ reversal: true }, { waterSpeed: -7.059 }]) {
      expect(
        compareFizeau(record, shelfSnapshot(evaluateShelfOptics({ ...p, ...changes }))).kind,
      ).toBe("unavailable");
    }
    expect(JSON.stringify(record)).toBe(original);
  });

  test("a different experiment or missing owner output supplies a reason rather than a fabricated zero", () => {
    expect(
      compareFizeau(
        sourceRecord(),
        shelfSnapshot(evaluateShelfOptics(SHELF_DEFINITIONS["shelf-michelson-morley"].defaults)),
      ).kind,
    ).toBe("unavailable");
    const snapshot = shelfSnapshot(evaluateShelfOptics(sourceParameters()));
    expect(
      compareFizeau(sourceRecord(), {
        ...snapshot,
        report: { ...snapshot.report, rows: snapshot.report.rows.slice(1) },
      }).kind,
    ).toBe("unavailable");
  });
});
