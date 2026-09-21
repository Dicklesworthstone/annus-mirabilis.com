import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test, { describe } from "node:test";
import { DatasetValidationError, loadHistoricalDatasetFromYaml } from "./loader.ts";

describe("datasets loader refusal throw sites (am-muyh)", () => {
  const fixtureYaml = readFileSync(
    resolve(process.cwd(), "content/datasets/fixture-dataset.yaml"),
    "utf8",
  );

  describe("pipeline-only-dataset-rejected (loader.ts:49)", () => {
    test("reject: (loader.ts:49) throws pipeline-only-dataset-rejected when dataset is loaded from a pipeline directory", () => {
      assert.throws(
        () => {
          loadHistoricalDatasetFromYaml(fixtureYaml, {
            sourcePath: "/home/agent/projects/annus-mirabilis.com/data/pipeline/raw-dataset.yaml",
            checkQuantityRegistry: false,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof DatasetValidationError);
          assert.equal(err.code, "pipeline-only-dataset-rejected");
          assert.ok(err.message.includes("pipeline directory"));
          return true;
        },
      );
    });

    test("accept: canonical dataset path under content/datasets/ loads cleanly", () => {
      const dataset = loadHistoricalDatasetFromYaml(fixtureYaml, {
        sourcePath: "content/datasets/fixture-dataset.yaml",
        checkQuantityRegistry: false,
      });
      assert.equal(dataset.id, "fixture-dataset");
    });
  });

  // A dataset carrying a FIT, which the pipeline fixture does not. The quantity-id check runs
  // twice in this loader: once over columns (70 and 77) and once over every fit parameter (98
  // and 105). The second pair had no test at all - measured on 2026-09-21 by renaming each
  // site's code to a sentinel and running every dataset suite, which stayed green - because
  // no fixture in the tree reached a fit parameter with a bad id. The column pair is driven
  // from datasetLoader.test.ts and now carries its line citations there.
  const FIT_DATASET_YAML = `id: fit-refusal-fixture
title: "Fit Refusal Fixture"
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
    label: "Linear least-squares fit across both points"
    fitObjective: "linear-least-squares"
    analysisDate:
      type: issue-publication
      text: "2027-03-04"
      earliest: "2027-03-04"
      latest: "2027-03-04"
      precision: day
      source: "Editorial team"
      verifiedAt: "2026-09-16"
    rowsUsed: [0, 1]
    rowsExcluded: []
    parameters:
      - name: "slope"
        quantityId: "mobility"
        value: 2.0
        unit: "s/kg"
        source: "fitted-here"
`;

  describe("quantity ids inside a FIT PARAMETER (loader.ts:98 and loader.ts:105)", () => {
    test("accept: (loader.ts:98, loader.ts:105) a fit whose parameter id is registered loads", () => {
      // The denominator. Without this, a fixture that failed validation earlier for an
      // unrelated reason would make both refusal tests below pass for the wrong reason.
      const ds = loadHistoricalDatasetFromYaml(FIT_DATASET_YAML);
      assert.equal(ds.fits?.length, 1);
      assert.equal(ds.fits?.[0]?.parameters[0]?.quantityId, "mobility");
    });

    test("reject: (loader.ts:98) a legacy spelling in a fit parameter is refused, naming the fit and the parameter", () => {
      const legacyYaml = FIT_DATASET_YAML.replace(
        'quantityId: "mobility"',
        'quantityId: "electricField"',
      );
      assert.throws(
        () => loadHistoricalDatasetFromYaml(legacyYaml),
        (err: unknown) => {
          assert.ok(err instanceof DatasetValidationError);
          assert.equal(err.code, "legacy-spelling-quantity-id");
          // The column site at 70 emits the same code. These two are told apart by what the
          // message names: a column says which COLUMN, a fit parameter says which FIT and
          // which PARAMETER. A merged emit would lose the fit id and pass a code-only check.
          assert.ok(err.message.includes("fit-01"), err.message);
          assert.ok(err.message.includes("slope"), err.message);
          assert.ok(err.message.includes("electricField"), err.message);
          return true;
        },
      );
    });

    test("reject: (loader.ts:105) an unregistered id in a fit parameter is refused, naming the fit and the parameter", () => {
      const unknownYaml = FIT_DATASET_YAML.replace(
        'quantityId: "mobility"',
        'quantityId: "nonExistentQuantityIdXYZ"',
      );
      assert.throws(
        () => loadHistoricalDatasetFromYaml(unknownYaml),
        (err: unknown) => {
          assert.ok(err instanceof DatasetValidationError);
          assert.equal(err.code, "unregistered-quantity-id");
          assert.ok(err.message.includes("fit-01"), err.message);
          assert.ok(err.message.includes("slope"), err.message);
          assert.ok(err.message.includes("nonExistentQuantityIdXYZ"), err.message);
          return true;
        },
      );
    });

    test("reject: (loader.ts:98, loader.ts:105) a legacy spelling is NOT reported as unregistered", () => {
      // The negative that separates the two sites. A loader that dropped the legacy branch
      // would still refuse the file, with a code that sends the author looking for a
      // quantity that does not exist instead of telling them what to rename it to.
      const legacyYaml = FIT_DATASET_YAML.replace(
        'quantityId: "mobility"',
        'quantityId: "electricField"',
      );
      try {
        loadHistoricalDatasetFromYaml(legacyYaml);
        assert.fail("expected a refusal");
      } catch (err) {
        assert.ok(err instanceof DatasetValidationError);
        assert.notEqual(err.code, "unregistered-quantity-id");
      }
    });

    test("reject: (loader.ts:98, loader.ts:105) checkQuantityRegistry false skips BOTH fit sites", () => {
      // The switch these two sites sit behind, asserted once. An id check that ran anyway
      // would make the pipeline's own intermediate records unloadable.
      const unknownYaml = FIT_DATASET_YAML.replace(
        'quantityId: "mobility"',
        'quantityId: "nonExistentQuantityIdXYZ"',
      );
      const ds = loadHistoricalDatasetFromYaml(unknownYaml, { checkQuantityRegistry: false });
      assert.equal(ds.fits?.[0]?.parameters[0]?.quantityId, "nonExistentQuantityIdXYZ");
    });
  });
});
