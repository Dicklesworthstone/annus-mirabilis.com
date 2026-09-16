import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkDatasetInference } from "./scenario-registry/datasetInference.ts";

const dir = join(process.cwd(), "src/testing/scenario-fixtures/datasets");

function writeDataset(id: string, allowed: string[] | "absent"): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${id}.yaml`);
  const allowedBlock =
    allowed === "absent"
      ? ""
      : allowed.length === 0
        ? "allowedInferenceModelIds: []\n"
        : `allowedInferenceModelIds:\n${allowed.map((m) => `  - ${m}`).join("\n")}\n`;
  writeFileSync(
    path,
    `id: ${id}
title: Self-test dataset
evidenceStatus: historical-measurement
publications:
  - id: pub-1
    citation: cit-self-test
    locator: { kind: table, number: 1 }
    publicationDate:
      type: issue-publication
      text: "1909"
      earliest: "1909-01-01"
      latest: "1909-12-31"
      precision: year
      source: self-test
      verifiedAt: "2026-09-16"
primaryPublicationId: pub-1
digitizer:
  name: Self-test
  method: Hand-typed self-test table
  date: "2026-09-16"
  sourcePageImage: none.png
  digitizationRevision: 1
columns:
  - name: x
    quantityId: rmsDisplacement1d
    unit: m
    role: observed
rows:
  - cells:
      - kind: number
        value: 1
        originalToken: "1"
uncertainty:
  type: none
  description: Self-test table, not a measurement.
notes: Self-test.
rights:
  status: public-domain-verified
  statement: Self-test record.
  source: self-test
  recordedAt: "2026-09-16"
  reuseTerms: unrestricted-scholarly
${allowedBlock}calibrationIds: []
sharedInputIds: []
`,
  );
  return path;
}

describe("dataset inference admission", () => {
  test("an admitted model passes", () => {
    const path = writeDataset("self-test-dataset-admitted", ["selfTest.constant"]);
    const check = checkDatasetInference(path, "self-test-dataset-admitted", "selfTest.constant");
    expect(check.ok).toBe(true);
  });

  test("a model outside the list is refused with dataset-inference-not-admitted", () => {
    const path = writeDataset("self-test-dataset-outside", ["selfTest.constant"]);
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
    const path = writeDataset("self-test-dataset-empty", []);
    const check = checkDatasetInference(path, "self-test-dataset-empty", "selfTest.constant");
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.message.includes("display and citation only")).toBe(true);
  });

  test("an absent list is a dataset-record validation failure", () => {
    const path = writeDataset("self-test-dataset-absent", "absent");
    const check = checkDatasetInference(path, "self-test-dataset-absent", "selfTest.constant");
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.code).toBe("dataset-record-invalid");
  });
});
