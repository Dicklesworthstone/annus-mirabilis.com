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

  // Two more dataset-record-invalid sites, neither of which any fixture drove.
  // The scanner counts by THROW SITE, not by code: one test naming a code
  // covers at most one of the three, so the code being named once left the
  // other two uncovered and correctly reported (am-kfkw).
  test("a dataset whose file id disagrees with the scenario's datasetId is dataset-record-invalid", () => {
    const path = join(dir, "self-test-dataset-admitted.yaml");
    // The same fixture that passes under its own id. Only the id asked for
    // differs, so the refusal is attributable to the disagreement and not to
    // anything about the record.
    const admitted = checkDatasetInference(path, "self-test-dataset-admitted", "selfTest.constant");
    expect(admitted.ok).toBe(true);

    const check = checkDatasetInference(path, "self-test-dataset-mismatched", "selfTest.constant");
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.code).toBe("dataset-record-invalid");
      expect(check.message).toContain("self-test-dataset-admitted");
      expect(check.message).toContain("self-test-dataset-mismatched");
      expect(check.allowed).toBe(null);
    }
  });

  test("a file that is not a historical dataset record is dataset-record-invalid", () => {
    // A real YAML file that parses and is not a dataset. The refusal must come
    // from validateHistoricalDataset rejecting it, not from a parse error, so
    // the message carries the validator's own reason.
    const path = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "content",
      "quantities",
      "constant-sets",
      "modern-si-2019.yaml",
    );
    const check = checkDatasetInference(path, "modern-si-2019", "selfTest.constant");
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.code).toBe("dataset-record-invalid");
      expect(check.message).toContain("failed record validation");
      expect(check.allowed).toBe(null);
    }
  });
});
