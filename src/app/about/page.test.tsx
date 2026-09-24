import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { dayAndMonth, loadFirstPages } from "../../components/home/firstPages.ts";
import { loadProvenanceReceipts } from "../../content/provenance/loadReceipts.ts";
import About from "./page";
import { PORTRAIT } from "./portrait.ts";

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

  test("the photograph is described, served at every width its srcSet names, and credited as the library records it", () => {
    const figure = /<figure class="about-portrait">([\s\S]*?)<\/figure>/.exec(html)?.[1] ?? "";
    expect(figure.length).toBeGreaterThan(0);
    // A reader who cannot see it is told what it shows.
    const alt = /alt="([^"]*)"/.exec(figure)?.[1] ?? "";
    expect(alt.length).toBeGreaterThan(20);
    const srcSet = /srcSet="([^"]+)"/.exec(figure)?.[1] ?? "";
    const files = srcSet.split(", ").map((candidate) => candidate.split(" ")[0] ?? "");
    expect(files.length).toBe(PORTRAIT.served.length);
    for (const file of files) expect(existsSync(join("public", file))).toBe(true);
    // The credit is what the holding library records, with its record linked, and Chavan appears
    // only as an attribution (TanElk's ruling, dispatch 123): never "by Lucien Chavan" or
    // "Lucien Chavan's portrait".
    const caption = figure.replace(/<[^>]+>/g, "").replace(/&#x27;|&rsquo;/g, "’");
    expect(caption).toContain(PORTRAIT.archive);
    expect(figure).toContain(`href="https://doi.org/${PORTRAIT.doi}"`);
    expect(caption).toContain(PORTRAIT.identifier);
    expect(caption).toContain("The library records the photographer as unknown");
    expect(caption).toContain(`often attributed to ${PORTRAIT.attributedTo}`);
    expect(caption).not.toMatch(/\bby Lucien Chavan\b|Lucien Chavan[’']s|photograph(?:ed)? by/i);
  });

  test("no em dash in the page's text", () => {
    expect(text).not.toContain("—");
  });
});
