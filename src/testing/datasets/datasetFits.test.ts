import { describe, expect, test } from "bun:test";
import { loadHistoricalDatasetFromYaml } from "../../content/datasets/loader.ts";
import {
  ExperimentValidationError,
  validateHistoricalDataset,
} from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";

const FITS_SIX_ROWS_YAML = `id: fit-fixture-dataset
title: "Six Rows Fit Dataset"
evidenceStatus: historical-measurement
publications:
  - id: pub-1
    citation: "Citation (1909)"
    locator:
      kind: table
      number: 1
    publicationDate:
      type: issue-publication
      text: "1909"
      earliest: "1909-01-01"
      latest: "1909-12-31"
      precision: year
      source: "Source"
      verifiedAt: "2026-09-16"
primaryPublicationId: pub-1
digitizer:
  name: "Editorial Team"
  method: "Double keying"
  date: "2026-09-16"
  sourcePageImage: "p1.png"
  digitizationRevision: 1
columns:
  - name: "X"
    quantityId: "particleRadius"
    unit: "m"
    role: "controlled"
  - name: "Y"
    quantityId: "rmsDisplacement1d"
    unit: "m"
    role: "observed"
rows:
  - cells:
      - kind: number
        value: 1
      - kind: number
        value: 2
  - cells:
      - kind: number
        value: 2
      - kind: number
        value: 4
  - cells:
      - kind: number
        value: 3
      - kind: number
        value: 6
  - cells:
      - kind: number
        value: 4
      - kind: number
        value: 8
  - cells:
      - kind: number
        value: 5
      - kind: missing
        reason: "Excluded missing observation cell"
  - cells:
      - kind: number
        value: 6
      - kind: bound
        direction: upper
        value: 15
uncertainty:
  type: none
  description: "none"
notes: "Test"
rights:
  status: public-domain-verified
  statement: "Public domain"
  source: "test"
  recordedAt: "2026-09-16"
  reuseTerms: unrestricted-scholarly
allowedInferenceModelIds: []
fits:
  - id: fit-01
    label: "Linear least-squares fit across 4 points"
    fitObjective: "linear-least-squares"
    analysisDate:
      type: issue-publication
      text: "2027-03-04"
      earliest: "2027-03-04"
      latest: "2027-03-04"
      precision: day
      source: "Editorial team"
      verifiedAt: "2026-09-16"
    rowsUsed: [0, 1, 2, 3]
    rowsExcluded:
      - rowIndex: 4
        reason: "Excluded missing observation cell"
      - rowIndex: 5
        reason: "Excluded bounded instrument saturation"
    parameters:
      - name: "slope"
        quantityId: "mobility"
        value: 2.0
        unit: "s/kg"
        source: "fitted-here"
`;

describe("datasetFits (am-inst-dataset-overlay-ra9r)", () => {
  test("a fixture series of six rows with a fit using four and excluding two validates", () => {
    const raw = strictParse(FITS_SIX_ROWS_YAML, "yaml");
    const ds = validateHistoricalDataset(raw);
    expect(ds.fits?.length).toBe(1);
    const fit = ds.fits?.[0];
    expect(fit?.rowsUsed).toEqual([0, 1, 2, 3]);
    expect(fit?.rowsExcluded.length).toBe(2);
    expect(fit?.parameters[0]?.source).toBe("fitted-here");
  });

  test("a fixture with one row in neither rowsUsed nor rowsExcluded fails naming the row", () => {
    const raw = strictParse(FITS_SIX_ROWS_YAML, "yaml") as Record<string, unknown>;
    const fits = raw.fits as Array<Record<string, unknown>>;
    if (fits[0]) fits[0].rowsUsed = [0, 1, 2];
    expect(() => validateHistoricalDataset(raw)).toThrow(ExperimentValidationError);
    try {
      validateHistoricalDataset(raw);
    } catch (err) {
      expect((err as ExperimentValidationError).code).toBe("uncovered-fit-row");
      expect((err as ExperimentValidationError).message).toContain("Row 3");
    }
  });

  test("a fixture with one row in both rowsUsed and rowsExcluded fails", () => {
    const raw = strictParse(FITS_SIX_ROWS_YAML, "yaml") as Record<string, unknown>;
    const fits = raw.fits as Array<Record<string, unknown>>;
    const rowsExcluded = fits[0]?.rowsExcluded as Array<Record<string, unknown>>;
    rowsExcluded.push({ rowIndex: 3, reason: "duplicate" });
    expect(() => validateHistoricalDataset(raw)).toThrow(ExperimentValidationError);
    try {
      validateHistoricalDataset(raw);
    } catch (err) {
      expect((err as ExperimentValidationError).code).toBe("row-in-both-used-and-excluded");
      expect((err as ExperimentValidationError).message).toContain("Row 3");
    }
  });

  test("a fixture with an exclusion whose reason is empty fails", () => {
    const raw = strictParse(FITS_SIX_ROWS_YAML, "yaml") as Record<string, unknown>;
    const fits = raw.fits as Array<Record<string, unknown>>;
    const rowsExcluded = fits[0]?.rowsExcluded as Array<Record<string, unknown>>;
    if (rowsExcluded[0]) rowsExcluded[0].reason = "   ";
    expect(() => validateHistoricalDataset(raw)).toThrow(ExperimentValidationError);
    try {
      validateHistoricalDataset(raw);
    } catch (err) {
      expect((err as ExperimentValidationError).code).toBe("empty-exclusion-reason");
      expect((err as ExperimentValidationError).message).toContain("Row 4");
    }
  });

  test("a fit parameter binding a legacy spelling fails with legacySpellingMessage", () => {
    // electricField is a registered legacy spelling
    const invalidYaml = FITS_SIX_ROWS_YAML.replace(
      'quantityId: "mobility"',
      'quantityId: "electricField"',
    );
    expect(() => loadHistoricalDatasetFromYaml(invalidYaml)).toThrow();
  });
});
