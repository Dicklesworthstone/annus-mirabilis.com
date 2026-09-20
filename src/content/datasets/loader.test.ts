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
});
