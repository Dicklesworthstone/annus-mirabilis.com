import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { loadBilingualEdition } from "../../reader/faces/bilingualLoader.ts";
import { criteriaCounts } from "./criteriaCounts.ts";
import Accessibility from "./page";
import { SPOKEN_FORM_PAPERS, spokenFormCounts } from "./spokenFormCounts.ts";

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

/**
 * Each claim the page makes about spoken forms, with the measurement that would contradict it
 * (am-rc1001-bridge-plan-pcjk.35). Until 2026-10-02 the page said "Each equation carries a spoken
 * form written by hand" (inline mathematics has none) and that the forms "have been read against
 * screen readers in automated runs" (no screen reader has ever run). Both read as careful prose.
 */
export function spokenFormOverclaims(
  pageText: string,
  facts: Readonly<{ screenReaderRunRecorded: boolean; inlineSpokenForms: boolean }>,
): string[] {
  const found: string[] = [];
  const claimsScreenReaderRun =
    /\bscreen readers? in automated runs\b|\b(?:have|has) been (?:read|checked|tested|heard) (?:against|with|on|by|through) (?:a |one or more )?screen readers?/i;
  if (!facts.screenReaderRunRecorded && claimsScreenReaderRun.test(pageText))
    found.push("claims a screen-reader run, and docs/accessibility/runs/ records none");
  const claimsEveryEquation = /\b(?:each|every) (?:equation|formula)\b[^.]*\bspoken form/i;
  if (!facts.inlineSpokenForms && claimsEveryEquation.test(pageText))
    found.push("claims every equation has a spoken form, and inline mathematics has none");
  return found;
}

describe("/accessibility/ claims about spoken forms hold against the records", () => {
  const counts = spokenFormCounts();
  // Inline mathematics would carry an authored form in content/inline-terms. Read, not assumed:
  // on 2026-10-02 none of its four files had a spoken field.
  const inlineDir = join(process.cwd(), "content", "inline-terms");
  const inlineFiles = readdirSync(inlineDir).filter((f) => f.endsWith(".yaml"));
  const inlineSpokenForms = inlineFiles.some((f) =>
    /^\s*-?\s*spoken:/m.test(readFileSync(join(inlineDir, f), "utf8")),
  );

  test("the inline records were read", () => {
    expect(inlineFiles.length).toBeGreaterThan(0);
  });

  test("the check catches the two sentences the page printed before", () => {
    const before =
      "Each equation carries a spoken form written by hand rather than generated, because generated " +
      "speech is frequently wrong for physics notation, and those forms have been read against " +
      "screen readers in automated runs but not yet by a person who depends on one.";
    expect(
      spokenFormOverclaims(before, { screenReaderRunRecorded: false, inlineSpokenForms }),
    ).toHaveLength(2);
    // With a recorded run and authored inline forms the same sentences would be true.
    expect(
      spokenFormOverclaims(before, { screenReaderRunRecorded: true, inlineSpokenForms: true }),
    ).toEqual([]);
  });

  test("the page makes neither claim while the records do not support it", () => {
    expect(
      spokenFormOverclaims(text, {
        screenReaderRunRecorded: counts.screenReaderRunRecorded,
        inlineSpokenForms,
      }),
    ).toEqual([]);
    // And it says the limits in words, so a reader is told, not only spared a false claim.
    expect(text).toContain("Mathematics inside a sentence has no hand-written spoken form yet");
    expect(text).toContain("No one has yet listened to any of these forms with a screen reader");
  });

  test("the count the page prints is the count of displays the four papers print", async () => {
    // Every printed display has a display-terms entry, so "All N displayed equations" is about the
    // papers, not only about the entries someone happened to write.
    let printed = 0;
    for (const paper of SPOKEN_FORM_PAPERS) {
      const edition = await loadBilingualEdition(paper);
      printed += (edition?.blocks ?? []).filter((b) => b.kind === "equation").length;
    }
    console.log(
      `spoken forms: ${counts.spoken} of ${counts.displays} display entries; ${printed} displays printed`,
    );
    expect(printed).toBeGreaterThan(100);
    expect(counts.displays).toBe(printed);
    const phrase =
      counts.spoken === counts.displays
        ? `All ${counts.displays} displayed equations`
        : `${counts.spoken} of the ${counts.displays} displayed equations`;
    expect(text).toContain(phrase);
  });
});
