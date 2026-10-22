/**
 * THE CAPSTONE INDEX, RENDERED (am-9p8v).
 *
 * `/capstones/` was a 404 with the four capstone pages beneath it. What this guards is that the
 * index stays derived: each row's title and question are the record's, so a capstone renamed in
 * `content/arguments/capstones/<paper>.yaml` is renamed here in the same build. The negative that
 * matters is a row missing, because a reader who trims the address would then find three of four
 * and have no way to know a fourth exists.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ROUTE_SLUGS } from "../../content/ids.ts";
import { capstoneExists, loadCapstone } from "../../discovery/capstone/loadCapstone.ts";
import Capstones from "./page";

const html = renderToStaticMarkup(<Capstones />);
const papers = ROUTE_SLUGS.filter((paper) => capstoneExists(paper));

describe("the capstone index", () => {
  test("every written capstone has a row, with the record's own title and question", () => {
    // Denominator: four are written, measured 2026-10-22. A zero would make the loop vacuous.
    expect(papers.length).toBe(4);
    for (const paper of papers) {
      const { capstone } = loadCapstone(paper);
      expect(html).toContain(`href="/capstones/${paper}/"`);
      expect(html).toContain(capstone.title);
      // React escapes the apostrophes and quotes a question may carry.
      const clause = (capstone.question.split(/[,?]/)[0] ?? "").replace(/'/g, "&#x27;");
      expect(clause.length).toBeGreaterThan(8);
      expect(html).toContain(clause);
    }
    expect(html.split('href="/capstones/').length - 1).toBe(papers.length);
  });

  test("the counts beside each row are the record's, not written here", () => {
    for (const paper of papers) {
      const { capstone } = loadCapstone(paper);
      expect(html).toContain(
        `${capstone.claims.length} claims, ${capstone.assumptions.length} assumptions`,
      );
    }
  });

  test("works without JavaScript", () => {
    expect(html).not.toContain("<script");
  });
});
