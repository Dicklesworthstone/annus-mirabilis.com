import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { loadProvenanceReceipts } from "../../content/provenance/loadReceipts.ts";
import Sources from "./page";

/**
 * /sources/ against the real receipts. Properties, not a census: the receipts grow, and every
 * assertion below holds at any count.
 */
const html = renderToStaticMarkup(<Sources />);
const receipts = loadProvenanceReceipts().receipts.flatMap(({ key, receipt }) =>
  receipt ? [{ key, fm: receipt.frontMatter }] : [],
);
const entries = html.split('<li class="sources-entry">').slice(1);

describe("/sources/", () => {
  test("one entry per provenance receipt, in the order the journal published them", () => {
    // Guard first: an empty receipt set would pass every loop below by skipping it.
    expect(receipts.length).toBeGreaterThan(0);
    expect(entries.length).toBe(receipts.length);
    const published = receipts
      .map(({ fm }) => ({
        title: fm.paper.titleGerman,
        at: fm.paper.dates.find((d) => d.type === "issue-publication")?.iso ?? "",
      }))
      .sort((a, b) => a.at.localeCompare(b.at));
    published.forEach(({ title }, index) => {
      expect(entries[index]).toContain(title.replace(/&/g, "&amp;"));
    });
  });

  test("every entry carries its receipt's full digest and a DOI link", () => {
    for (const { fm } of receipts) {
      const entry = entries.find((e) => e.includes(fm.scan.sha256));
      expect(entry).toBeDefined();
      expect(entry).toContain(`href="https://doi.org/${fm.paper.journal.doi}"`);
    }
  });

  test("a download link names a file this site serves", () => {
    const hrefs = [
      ...html.matchAll(/<a href="(\/papers\/pdfs\/[^"]+)">Download the scan<\/a>/g),
    ].map((m) => m[1] as string);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(existsSync(join("public", href))).toBe(true);
  });

  test("the transcription line follows the files, not the copy", () => {
    for (const { key, fm } of receipts) {
      const entry = entries.find((e) => e.includes(fm.scan.sha256)) ?? "";
      const dir = join("public", "papers", "transcripts");
      const expected = existsSync(join(dir, `${key}-reviewed.txt`))
        ? "Transcribed and reviewed"
        : existsSync(join(dir, `${key}-machine-draft.txt`))
          ? "Transcribed in draft"
          : "Not yet transcribed";
      expect(entry).toContain(expected);
    }
  });

  test("no em dash in the page's text", () => {
    expect(html.replace(/<[^>]+>/g, "")).not.toContain("—");
  });
});
