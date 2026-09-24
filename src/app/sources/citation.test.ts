import { describe, expect, test } from "bun:test";
import { historicalArticle } from "../../content/exports/scholarly.ts";
import { loadProvenanceReceipts } from "../../content/provenance/loadReceipts.ts";
import { citationOf } from "./citation.ts";

/**
 * The human citation on /sources/ and the machine-readable record on each paper page carry the
 * same values (am-scholarly-metadata-mjrx). Every value is read here from the record, never retyped,
 * so a change to either side that drifts from the other fails.
 */
const receipts = loadProvenanceReceipts().receipts.flatMap(({ receipt }) =>
  receipt ? [receipt.frontMatter] : [],
);

type Json = Record<string, unknown>;

describe("citation parity", () => {
  test("each citation carries the record's author, title, journal, volume, issue, pages, year and DOI", () => {
    // Guard: an empty receipt set would pass the loop below by skipping it.
    expect(receipts.length).toBeGreaterThan(0);
    for (const fm of receipts) {
      const a = historicalArticle(fm) as Json;
      const issue = a.isPartOf as Json;
      const volume = issue.isPartOf as Json;
      const periodical = volume.isPartOf as Json;
      const series = (volume.additionalProperty as Json[]).find((p) => p.name === "series")?.value;
      const line = citationOf(fm);
      // Anchored with their delimiters: a bare issue number such as "6" is found inside a DOI or a
      // page range, so an unanchored check passed with the issue dropped from the citation.
      expect(line.startsWith(`${(a.author as Json).name}, \u201e${a.name}\u201c, `)).toBe(true);
      expect(line).toContain(`\u201c, ${periodical.name} (${series}) ${volume.volumeNumber}, `);
      expect(
        line.endsWith(
          `, no. ${issue.issueNumber}, ${a.pageStart}\u2013${a.pageEnd} (${String(a.datePublished).slice(0, 4)}). doi:${(a.identifier as Json).value}`,
        ),
      ).toBe(true);
    }
  });

  test("the fourth paper cites its 1905 DOI, never the 2005 reissue's", () => {
    const paper4 = receipts.find((fm) => fm.key === "ap-18-639");
    expect(paper4).toBeDefined();
    const line = citationOf(paper4 as NonNullable<typeof paper4>);
    expect(line).toContain("doi:10.1002/andp.19053231314");
    expect(line).not.toContain("10.1002/andp.200590007");
  });
});
