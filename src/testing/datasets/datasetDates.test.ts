import { describe, expect, test } from "bun:test";
import { getDatasetShelfStatus } from "../../content/datasets/shelf.ts";
import {
  ExperimentValidationError,
  validateHistoricalDataset,
} from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";

const DATES_FIXTURE_YAML = `id: dates-fixture-dataset
title: "Dates Test Dataset"
evidenceStatus: historical-measurement
publications:
  - id: pub-1
    citation: "Millikan 1916 Paper"
    locator:
      kind: table
      number: 1
    publicationDate:
      type: issue-publication
      text: "March 1916"
      earliest: "1916-03-01"
      latest: "1916-03-31"
      precision: month
      source: "Phys. Rev."
      verifiedAt: "2026-09-16"
primaryPublicationId: pub-1
series:
  - id: series-1
    publicationId: pub-1
    observationDate:
      type: issue-publication
      text: "1915"
      earliest: "1915-01-01"
      latest: "1915-12-31"
      precision: year
      source: "Lab notebooks"
      verifiedAt: "2026-09-16"
    description: "Sodium stopping potential series"
digitizer:
  name: "Editorial Team"
  method: "Keying"
  date: "2026-09-16"
  sourcePageImage: "millikan-1916.png"
  digitizationRevision: 1
columns:
  - name: "Frequency"
    quantityId: "frequency"
    unit: "Hz"
    role: "controlled"
  - name: "Potential"
    quantityId: "electricPotential"
    unit: "V"
    role: "observed"
rows:
  - seriesId: series-1
    cells:
      - kind: number
        value: 5e14
      - kind: number
        value: 1.2
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
  - id: fit-h-slope
    seriesId: series-1
    label: "Planck constant slope fit"
    fitObjective: "linear-least-squares"
    analysisDate:
      type: issue-publication
      text: "2027-03-04"
      earliest: "2027-03-04"
      latest: "2027-03-04"
      precision: day
      source: "Modern analysis"
      verifiedAt: "2026-09-16"
    rowsUsed: [0]
    rowsExcluded: []
    parameters:
      - name: "h"
        quantityId: "planckConstant"
        value: 6.57e-34
        unit: "J s"
        source: "fitted-here"
`;

describe("datasetDates (am-inst-dataset-overlay-ra9r)", () => {
  test("validates observationDate, publicationDate, and analysisDate and determines shelf status", () => {
    const raw = strictParse(DATES_FIXTURE_YAML, "yaml");
    const ds = validateHistoricalDataset(raw);

    const pub = ds.publications[0];
    expect(pub?.publicationDate.latest).toBe("1916-03-31");

    const ser = ds.series?.[0];
    expect(ser?.observationDate?.earliest).toBe("1915-01-01");

    const fit = ds.fits?.[0];
    expect(fit?.analysisDate.earliest).toBe("2027-03-04");

    const shelf = getDatasetShelfStatus(ds, "series-1");
    expect(shelf.eligible).toBe(false);
    expect(shelf.badgeLabel).toBe("later evidence, published 1916");
  });

  test("a fixture that omits analysisDate on a fits entry fails", () => {
    const raw = strictParse(DATES_FIXTURE_YAML, "yaml") as Record<string, unknown>;
    const fits = raw.fits as Array<Record<string, unknown>>;
    if (fits[0]) delete fits[0].analysisDate;
    expect(() => validateHistoricalDataset(raw)).toThrow(ExperimentValidationError);
    try {
      validateHistoricalDataset(raw);
    } catch (err) {
      expect((err as ExperimentValidationError).code).toBe("missing-analysis-date");
    }
  });

  test("a fixture whose observationDate is later than its publicationDate fails", () => {
    const raw = strictParse(DATES_FIXTURE_YAML, "yaml") as Record<string, unknown>;
    const series = raw.series as Array<Record<string, unknown>>;
    const obs = series[0]?.observationDate as Record<string, unknown>;
    obs.earliest = "1920-01-01";
    obs.latest = "1920-12-31";
    obs.precision = "year";
    expect(() => validateHistoricalDataset(raw)).toThrow(ExperimentValidationError);
    try {
      validateHistoricalDataset(raw);
    } catch (err) {
      expect((err as ExperimentValidationError).code).toBe("observation-after-publication");
    }
  });
});
