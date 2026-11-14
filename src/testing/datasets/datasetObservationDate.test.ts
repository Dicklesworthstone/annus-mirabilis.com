import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDatasetShelfStatus } from "../../content/datasets/shelf.ts";
import {
  ExperimentValidationError,
  validateHistoricalDataset,
} from "../../content/schemas/experiment.ts";
import { strictParse } from "../../content/schemas/strictParse.ts";

const unavailable = Object.freeze({
  reason: "The source reports the observations but does not state when they were made.",
  source: "Fixture source, table 1 and its surrounding text.",
});
function fixture(evidence: Record<string, unknown>): Record<string, unknown> {
  const raw = strictParse(
    readFileSync(resolve(process.cwd(), "content/datasets/fixture-dataset.yaml"), "utf8"),
    "yaml",
  ) as Record<string, unknown>;
  return {
    ...raw,
    series: [
      {
        id: "undated-observations",
        publicationId: "pub-1900",
        description: "A constructed fixture for date provenance.",
        ...evidence,
      },
    ],
  };
}

describe("invalid-observation-date-availability", () => {
  test("accept: (experiment.ts:4161) preserves sourced absence without manufacturing a date or changing the shelf", () => {
    const record = validateHistoricalDataset(fixture({ observationDateUnavailable: unavailable }));
    expect(record.series?.[0]?.observationDateUnavailable).toEqual(unavailable);
    expect(record.series?.[0]?.observationDate).toBeUndefined();
    expect(record.publications[0]?.publicationDate.earliest).toBe("1900-01-01");
    expect(getDatasetShelfStatus(record).eligible).toBe(true);
    expect(Object.isFrozen(record.series?.[0]?.observationDateUnavailable)).toBe(true);
  });

  test("silent omission stays absent so the corpus audit can report it", () => {
    const record = validateHistoricalDataset(fixture({}));
    expect(record.series?.[0]?.observationDate).toBeUndefined();
    expect(record.series?.[0]?.observationDateUnavailable).toBeUndefined();
  });

  test("reject: (experiment.ts:4161) empty or unsourced explanations and a publication-date substitution alongside missingness", () => {
    const base = fixture({});
    const publicationDate = (base.publications as { publicationDate: unknown }[])[0]
      ?.publicationDate;
    assert(publicationDate);
    const malformed: Record<string, unknown>[] = [
      { observationDateUnavailable: null },
      { observationDateUnavailable: true },
      { observationDateUnavailable: { source: unavailable.source } },
      { observationDateUnavailable: { reason: unavailable.reason } },
      { observationDateUnavailable: { ...unavailable, reason: " " } },
      { observationDateUnavailable: { ...unavailable, source: " " } },
      { observationDateUnavailable: unavailable, observationDate: publicationDate },
    ];
    for (const evidence of malformed) {
      assert.throws(
        () => validateHistoricalDataset(fixture(evidence)),
        (error: unknown) => {
          assert(error instanceof ExperimentValidationError);
          assert.equal(error.code, "invalid-observation-date-availability");
          assert.match(error.message, /reason and source, never both/);
          return true;
        },
      );
    }
    expect(validateHistoricalDataset(fixture({ observationDateUnavailable: unavailable })).id).toBe(
      "fixture-dataset",
    );
  });
});
