/**
 * THE TWO CATALOGUE PAGES, RENDERED.
 *
 * These pages exist because `/equations/` and `/equations/<paper>/` were 404s with 279 routes
 * beneath them (am-9p8v). The failure worth guarding against now is the opposite one and it is
 * quiet: a page that renders, answers 200, and omits rows. A group dropped from the render, or a
 * kind with no group, loses a reader's only way to find those equations while every other gate
 * stays green, so the count in the markup is compared with the count in the data.
 *
 * The no-KaTeX assertion is not tidiness. The catalogue module records the measurement that
 * decided it (1,056 kB of drawn markup for one paper's equations against 27 kB of sentences); this
 * is what makes dropping a formula into a row a decision someone has to take deliberately.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { cataloguePapers, equationCatalogue } from "../../equations/printed/catalogue.ts";
import PaperEquations from "./[paper]/page";
import Equations from "./page";

const root = renderToStaticMarkup(await Equations());
const relativity = renderToStaticMarkup(
  await PaperEquations({ params: Promise.resolve({ paper: "special-relativity" }) }),
);
const massEnergy = renderToStaticMarkup(
  await PaperEquations({ params: Promise.resolve({ paper: "mass-energy" }) }),
);

function hrefCount(html: string, prefix: string): number {
  return html.split(`href="${prefix}`).length - 1;
}

describe("/equations/: the door onto the four catalogues", () => {
  test("links to every paper that has explained equations, and names each one", () => {
    const papers = cataloguePapers();
    expect(papers.length).toBe(4);
    for (const entry of papers) {
      expect(root).toContain(`href="/equations/${entry.paper}/"`);
      expect(root).toContain(`${entry.total} equations`);
    }
    expect(hrefCount(root, "/equations/")).toBe(papers.length);
  });

  test("works without JavaScript, which is what a catalogue has to do", () => {
    expect(root).not.toContain("<script");
    expect(massEnergy).not.toContain("<script");
  });
});

describe("/equations/<paper>/: every explained equation of one paper", () => {
  test("every row in the data is a link in the markup, for both a long paper and a short one", () => {
    for (const [paper, html] of [
      ["special-relativity", relativity],
      ["mass-energy", massEnergy],
    ] as const) {
      const rows = equationCatalogue(paper);
      expect(rows.length).toBeGreaterThan(0);
      // The count, not a sample: a group dropped from the render takes its rows with it, and a
      // page missing 36 of 122 links reads exactly like a page missing none.
      expect(hrefCount(html, `/equations/${paper}/`), `${paper} drew fewer rows than it has`).toBe(
        rows.length,
      );
      for (const row of rows) expect(html).toContain(`href="${row.href}"`);
    }
  });

  test("each row carries the equation's own words, so a reader can find it by what it says", () => {
    const rows = equationCatalogue("mass-energy");
    /*
     * React escapes the apostrophe in "the body's energy" to &#x27;, so the comparison escapes the
     * clause the same way rather than choosing clauses that happen to have none. That choice is
     * the difference between this test reading the page and this test reading around it: of the
     * first eight mass-energy rows, four carry an apostrophe.
     */
    const escaped = (text: string) =>
      text.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");
    for (const row of rows.slice(0, 8)) {
      const clause = row.words.split(/[,.]/)[0] ?? "";
      expect(clause.length).toBeGreaterThan(8);
      expect(massEnergy).toContain(escaped(clause));
    }
  });

  test("the formula is NOT drawn here, which is a recorded decision and not an omission", () => {
    expect(relativity).not.toContain("katex");
    expect(relativity).not.toContain("<math");
  });

  test("the way out leads to the paper and to the other catalogues", () => {
    expect(relativity).toContain('href="/papers/special-relativity/"');
    expect(relativity).toContain('href="/equations/"');
  });

  test("a paper with no explained equations has no page", () => {
    // generateStaticParams is derived from the data, so the companion dissertation is not built;
    // the render path refuses it as well rather than serving an empty catalogue.
    expect(equationCatalogue("molecular-dimensions")).toEqual([]);
    expect(cataloguePapers().some((entry) => entry.paper === "molecular-dimensions")).toBe(false);
  });
});
