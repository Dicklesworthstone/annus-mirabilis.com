import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { loadHistoricalDataset } from "../datasets/loader.ts";
import type { HistoricalDataset } from "../schemas/experiment.ts";
import { checkReceptionTargets, loadReceptionDatasets, receptionPublication } from "./reception.ts";

const root = process.cwd();
const measured = loadHistoricalDataset(resolve(root, "content/datasets/millikan-1916-sodium.yaml"));
const targetIds = new Set(["lq-photoelectric-energy"]);

describe("source-backed later evidence for result cards", () => {
  test("the canonical corpus resolves its real result and excludes the withdrawn fixture", () => {
    const datasets = loadReceptionDatasets(root);
    expect(datasets.some((dataset) => dataset.id === measured.id)).toBe(true);
    expect(datasets.some((dataset) => dataset.id === "fixture-dataset")).toBe(false);
    expect(() => checkReceptionTargets([measured], targetIds)).not.toThrow();
  });

  test("result-reception-target-missing rejects a stale target instead of silently losing the join", () => {
    const stale: HistoricalDataset = {
      ...measured,
      addressesResults: [
        {
          resultId: "result-lq-08-linear-stopping",
          relation: "tested-a-prediction",
          statement: "A stale result identifier must not disappear silently.",
        },
      ],
    };
    expect(() => checkReceptionTargets([stale], targetIds)).toThrow("result-lq-08-linear-stopping");
    try {
      checkReceptionTargets([stale], targetIds);
    } catch (error) {
      expect((error as { rule: string }).rule).toBe("result-reception-target-missing");
    }
    expect(() => checkReceptionTargets([measured], targetIds)).not.toThrow();
  });

  test("withdrawn entries cannot create reception claims or dangling-target failures", () => {
    const withdrawn = {
      ...measured,
      evidenceStatus: "withdrawn",
      withdrawal: { date: "2026-11-10", reason: "Synthetic test withdrawal." },
    } as HistoricalDataset;
    expect(() => checkReceptionTargets([withdrawn], new Set())).not.toThrow();
  });

  test("uses March 1916 publication precision and Figure 6, not the digitizer's 2026 date", () => {
    const publication = receptionPublication(measured, root);
    expect(publication.date).toBe("March 1916");
    expect(publication.precision).toBe("month");
    expect(publication.sourceLocator).toBe("Figure 6");
    expect(publication.citation).toContain("A Direct Photoelectric Determination");
    expect(publication.citation).not.toBe("cit-millikan-1916");
    expect(publication.sourceHref).toBe(measured.rights.source);
  });

  test("result-reception-publication-missing refuses an unresolved primary publication", () => {
    expect(() =>
      receptionPublication({ ...measured, primaryPublicationId: "missing" }, root),
    ).toThrow("primary publication does not resolve");
    try {
      receptionPublication({ ...measured, primaryPublicationId: "missing" }, root);
    } catch (error) {
      expect((error as { rule: string }).rule).toBe("result-reception-publication-missing");
    }
  });

  test("dates without a prose label preserve their recorded month or interval", () => {
    const unlabeled: HistoricalDataset = {
      ...measured,
      publications: measured.publications.map((publication) => ({
        ...publication,
        publicationDate: { ...publication.publicationDate, text: undefined },
      })),
    };
    expect(receptionPublication(unlabeled, root).date).toBe("March 1916");
    const interval: HistoricalDataset = {
      ...unlabeled,
      publications: unlabeled.publications.map((publication) => ({
        ...publication,
        publicationDate: {
          ...publication.publicationDate,
          precision: "range",
          earliest: "1915-12-01",
          latest: "1916-03-31",
        },
      })),
    };
    expect(receptionPublication(interval, root).date).toBe("1915-12-01 to 1916-03-31");
    expect(receptionPublication(interval, root).precision).toBe("range");
  });

  test("a non-web rights source remains text and never becomes an executable link", () => {
    for (const source of ["javascript:alert(1)", "data:text/html,example", "source held locally"]) {
      const publication = receptionPublication(
        { ...measured, rights: { ...measured.rights, source } },
        root,
      );
      expect(publication.sourceHref).toBeUndefined();
    }
  });
});
