import { describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDatasetInference } from "./scenario-registry/datasetInference.ts";

const dir = join(dirname(fileURLToPath(import.meta.url)), "scenario-fixtures/datasets");

describe("dataset inference admission", () => {
  test("an admitted model passes", () => {
    const path = join(dir, "self-test-dataset-admitted.yaml");
    const check = checkDatasetInference(path, "self-test-dataset-admitted", "selfTest.constant");
    expect(check.ok).toBe(true);
  });

  test("a model outside the list is refused with dataset-inference-not-admitted", () => {
    const path = join(dir, "self-test-dataset-outside.yaml");
    const check = checkDatasetInference(
      path,
      "self-test-dataset-outside",
      "selfTest.timesTwoClosed",
    );
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.code).toBe("dataset-inference-not-admitted");
      expect(check.message.includes("self-test-dataset-outside")).toBe(true);
      expect(check.message.includes("selfTest.timesTwoClosed")).toBe(true);
    }
  });

  test("an empty admitted list refuses every inference", () => {
    const path = join(dir, "self-test-dataset-empty.yaml");
    const check = checkDatasetInference(path, "self-test-dataset-empty", "selfTest.constant");
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.message.includes("display and citation only")).toBe(true);
  });

  test("an absent list is a dataset-record validation failure", () => {
    const path = join(dir, "self-test-dataset-absent.yaml");
    const check = checkDatasetInference(path, "self-test-dataset-absent", "selfTest.constant");
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.code).toBe("dataset-record-invalid");
  });
});
