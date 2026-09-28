import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { criteriaCounts } from "./criteriaCounts.ts";
import Accessibility from "./page";

/**
 * /accessibility/ in its pending state. No disabled-reader testing round is recorded, so the page
 * must state the target without claiming to reach it.
 */
const html = renderToStaticMarkup(<Accessibility />);
const text = html.replace(/<[^>]+>/g, "").replace(/&#x27;|&rsquo;/g, "’");

describe("/accessibility/", () => {
  test("names the target and says conformance is not yet claimed", () => {
    expect(text).toContain("WCAG 2.2 level AA");
    expect(text).toContain("It does not yet claim to meet it.");
    expect(text).toContain("No round of testing with disabled readers");
  });

  test("makes no claim of conformance anywhere on the page", () => {
    for (const claim of [
      /\bconform(s|ant)\b/i,
      /\bcomplian(t|ce)\b/i,
      /\bfully accessible\b/i,
      /\bmeets WCAG\b/i,
    ]) {
      expect(text).not.toMatch(claim);
    }
  });

  test("gives a way to report a barrier, and no em dash", () => {
    expect(html).toContain(
      'href="https://github.com/Dicklesworthstone/annus-mirabilis.com/issues"',
    );
    expect(text).not.toContain("—");
  });
});

describe("/accessibility/ states what has NOT been checked", () => {
  test("the limits are on the page, not only the machinery", () => {
    // The section that matters most. A page that lists what passed and stops there reads as a
    // conformance claim however carefully the words avoid the term.
    expect(text).toContain("What has not been checked");
    expect(text).toContain("No round of testing with disabled readers");
    expect(text).toContain("Automated checks are not sufficient on their own");
    // The cognitive guidance is followed as guidance and not claimed, which AGENTS.md requires.
    expect(text).toMatch(/cognitive accessibility is followed here as guidance/);
    expect(text).toContain("no claim is made against it");
    // A rule existing is not the site meeting it, said in words beside the numbers.
    expect(text).toMatch(/not the same as the site meeting it/);
  });

  test("the roles that would run those rounds are named as unfilled", () => {
    expect(text).toMatch(/accessibility co-design facilitator/i);
    expect(text).toMatch(/open and recruiting/);
  });
});

describe("/accessibility/ counts come from the map, not from a sentence", () => {
  const counts = criteriaCounts();

  test("the map's dispositions partition it, so nothing is silently uncounted", () => {
    // Non-vacuity first: a map that parsed to nothing would satisfy the equalities below.
    expect(counts.total).toBeGreaterThanOrEqual(50);
    expect(counts.total).toBe(counts.withRule + counts.notApplicable);
    expect(counts.total).toBe(counts.levelA + counts.levelAA);
  });

  test("every number the page prints is the number the map holds today", () => {
    // The staleness guard. Adding a criterion to wcag-22-map.yaml changes these, and the page is
    // read from the map at build time, so this stays true without anyone editing prose. If the
    // page ever hardcodes one again, this test is what notices.
    for (const n of [
      counts.total,
      counts.levelA,
      counts.levelAA,
      counts.withRule,
      counts.notApplicable,
    ])
      expect(text, `the page does not print ${n}`).toContain(String(n));
  });
});

describe("/accessibility/ leads somewhere", () => {
  test("a reader on this page has routes out, not one link", () => {
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    // Measured before this change: 1 link, to the issue tracker. A page about how to read the site
    // that offers no way onward is a dead end whatever it says.
    expect(hrefs.length).toBeGreaterThanOrEqual(5);
    expect(hrefs).toContain("/your-data/");
    expect(hrefs.some((h) => h?.includes("wcag-22-map.yaml"))).toBe(true);
    expect(hrefs.some((h) => h?.includes("manual-protocol.md"))).toBe(true);
  });

  test("it carries no client component, so it reads with JavaScript off", () => {
    expect(html).not.toContain("use client");
    // Rendered to static markup above; a page needing hydration to say what it says would fail the
    // thing it is describing.
    expect(text.length).toBeGreaterThan(3000);
  });
});
