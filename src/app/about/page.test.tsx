import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { dayAndMonth, loadFirstPages } from "../../components/home/firstPages.ts";
import { loadProvenanceReceipts } from "../../content/provenance/loadReceipts.ts";
import About from "./page";

/** /about/ against the real receipts and NOTICE.md. */
const html = renderToStaticMarkup(<About />);
// Dates are set with a no-break space between day and month; compare them as ordinary spaces.
const text = html
  .replace(/<[^>]+>/g, "")
  .replace(/&#x27;|&rsquo;/g, "’")
  .replace(/ |&nbsp;/g, " ");

describe("/about/", () => {
  test("the count note is at #count-note and dates every paper from its receipt", () => {
    expect(html).toContain('id="count-note"');
    const papers = loadFirstPages();
    // Guard: an empty list would make the loop below vacuous.
    expect(papers.length).toBeGreaterThan(0);
    for (const paper of papers) expect(text).toContain(dayAndMonth(paper.received));
    const dissertation = loadProvenanceReceipts().receipts.find((r) => r.key === "ap-19-289")
      ?.receipt?.frontMatter.paper;
    expect(dissertation).toBeDefined();
    expect(text).toContain(dissertation?.titleGerman as string);
    for (const type of ["date-line", "submitted"]) {
      const iso = dissertation?.dates.find((d) => d.type === type)?.iso as string;
      expect(text).toContain(dayAndMonth(iso));
    }
  });

  test("the attribution is NOTICE.md's, word for word", () => {
    // Read line by line rather than with the page's pattern, so a fault in one is caught by the other.
    const lines = readFileSync("NOTICE.md", "utf8").split("\n");
    const heading = lines.indexOf("## Attribution");
    expect(heading).toBeGreaterThan(-1);
    const fence = lines.indexOf("```text", heading);
    const line = lines[fence + 1] ?? "";
    expect(line.length).toBeGreaterThan(0);
    expect(text).toContain(line.trim().replace(/'/g, "’"));
  });

  test("every link within the site names a page that exists", () => {
    const internal = [...html.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1] as string);
    expect(internal.length).toBeGreaterThan(0);
    for (const href of internal) {
      const route = href.replace(/^\/|\/$/g, "");
      expect(existsSync(join("src", "app", route, "page.tsx"))).toBe(true);
    }
  });

  test("no em dash in the page's text", () => {
    expect(text).not.toContain("—");
  });
});
