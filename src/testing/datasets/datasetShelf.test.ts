import { describe, expect, test } from "bun:test";
import {
  assertDatasetShelfEligible,
  getDatasetShelfStatus,
  ShelfIneligibilityError,
} from "../../content/datasets/shelf.ts";
import { validateHistoricalDataset } from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";

const SPANNING_DATASET_YAML = `id: kaufmann-1901-1906
title: "Kaufmann Electron Deflection Series"
evidenceStatus: historical-measurement
publications:
  - id: pub-1903
    citation: "Kaufmann, W. (1903). Phys. Zeitschr. 4: 54-57."
    locator:
      kind: table
      number: 1
    publicationDate:
      type: issue-publication
      text: "1903"
      earliest: "1903-01-01"
      latest: "1903-12-31"
      precision: year
      source: "Phys. Zeitschr."
      verifiedAt: "2026-09-16"
  - id: pub-1906
    citation: "Kaufmann, W. (1906). Ann. Phys. 19: 487-553."
    locator:
      kind: table
      number: 3
    publicationDate:
      type: issue-publication
      text: "1906"
      earliest: "1906-01-01"
      latest: "1906-12-31"
      precision: year
      source: "Ann. Phys."
      verifiedAt: "2026-09-16"
primaryPublicationId: pub-1903
series:
  - id: series-1903
    publicationId: pub-1903
    description: "Pre-1905 measurements"
  - id: series-1906
    publicationId: pub-1906
    description: "Post-1905 reanalysis"
digitizer:
  name: "Editorial Team"
  method: "Keying"
  date: "2026-09-16"
  sourcePageImage: "kaufmann.png"
  digitizationRevision: 1
columns:
  - name: "Electric Deflection"
    quantityId: "electricFieldStationary"
    unit: "V/m"
    role: "controlled"
  - name: "Magnetic Deflection"
    quantityId: "magneticFieldStationary"
    unit: "T"
    role: "observed"
rows:
  - seriesId: series-1903
    cells:
      - kind: number
        value: 1000
      - kind: number
        value: 0.05
  - seriesId: series-1906
    cells:
      - kind: number
        value: 1200
      - kind: number
        value: 0.06
uncertainty:
  type: none
  description: "none"
notes: "Historical test series spanning 1904 cutoff"
rights:
  status: public-domain-verified
  statement: "Public domain"
  source: "test"
  recordedAt: "2026-09-16"
  reuseTerms: unrestricted-scholarly
allowedInferenceModelIds: []
`;

const DUAL_PUBLICATION_DATASET_YAML = `id: blackbody-1899-1901
title: "Blackbody Spectral Radiation Measurements"
evidenceStatus: historical-measurement
publications:
  - id: pub-1900-report
    citation: "Lummer & Pringsheim (1900). Verh. Dtsch. Phys. Ges. 2: 163-180."
    locator:
      kind: table
      number: 2
    publicationDate:
      type: issue-publication
      text: "October 1900"
      earliest: "1900-10-01"
      latest: "1900-10-31"
      precision: month
      source: "Verh. Dtsch. Phys. Ges."
      verifiedAt: "2026-09-16"
  - id: pub-1901-annalen
    citation: "Lummer & Pringsheim (1901). Ann. Phys. 6: 192-210."
    locator:
      kind: table
      number: 2
    publicationDate:
      type: issue-publication
      text: "1901"
      earliest: "1901-01-01"
      latest: "1901-12-31"
      precision: year
      source: "Ann. Phys."
      verifiedAt: "2026-09-16"
primaryPublicationId: pub-1900-report
digitizer:
  name: "Editorial Team"
  method: "Keying"
  date: "2026-09-16"
  sourcePageImage: "lummer.png"
  digitizationRevision: 1
columns:
  - name: "Wavelength"
    quantityId: "wavelength"
    unit: "m"
    role: "controlled"
  - name: "Intensity"
    quantityId: "spectralRadianceWavelength"
    unit: "W/(m² m sr)"
    role: "observed"
rows:
  - cells:
      - kind: number
        value: 1.5e-6
      - kind: number
        value: 100
uncertainty:
  type: none
  description: "none"
notes: "Value published both in 1900 and 1901"
rights:
  status: public-domain-verified
  statement: "Public domain"
  source: "test"
  recordedAt: "2026-09-16"
  reuseTerms: unrestricted-scholarly
allowedInferenceModelIds: []
`;

describe("datasetShelf (am-inst-dataset-overlay-ra9r)", () => {
  test("a fixture dataset with one 1903 series and one 1906 series: 1903 passes, 1906 fails with named error", () => {
    const raw = strictParse(SPANNING_DATASET_YAML, "yaml");
    const ds = validateHistoricalDataset(raw);

    // 1903 series passes shelf assertion
    const status1903 = assertDatasetShelfEligible(ds, "series-1903");
    expect(status1903.eligible).toBe(true);
    expect(status1903.publicationYear).toBe("1903");
    expect(status1903.badgeLabel).toBeUndefined();

    // 1906 series fails shelf assertion with named error
    expect(() => assertDatasetShelfEligible(ds, "series-1906")).toThrow(ShelfIneligibilityError);
    try {
      assertDatasetShelfEligible(ds, "series-1906");
    } catch (err) {
      expect((err as ShelfIneligibilityError).code).toBe("shelf-dataset-ineligible");
      expect((err as ShelfIneligibilityError).datasetId).toBe("kaufmann-1901-1906");
      expect((err as ShelfIneligibilityError).seriesId).toBe("series-1906");
      expect((err as ShelfIneligibilityError).publicationYear).toBe("1906");
      expect((err as ShelfIneligibilityError).message).toContain("1906");
      expect((err as ShelfIneligibilityError).message).toContain("1904-12-31");
    }

    // Direct status evaluation on series
    const rawStatus1906 = getDatasetShelfStatus(ds, "series-1906");
    expect(rawStatus1906.eligible).toBe(false);
    expect(rawStatus1906.badgeLabel).toBe("later evidence, published 1906");
  });

  test("a value published in both 1900 and 1901 is eligible only through the 1900 citation", () => {
    const raw = strictParse(DUAL_PUBLICATION_DATASET_YAML, "yaml");
    const ds = validateHistoricalDataset(raw);

    // Eligible through 1900 citation
    const status1900 = assertDatasetShelfEligible(ds, undefined, "pub-1900-report");
    expect(status1900.eligible).toBe(true);
    expect(status1900.publicationYear).toBe("1900");

    // Ineligible when cited through 1901 Annalen paper
    expect(() => assertDatasetShelfEligible(ds, undefined, "pub-1901-annalen")).toThrow(
      ShelfIneligibilityError,
    );
    try {
      assertDatasetShelfEligible(ds, undefined, "pub-1901-annalen");
    } catch (err) {
      expect((err as ShelfIneligibilityError).code).toBe("shelf-dataset-ineligible");
      expect((err as ShelfIneligibilityError).publicationId).toBe("pub-1901-annalen");
      expect((err as ShelfIneligibilityError).publicationYear).toBe("1901");
    }
  });
});
