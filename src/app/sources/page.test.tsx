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

  test("each entry shows its own scan's first page, at every width its srcSet names", () => {
    // The plate is cut from the entry's pinned PDF (scripts/figures/first_page_plates.py); an
    // entry must never borrow another scan's page, or name a width that was not cut.
    for (const { key, fm } of receipts) {
      const entry = entries.find((e) => e.includes(fm.scan.sha256)) ?? "";
      const srcSet = /class="sources-entry-plate"[^>]*srcSet="([^"]+)"/.exec(entry)?.[1] ?? "";
      const files = srcSet.split(", ").map((candidate) => candidate.split(" ")[0] ?? "");
      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        expect(file).toStartWith(`/figures/plates/${key}-first-page-`);
        expect(existsSync(join("public", file))).toBe(true);
      }
      expect(entry).toContain(`First page, p. ${fm.paper.journal.pages.first}`);
    }
  });

  test("the scans come first, directly under the introduction that points to them", () => {
    // The lead says the page images are cut from "the scans below". Until 2026-09-24 two
    // sections of prose stood between them, and on a 390px phone the list began at y=1509.
    const sections = [...html.matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1]);
    expect(sections.length).toBeGreaterThan(1);
    expect(sections[0]).toBe("sources-scans");
    expect(html).toContain("scans below");
  });

  test("no em dash in the page's text", () => {
    expect(html.replace(/<[^>]+>/g, "")).not.toContain("—");
  });
});
