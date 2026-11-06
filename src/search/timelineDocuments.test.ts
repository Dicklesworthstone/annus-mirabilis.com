import { describe, expect, test } from "bun:test";
import { loadTimeline } from "../discovery/timeline/records.ts";
import { searchResultHref } from "./core.ts";
import { timelineDocuments } from "./timelineDocuments.ts";

const entries = loadTimeline().entries;
const documents = timelineDocuments(entries, "scaffold");

describe("the reader's chronology is searchable", () => {
  test("each real dated entry gets exactly one result at its public anchor", () => {
    expect(entries.length).toBeGreaterThan(0);
    expect(documents.map((document) => document.id).sort()).toEqual(
      entries.map((entry) => `timeline:${entry.id}`).sort(),
    );
    for (const document of documents) {
      const entry = entries.find((candidate) => `timeline:${candidate.id}` === document.id);
      expect(entry).toBeDefined();
      expect(document.type).toBe("timeline");
      expect(searchResultHref(document)).toBe(`/timeline/#t-${entry?.id}`);
      expect(document.paper).toBe(entry?.paper);
      expect(document.text).toContain(entry?.summary ?? "");
      if (entry?.limits) expect(document.text).toContain(entry.limits);
      for (const source of entry?.sources ?? []) {
        expect(document.text).toContain(source.title);
        if (source.locator) expect(document.terms).toContain(source.locator);
      }
    }
    console.info(
      `[timeline search] ${documents.length} documents / ${entries.length} dated entries`,
    );
  });

  test("a received day, a published day and a month-only date-line stay distinct", () => {
    const byId = new Map(documents.map((document) => [document.id, document]));
    const manuscript = byId.get("timeline:mass-energy-date-line");
    expect(manuscript?.title).toContain("Manuscript date-line September 1905");
    expect(manuscript?.scopeLabel).toContain("month precision");
    expect(manuscript?.terms.join(" ")).not.toContain("1905-09-01");
    expect(byId.get("timeline:mass-energy-received")?.title).toContain(
      "Received by the journal 27 September 1905",
    );
    expect(byId.get("timeline:mass-energy-issue-publication")?.title).toContain(
      "Issue published 21 November 1905",
    );
  });

  test("later evidence keeps its scope and qualification in a search result", () => {
    const millikan = documents.find(
      (document) => document.id === "timeline:millikan-1916-photoelectric-h",
    );
    expect(millikan?.scopeLabel).toContain("Later evidence");
    expect(millikan?.title).toContain("Published March 1916");
    expect(millikan?.scopeLabel).toContain("month precision");
    expect(millikan?.text).toContain(
      entries.find((entry) => entry.id === "millikan-1916-photoelectric-h")?.limits ??
        "missing limits",
    );
  });

  test("entry order does not change the generated index", () => {
    expect(timelineDocuments([...entries].reverse(), "scaffold")).toEqual(documents);
  });

  test("the chronology inherits the source cards' stricter-profile search exclusion", () => {
    expect(timelineDocuments(entries, "preview")).toEqual([]);
    expect(timelineDocuments(entries, "launch")).toEqual([]);
  });
});
