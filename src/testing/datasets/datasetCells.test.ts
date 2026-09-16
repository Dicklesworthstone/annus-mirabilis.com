import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  computeLinearFit,
  computeSeriesMean,
  computeUnboundedSubsetMean,
} from "../../content/datasets/statistics.ts";
import {
  type DataCell,
  ExperimentValidationError,
  validateDataCell,
  validateHistoricalDataset,
} from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { checkDatasetInference } from "../scenario-registry/datasetInference.ts";

const FIXTURE_YAML = `id: cells-fixture-dataset
title: "Cells Test Dataset"
evidenceStatus: historical-measurement
publications:
  - id: pub-1
    citation: "Test Citation (1909)"
    locator:
      kind: table
      number: 1
    publicationDate:
      type: issue-publication
      text: "1909"
      earliest: "1909-01-01"
      latest: "1909-12-31"
      precision: year
      source: "Test"
      verifiedAt: "2026-09-16"
primaryPublicationId: pub-1
digitizer:
  name: "Tester"
  method: "Keying"
  date: "2026-09-16"
  sourcePageImage: "test.png"
  digitizationRevision: 2
columns:
  - name: "X"
    quantityId: "length"
    unit: "m"
    role: "controlled"
  - name: "Y"
    quantityId: "rmsDisplacement1d"
    unit: "m"
    role: "observed"
  - name: "Fitted Curve"
    quantityId: "diffusionCoefficient"
    unit: "m²/s"
    role: "reported-fit"
    fitDescription: "Perrin linear fit"
rows:
  - cells:
      - kind: number
        value: 1e-6
        originalToken: "0,001"
      - kind: number
        value: 2e-6
      - kind: number
        value: 5e-13
  - cells:
      - kind: number
        value: 2e-6
      - kind: missing
        reason: "not reported"
      - kind: number
        value: 5e-13
  - cells:
      - kind: number
        value: 3e-6
      - kind: bound
        direction: "upper"
        value: 4e-6
      - kind: number
        value: 5e-13
uncertainty:
  type: none
  description: "Test uncertainty"
notes: "Test notes"
rights:
  status: public-domain-verified
  statement: "Public domain"
  source: "test"
  recordedAt: "2026-09-16"
  reuseTerms: unrestricted-scholarly
allowedInferenceModelIds:
  - "evaluateStokesEinstein"
calibrationIds:
  - "cal-micrometer-01"
sharedInputIds:
  - "input-viscosity-water"
`;

describe("datasetCells (am-inst-dataset-overlay-ra9r)", () => {
  test("validates series with number, missing, and bound cells and preserves originalToken byte for byte", () => {
    const raw = strictParse(FIXTURE_YAML, "yaml");
    const ds = validateHistoricalDataset(raw);

    expect(ds.rows.length).toBe(3);
    expect(ds.rows[0]?.cells[0]?.kind).toBe("number");
    expect((ds.rows[0]?.cells[0] as { originalToken?: string })?.originalToken).toBe("0,001");
    expect(ds.rows[1]?.cells[1]?.kind).toBe("missing");
    expect((ds.rows[1]?.cells[1] as { reason: string })?.reason).toBe("not reported");
    expect(ds.rows[2]?.cells[1]?.kind).toBe("bound");
    expect((ds.rows[2]?.cells[1] as { direction: string })?.direction).toBe("upper");

    // calibrationIds and sharedInputIds
    expect(ds.calibrationIds).toEqual(["cal-micrometer-01"]);
    expect(ds.sharedInputIds).toEqual(["input-viscosity-water"]);
    expect(ds.digitizer.digitizationRevision).toBe(2);
  });

  test("computeSeriesMean refuses with not-applicable when series contains a bound", () => {
    const raw = strictParse(FIXTURE_YAML, "yaml");
    const ds = validateHistoricalDataset(raw);
    const yCells: DataCell[] = ds.rows.map((r) => r.cells[1]!);

    const result = computeSeriesMean(yCells);
    expect(result.status).toBe("not-applicable");
    if (result.status === "not-applicable") {
      expect(result.reason).toContain("this series contains a value the apparatus could only bound");
      expect(result.boundedRowIndices).toEqual([2]);
    }
  });

  test("computeLinearFit refuses with not-applicable when evaluated cells contain a bound", () => {
    const raw = strictParse(FIXTURE_YAML, "yaml");
    const ds = validateHistoricalDataset(raw);
    const xCells: DataCell[] = ds.rows.map((r) => r.cells[0]!);
    const yCells: DataCell[] = ds.rows.map((r) => r.cells[1]!);

    const result = computeLinearFit(xCells, yCells);
    expect(result.status).toBe("not-applicable");
    if (result.status === "not-applicable") {
      expect(result.boundedRowIndices).toEqual([2]);
    }
  });

  test("computeSeriesMean succeeds over series without bounds", () => {
    const xCells: DataCell[] = [
      { kind: "number", value: 2 },
      { kind: "number", value: 4 },
      { kind: "missing", reason: "skipped" },
    ];
    const result = computeSeriesMean(xCells);
    expect(result.status).toBe("value");
    if (result.status === "value") {
      expect(result.value).toBe(3);
      expect(result.count).toBe(2);
    }
  });

  test("computeUnboundedSubsetMean explicitly documents excluded bound and missing rows", () => {
    const raw = strictParse(FIXTURE_YAML, "yaml");
    const ds = validateHistoricalDataset(raw);
    const yCells: DataCell[] = ds.rows.map((r) => r.cells[1]!);

    const result = computeUnboundedSubsetMean(yCells);
    expect(result.status).toBe("value");
    expect(result.rowsUsedCount).toBe(1);
    expect(result.rowsExcludedCount).toBe(2);
    expect(result.mean).toBe(2e-6);
  });

  test("planted negative: bare number cell rejected with named union", () => {
    expect(() => validateDataCell(42 as any)).toThrow(ExperimentValidationError);
  });

  test("planted negative: missing cell without reason fails", () => {
    expect(() => validateDataCell({ kind: "missing" } as any)).toThrow(ExperimentValidationError);
  });

  test("planted negative: bound cell without direction fails", () => {
    expect(() => validateDataCell({ kind: "bound", value: 5 } as any)).toThrow(
      ExperimentValidationError,
    );
  });

  test("planted negative: row cell count mismatch fails naming counts", () => {
    const raw = strictParse(FIXTURE_YAML, "yaml") as any;
    raw.rows[0].cells.pop();
    expect(() => validateHistoricalDataset(raw)).toThrow(ExperimentValidationError);
  });

  test("planted negative: reported-fit column missing fitDescription fails", () => {
    const raw = strictParse(FIXTURE_YAML, "yaml") as any;
    delete raw.columns[2].fitDescription;
    expect(() => validateHistoricalDataset(raw)).toThrow(ExperimentValidationError);
  });

  test("planted negative: retired derived boolean flag fails naming all four roles", () => {
    const raw = strictParse(FIXTURE_YAML, "yaml") as any;
    raw.columns[0].derived = true;
    expect(() => validateHistoricalDataset(raw)).toThrow(ExperimentValidationError);
  });

  test("planted negative: digitizationRevision 0 fails", () => {
    const raw = strictParse(FIXTURE_YAML, "yaml") as any;
    raw.digitizer.digitizationRevision = 0;
    expect(() => validateHistoricalDataset(raw)).toThrow(ExperimentValidationError);
  });

  test("static scan asserts no local duplicate declaration of cell union or role list in src/content/datasets/", () => {
    const dir = join(process.cwd(), "src/content/datasets");
    const files = readdirSync(dir, { recursive: true }) as string[];
    for (const f of files) {
      if (typeof f !== "string" || !f.endsWith(".ts")) continue;
      const content = readFileSync(join(dir, f), "utf8");
      expect(content).not.toContain('["observed", "controlled"');
      expect(content).not.toContain('type DataCell =');
    }
  });
});
