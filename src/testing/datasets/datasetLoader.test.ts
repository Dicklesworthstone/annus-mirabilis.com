import { describe, expect, test } from "bun:test";
import {
  DatasetValidationError,
  loadHistoricalDatasetFromYaml,
} from "../../content/datasets/loader.ts";
import { ExperimentValidationError } from "../../content/schemas/experiment.ts";

const VALID_DATASET_YAML = `id: test-dataset-1909
title: "Perrin (1909) Granule Displacements"
evidenceStatus: historical-measurement
publications:
  - id: pub-1
    citation: "Perrin, J. (1909). Annales de Chimie et de Physique 18: 5-114."
    locator:
      kind: table
      number: 1
    publicationDate:
      type: issue-publication
      text: "1909"
      earliest: "1909-01-01"
      latest: "1909-12-31"
      precision: year
      source: "Ann. Chim. Phys."
      verifiedAt: "2026-09-16"
primaryPublicationId: pub-1
digitizer:
  name: "Editorial Team"
  method: "Double keying"
  date: "2026-09-16"
  sourcePageImage: "perrin-p1.png"
  digitizationRevision: 1
columns:
  - name: "Radius"
    quantityId: "particleRadius"
    unit: "m"
    role: "controlled"
  - name: "Displacement"
    quantityId: "rmsDisplacement1d"
    unit: "m"
    role: "observed"
rows:
  - cells:
      - kind: number
        value: 1e-6
        originalToken: "1 µm"
      - kind: number
        value: 2e-6
        originalToken: "2 µm"
uncertainty:
  type: standard-deviation
  description: "Reported sample std dev"
notes: "Historical test dataset"
rights:
  status: public-domain-verified
  statement: "Public domain"
  source: "https://archive.org"
  recordedAt: "2026-09-16"
  reuseTerms: unrestricted-scholarly
allowedInferenceModelIds:
  - "evaluateStokesEinstein"
`;

describe("datasetLoader (am-inst-dataset-overlay-ra9r)", () => {
  test("loads valid dataset successfully with quantity resolution", () => {
    const ds = loadHistoricalDatasetFromYaml(VALID_DATASET_YAML);
    expect(ds.id).toBe("test-dataset-1909");
    expect(ds.columns.length).toBe(2);
    expect(ds.rows.length).toBe(1);
    expect(ds.allowedInferenceModelIds).toEqual(["evaluateStokesEinstein"]);
  });

  test("rejects pipeline-only datasets loaded from pipeline directory", () => {
    expect(() =>
      loadHistoricalDatasetFromYaml(VALID_DATASET_YAML, {
        sourcePath:
          "/Users/jemanuel/projects/annus-mirabilis_com/pipeline/scratch/run-01/test.yaml",
      }),
    ).toThrow(DatasetValidationError);
  });

  test("unregistered quantityId in column fails naming dataset, column, and id", () => {
    const invalidYaml = VALID_DATASET_YAML.replace(
      'quantityId: "rmsDisplacement1d"',
      'quantityId: "nonExistentQuantityIdXYZ"',
    );
    expect(() => loadHistoricalDatasetFromYaml(invalidYaml)).toThrow(DatasetValidationError);
    try {
      loadHistoricalDatasetFromYaml(invalidYaml);
    } catch (err) {
      expect((err as DatasetValidationError).code).toBe("unregistered-quantity-id");
      expect((err as DatasetValidationError).message).toContain("nonExistentQuantityIdXYZ");
      expect((err as DatasetValidationError).message).toContain("Displacement");
    }
  });

  test("legacy spelling in column fails with legacySpellingMessage", () => {
    // electricField is a registered legacy spelling in legacy-spellings.yaml
    const legacyYaml = VALID_DATASET_YAML.replace(
      'quantityId: "rmsDisplacement1d"',
      'quantityId: "electricField"',
    );
    expect(() => loadHistoricalDatasetFromYaml(legacyYaml)).toThrow(DatasetValidationError);
    try {
      loadHistoricalDatasetFromYaml(legacyYaml);
    } catch (err) {
      expect((err as DatasetValidationError).code).toBe("legacy-spelling-quantity-id");
      expect((err as DatasetValidationError).message).toContain("electricField");
    }
  });

  test("CSV digest mismatch fails with csv-digest-mismatch", () => {
    expect(() =>
      loadHistoricalDatasetFromYaml(VALID_DATASET_YAML, {
        expectedCsvDigest: "abcdef123456",
        csvContent: "col1,col2\n1,2",
      }),
    ).toThrow(DatasetValidationError);
  });

  test("uncited dataset fails with missing-publication-citation", () => {
    const uncitedYaml = VALID_DATASET_YAML.replace(
      'citation: "Perrin, J. (1909). Annales de Chimie et de Physique 18: 5-114."',
      "# citation omitted",
    );
    expect(() => loadHistoricalDatasetFromYaml(uncitedYaml)).toThrow(ExperimentValidationError);
    try {
      loadHistoricalDatasetFromYaml(uncitedYaml);
    } catch (err) {
      expect((err as ExperimentValidationError).code).toBe("missing-publication-citation");
    }
  });

  test("missing table/figure number on locator fails with missing-table-figure-number", () => {
    const missingNumberYaml = VALID_DATASET_YAML.replace("number: 1", "# number omitted");
    expect(() => loadHistoricalDatasetFromYaml(missingNumberYaml)).toThrow(
      ExperimentValidationError,
    );
    try {
      loadHistoricalDatasetFromYaml(missingNumberYaml);
    } catch (err) {
      expect((err as ExperimentValidationError).code).toBe("missing-table-figure-number");
    }
  });
});
