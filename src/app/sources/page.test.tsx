import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { loadProvenanceReceipts } from "../../content/provenance/loadReceipts.ts";
import { firstSentence } from "./corrections.ts";
import Sources from "./page";
import { reuseOf, textLayerWords } from "./reuse.ts";

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
          ? "Read by machine and corrected by hand against the page images."
          : "Not yet transcribed";
      expect(entry).toContain(expected);
      // No review clause (D-2026-09-25-no-review-status-banners).
      expect(entry).not.toContain("not yet reviewed by a second reader");
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

  test("each entry states its scan's recorded reuse terms, and its text layer where one is recorded", () => {
    for (const { fm } of receipts) {
      const entry = entries.find((e) => e.includes(fm.scan.sha256)) ?? "";
      const text = entry.replace(/<[^>]+>/g, "").replace(/&#x27;|&rsquo;/g, "’");
      expect(text).toContain(reuseOf(fm).words.replace(/'/g, "’"));
      const layer = textLayerWords(fm);
      if (layer) expect(text).toContain(layer.replace(/'/g, "’"));
      else expect(entry).not.toContain("<dt>Text layer</dt>");
    }
  });

  test("the correction log holds every record once, with the printed reading beside the proposed one", () => {
    const records = receipts.flatMap(({ fm }) => fm.typographicalErrors);
    // Guards: records exist, and some are withdrawn, or the checks below prove nothing.
    expect(records.length).toBeGreaterThan(0);
    expect(records.some((r) => r.status === "retracted")).toBe(true);
    const log = html.split('id="corrections"')[1] ?? "";
    const items = log.split("<li ").slice(1);
    expect(items.length).toBe(records.length);
    const escaped = (t: string) =>
      t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#x27;");
    for (const record of records) {
      const item = items.filter((i) => i.startsWith(`id="${record.id}"`));
      expect({ id: record.id, once: item.length }).toEqual({ id: record.id, once: 1 });
      const body = item[0] ?? "";
      // A reading's words are served as written; its $...$ formulas are set, never shown as TeX
      // (readingParts, dispatch 270).
      for (const [label, reading] of [
        ["Printed", record.originalReading],
        ["Proposed", record.proposedReading],
      ] as const) {
        const line = body.split(`${label}: <span lang="de">`)[1]?.split("</p>")[0] ?? "";
        expect(line.length, `${record.id} ${label}`).toBeGreaterThan(0);
        for (const part of reading.split(/(\$[^$]*\$)/).filter((p) => p.length > 0)) {
          if (/^\$[^$]*\$$/.test(part)) expect(line, record.id).toContain('class="inline-math"');
          else expect(line, record.id).toContain(escaped(part));
        }
        if (reading.includes("$"))
          expect(line.replace(/<[^>]+>/g, ""), record.id).not.toContain("$");
        else expect(body).toContain(`${label}: <span lang="de">${escaped(reading)}</span>`);
      }
      if (record.status === "retracted") {
        expect(body).toContain("withdrawn");
        expect(body).toContain(escaped(firstSentence(record.retraction?.reason ?? "")));
      } else expect(body).not.toContain("Withdrawn on");
    }
  });

  test("the log runs newest first, and keeps translation corrections apart", () => {
    const log = html.split('id="corrections"')[1] ?? "";
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const dates = [...log.matchAll(/Recorded (\d+) (\w+) (\d{4})/g)].map(
      ([, d, m, y]) =>
        `${y}-${String(months.indexOf(m as string) + 1).padStart(2, "0")}-${(d as string).padStart(2, "0")}`,
    );
    expect(dates.length).toBeGreaterThan(1);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(log).toContain('id="corrections-translation"');
  });

  test("no em dash in the page's own text; a printed reading keeps the dash it was printed with", () => {
    // Quoted German is the source's, not this page's copy. A reading that holds a set formula
    // carries markup inside its span, so a log line is taken out whole (dispatch 270).
    const own = html
      .replace(/(Printed|Proposed): <span lang="de">[\s\S]*?<\/p>/g, "")
      .replace(/<span lang="de">[^<]*<\/span>/g, "")
      .replace(/<[^>]+>/g, "");
    expect(own).not.toContain("—");
  });
});
