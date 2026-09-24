import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { dayAndMonth, loadFirstPages } from "../../components/home/firstPages.ts";
import { loadProvenanceReceipts } from "../../content/provenance/loadReceipts.ts";
import { reuseOf } from "../sources/reuse.ts";
import About from "./page";
import { PORTRAIT } from "./portrait.ts";

/** /about/ against the real receipts and NOTICE.md. */
const html = renderToStaticMarkup(<About />);
// Dates are set with a no-break space between day and month; compare them as ordinary spaces.
const text = html
  .replace(/<[^>]+>/g, "")
  .replace(/&#x27;|&rsquo;/g, "’")
  .replace(/ |&nbsp;/g, " ");

/** The text of the section headed by the element with this id, up to the next heading of its rank. */
function sectionText(id: string, rank: "h2" | "h3" = "h2"): string {
  const at = html.indexOf(`id="${id}"`);
  expect(at).toBeGreaterThan(-1);
  // From the end of the heading's opening tag, so the id attribute's own quotes are not text.
  const start = html.indexOf(">", at) + 1;
  const next = html.indexOf(`<${rank} `, start + 1);
  const end = rank === "h3" ? html.indexOf("</section>", start) : next === -1 ? html.length : next;
  return html
    .slice(start, end === -1 ? html.length : end)
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;|&rsquo;/g, "’")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/ |&nbsp;/g, " ");
}

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

  test("every section the page promises is there, at its anchor", () => {
    for (const id of [
      "count-note",
      "authorship",
      "about-method",
      "license",
      "cite",
      "reuse",
      "contribute",
      "accessibility",
      "tested-routes",
      "privacy",
    ])
      expect({ id, present: html.includes(`id="${id}"`) }).toEqual({ id, present: true });
  });

  test("the count note gives the Habicht letter's four in paraphrase and quotes none of it", () => {
    const note = sectionText("count-note");
    expect(note).toContain("Conrad Habicht");
    expect(note).toContain("paraphrased here, not quoted");
    // Each of the letter's four, described in the page's own words.
    for (const subject of [
      "energy of light",
      "size of atoms",
      "molecular theory of heat",
      "moving bodies",
    ])
      expect(note).toContain(subject);
    // Nothing of the letter's own German, and no quotation marks at all in the note: the
    // transcription and its translation are the Collected Papers' editorial work (docs/RIGHTS.md).
    expect(note).not.toMatch(/revolution|verspreche|Atomgr|Elektrodynamik|Lehre von Raum/i);
    expect(note).not.toMatch(/[„“”"«»]/);
  });

  test("each revision a citation names is the compiled content index's own", () => {
    const index = JSON.parse(readFileSync("generated/content/index.json", "utf8")) as {
      buildDigest: string;
      payloads: { kind: string; id: string; sha256: string }[];
    };
    const papers = loadFirstPages();
    expect(papers.length).toBeGreaterThan(0);
    const cite = sectionText("cite");
    expect(cite).toContain(`edition revision ${index.buildDigest.slice(0, 12)}`);
    for (const paper of papers) {
      const entry = index.payloads.find((e) => e.kind === "paper" && e.id === paper.slug);
      expect(entry).toBeDefined();
      expect(cite).toContain((entry?.sha256 ?? "").slice(0, 12));
    }
  });

  test("what may be reused is each scan's own record, and no site-wide answer stands in for it", () => {
    const reuse = sectionText("reuse", "h3");
    const receipts = loadProvenanceReceipts().receipts;
    expect(receipts.length).toBeGreaterThan(0);
    for (const { key, receipt } of receipts) {
      expect(receipt).toBeDefined();
      const record = reuseOf(receipt?.frontMatter as NonNullable<typeof receipt>["frontMatter"]);
      expect({ key, words: reuse.includes(record.words.replace(/'/g, "’")) }).toEqual({
        key,
        words: true,
      });
      for (const statement of record.statements) expect(html).toContain(`href="${statement.url}"`);
    }
    // The license is stated once, as the license; it is not offered again as the terms of a scan.
    expect(reuse).not.toMatch(/\bMIT\b|Rider/);
    expect(reuse).toContain(PORTRAIT.rights);
  });

  test("the privacy statement names the host and where its own policy is", () => {
    const privacy = sectionText("privacy");
    expect(privacy).toContain("no cookies");
    expect(privacy).toContain("Vercel");
    expect(html).toContain('href="https://vercel.com/legal/privacy-policy"');
  });

  test("no em dash in the page's text", () => {
    expect(text).not.toContain("—");
  });
});
