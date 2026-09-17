import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runFixtureDigitization } from "../../../scripts/digitize-datasets/fixture-dataset/digitize.ts";
import { loadHistoricalDatasetFromYaml } from "../../content/datasets/loader.ts";
import { validateHistoricalDataset } from "../../content/schemas/experiment.ts";
import { getLogger } from "../log/logger.ts";

const logger = getLogger("datasets");
const BEAD_ID = "am-inst-dataset-overlay-ra9r";

describe("digitizePipelineFixture (am-inst-dataset-overlay-ra9r)", () => {
  afterAll(async () => {
    await logger.flush();
  });

  test("runs the fixture pipeline end-to-end, writing and validating the canonical record", () => {
    const result = runFixtureDigitization();

    expect(result.dataset.id).toBe("fixture-dataset");
    expect(result.passedSpotCheck).toBe(true);
    expect(result.csvDigest).toBeDefined();

    // Verify written YAML file
    const yamlContent = readFileSync(result.yamlPath, "utf8");
    const loaded = loadHistoricalDatasetFromYaml(yamlContent, {
      expectedCsvDigest: result.csvDigest,
      csvContent: result.canonicalCsv,
    });

    expect(loaded.id).toBe("fixture-dataset");
    expect(loaded.columns.length).toBe(2);
    expect(loaded.rows.length).toBe(3);
    expect(loaded.allowedInferenceModelIds).toEqual(["evaluateStokesEinstein"]);

    // Validate directly against schema
    expect(() => validateHistoricalDataset(loaded)).not.toThrow();

    logger.log({
      testId: "digitize-pipeline-fixture-e2e",
      beadId: BEAD_ID,
      outcome: "passed",
      message:
        "Digitization pipeline template and validation harness exercised end-to-end by fixture dataset",
      extra: {
        datasetId: loaded.id,
        csvDigest: result.csvDigest,
        toolRunId: result.toolRunId,
        rowCount: loaded.rows.length,
        columnRoles: loaded.columns.map((c) => c.role),
        allowedInferenceModelCount: loaded.allowedInferenceModelIds.length,
        digitizationRevision: loaded.digitizer.digitizationRevision,
      },
    });
  });
});
