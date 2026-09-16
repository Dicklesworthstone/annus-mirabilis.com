import { describe, expect, test } from "bun:test";
import {
  DatasetValidationError,
  loadHistoricalDatasetFromYaml,
} from "../../content/datasets/loader.ts";
import { legacySpellingMessage } from "../../content/quantities/resolveQuantityId.ts";

const BASE_YAML = `id: quantity-test-dataset
title: "Quantity ID Test"
evidenceStatus: historical-measurement
publications:
  - id: pub-1
    citation: "Citation (1909)"
    locator: { kind: table, number: 1 }
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
  name: "Editorial Team"
  method: "Keying"
  date: "2026-09-16"
  sourcePageImage: "test.png"
  digitizationRevision: 1
columns:
  - name: "Target Col"
    quantityId: TARGET_QTY_ID
    unit: "m"
    role: "observed"
rows:
  - cells:
      - kind: number
        value: 1
uncertainty: { type: none, description: "none" }
notes: "test"
rights:
  status: public-domain-verified
  statement: "test"
  source: "test"
  recordedAt: "2026-09-16"
  reuseTerms: unrestricted-scholarly
allowedInferenceModelIds: []
`;

describe("datasetQuantityIds (am-inst-dataset-overlay-ra9r)", () => {
  test("resolves canonical quantity ids against the real registry", () => {
    const yaml = BASE_YAML.replace("TARGET_QTY_ID", "particleRadius");
    const ds = loadHistoricalDatasetFromYaml(yaml);
    expect(ds.columns[0]?.quantityId).toBe("particleRadius");
  });

  test("unregistered quantity id fails with unregistered-quantity-id error naming dataset and column", () => {
    const yaml = BASE_YAML.replace("TARGET_QTY_ID", "completelyFakeQuantity12345");
    expect(() => loadHistoricalDatasetFromYaml(yaml)).toThrow(DatasetValidationError);
    try {
      loadHistoricalDatasetFromYaml(yaml);
    } catch (err) {
      const e = err as DatasetValidationError;
      expect(e.code).toBe("unregistered-quantity-id");
      expect(e.message).toContain("completelyFakeQuantity12345");
      expect(e.message).toContain("Target Col");
    }
  });

  test("legacy spelling fails with legacy-spelling-quantity-id and provides legacySpellingMessage", () => {
    // electricField is a registered legacy spelling
    const yaml = BASE_YAML.replace("TARGET_QTY_ID", "electricField");
    expect(() => loadHistoricalDatasetFromYaml(yaml)).toThrow(DatasetValidationError);
    try {
      loadHistoricalDatasetFromYaml(yaml);
    } catch (err) {
      const e = err as DatasetValidationError;
      expect(e.code).toBe("legacy-spelling-quantity-id");
      expect(e.message).toContain("electricField");
      expect(e.message).toContain(legacySpellingMessage("electricField"));
    }
  });
});
