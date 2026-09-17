import { describe, expect, test } from "bun:test";
import type { HistoricalDataset } from "../content/schemas/experiment.ts";
import { projectReception } from "../reader/faces/results/resultsProjection.ts";

/**
 * am-read-results-face-uzh: reception renders addressesResults[] from HistoricalDataset records.
 * "A card with no reception entries shows nothing" is the bead's own rule and is exercised here
 * by simply returning an empty array, which ResultCard renders as no section at all.
 *
 * Only `id`, `title`, `evidenceStatus`, and `addressesResults` are real for this test's purpose
 * (projectReception reads nothing else); the many other required HistoricalDataset fields
 * (publications, digitizer, columns, ...) are irrelevant here, so the fixture is cast rather
 * than fully populated.
 */
function fixtureDataset(
  id: string,
  addressesResults: readonly { resultId: string; relation: string; statement: string }[],
) {
  return {
    id,
    title: `${id} title`,
    evidenceStatus: "historical-measurement" as const,
    addressesResults,
  } as unknown as HistoricalDataset;
}

describe("resultsProjection.reception: from HistoricalDataset.addressesResults[]", () => {
  test("collects entries whose addressesResults names this resultId, with the dataset's own date and precision", () => {
    const perrin = fixtureDataset("perrin-1908-sedimentation", [
      {
        resultId: "bm-04-displacement-law",
        relation: "tested-a-prediction",
        statement: "Perrin's sedimentation-equilibrium counts test the same diffusion law.",
      },
    ]);
    const entries = projectReception("bm-04-displacement-law", [perrin], () => ({
      date: "1908-1909",
      precision: "range",
    }));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      datasetId: "perrin-1908-sedimentation",
      relation: "tested-a-prediction",
      statement: "Perrin's sedimentation-equilibrium counts test the same diffusion law.",
      date: "1908-1909",
      precision: "range",
    });
  });

  test("a dataset whose addressesResults names a different resultId contributes nothing", () => {
    const other = fixtureDataset("unrelated-1920", [
      { resultId: "some-other-result", relation: "tested-a-prediction", statement: "n/a" },
    ]);
    expect(
      projectReception("bm-04-displacement-law", [other], () => ({
        date: "1920",
        precision: "year",
      })),
    ).toEqual([]);
  });

  test("a dataset with no addressesResults at all is skipped without error", () => {
    const bare = {
      id: "no-addresses",
      title: "x",
      evidenceStatus: "historical-measurement" as const,
    } as unknown as HistoricalDataset;
    expect(
      projectReception("bm-04-displacement-law", [bare], () => ({
        date: "1920",
        precision: "year",
      })),
    ).toEqual([]);
  });

  test("no datasets at all yields an empty reception list, which the card renders as no section", () => {
    expect(
      projectReception("bm-04-displacement-law", [], () => ({ date: "1920", precision: "year" })),
    ).toEqual([]);
  });

  test("multiple datasets addressing the same result each contribute their own entry", () => {
    const a = fixtureDataset("a", [
      { resultId: "r", relation: "tested-a-prediction", statement: "s1" },
    ]);
    const b = fixtureDataset("b", [
      { resultId: "r", relation: "narrowed-the-domain", statement: "s2" },
    ]);
    const entries = projectReception("r", [a, b], () => ({ date: "1910", precision: "year" }));
    expect(entries.map((e) => e.datasetId)).toEqual(["a", "b"]);
  });
});
