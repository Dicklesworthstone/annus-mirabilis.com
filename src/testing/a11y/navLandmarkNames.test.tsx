import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Companion } from "../../reader/layout/Companion.tsx";
import { ReaderLayout } from "../../reader/layout/ReaderLayout.tsx";
import { PaperPage } from "../../reader/PaperPage.tsx";
import { PaperReader } from "../../reader/PaperReader.tsx";
import { exportMarkup } from "../exportMarkup.ts";

export type ExtractedNav = {
  accessibleName: string;
  className?: string | undefined;
  raw: string;
};

export function extractNavLandmarks(html: string): ExtractedNav[] {
  const navRegex = /<nav\b([^>]*)>/gis;
  const navs: ExtractedNav[] = [];
  for (const match of html.matchAll(navRegex)) {
    const attrs = match[1] ?? "";
    const ariaLabelMatch = /aria-label="([^"]*)"/i.exec(attrs);
    const ariaLabelledByMatch = /aria-labelledby="([^"]*)"/i.exec(attrs);
    const classMatch = /class="([^"]*)"/i.exec(attrs);
    const accessibleName = ariaLabelMatch?.[1] ?? ariaLabelledByMatch?.[1] ?? "";
    navs.push({
      accessibleName,
      className: classMatch?.[1],
      raw: match[0],
    });
  }
  return navs;
}

export function assertNavLandmarkUniqueness(html: string, contextDescription: string) {
  const navs = extractNavLandmarks(html);
  const nameCounts = new Map<string, number>();
  for (const nav of navs) {
    nameCounts.set(nav.accessibleName, (nameCounts.get(nav.accessibleName) ?? 0) + 1);
  }
  const duplicates = Array.from(nameCounts.entries()).filter(([_, count]) => count > 1);
  const distinctCount = nameCounts.size;
  const navCount = navs.length;

  if (distinctCount !== navCount) {
    const details = duplicates.map(([name, count]) => `"${name}": ${count}x`).join(", ");
    throw new Error(
      `[${contextDescription}] Nav landmark accessible names are not unique: ${distinctCount} distinct names across ${navCount} nav landmarks (gap: ${navCount - distinctCount}). Duplicates: [${details}]`,
    );
  }

  return { distinctCount, navCount, names: Array.from(nameCounts.keys()) };
}

describe("PaperReader nav landmark unique accessible names (am-rv2t)", () => {
  test("every nav landmark on PaperReader carries a unique accessible name (AC a)", async () => {
    const html = await exportMarkup(await PaperReader());
    const result = assertNavLandmarkUniqueness(html, "PaperReader");

    expect(result.distinctCount).toBe(result.navCount);
    // Non-vacuity, not a census: a page with no nav landmark would pass the equality above. This
    // asserted 58 until 390afa87 rendered each passage's step reading once instead of twice, which
    // removed 12 navs and turned it red on correct work (AGENTS.md, "A Count Is For Reporting").
    expect(result.navCount).toBeGreaterThan(0);
  });

  test("every nav landmark on PaperPage carries a unique accessible name (AC a)", async () => {
    const html = await exportMarkup(await PaperPage({ paperId: "brownian-motion" }));
    const result = assertNavLandmarkUniqueness(html, "PaperPage");

    expect(result.distinctCount).toBe(result.navCount);
    expect(result.navCount).toBeGreaterThan(0);
  });

  test("section-scoped PaperReader renders carry unique nav accessible names", async () => {
    const htmlS4 = await exportMarkup(await PaperReader({ section: "s4" }));
    const resultS4 = assertNavLandmarkUniqueness(htmlS4, "PaperReader(s4)");
    expect(resultS4.distinctCount).toBe(resultS4.navCount);

    const htmlS5 = await exportMarkup(await PaperReader({ section: "s5" }));
    const resultS5 = assertNavLandmarkUniqueness(htmlS5, "PaperReader(s5)");
    expect(resultS5.distinctCount).toBe(resultS5.navCount);
  });

  test("prerequisite navs across different passages pointing to the same foundation get distinct context names (AC 4)", async () => {
    // The steps, with their embedded lessons, are served on the section pages; the whole-paper
    // page lifts each passage's steps in when they open (stepsBody.ts), so with every passage
    // open it holds the navs of every one of its section pages. Those are what is collected here.
    const whole = await exportMarkup(await PaperReader());
    const sections = new Set(
      [...whole.matchAll(/<section\b[^>]*\sid="(s\d+)"[^>]*class="reader-section"/g)].map(
        (m) => m[1] ?? "",
      ),
    );
    expect(sections.size).toBeGreaterThan(0);
    const navs = (
      await Promise.all(
        [...sections].map(async (section) =>
          extractNavLandmarks(await exportMarkup(await PaperReader({ section }))),
        ),
      )
    ).flat();
    const meanVarianceNavs = navs.filter((n) =>
      n.accessibleName.includes("Mean, variance and RMS"),
    );

    // Mean, variance and RMS is embedded in each passage's step reading. The step reading is rendered once per passage (390afa87); until then each passage
    // also carried a "local steps" copy, and this test counted five navs where there are now three.
    // Asserted by identity rather than by count, so a new passage using this foundation adds a
    // name without breaking the test.
    const names = new Set(meanVarianceNavs.map((n) => n.accessibleName));
    expect(meanVarianceNavs.length).toBeGreaterThan(1);
    expect(names.size).toBe(meanVarianceNavs.length);
    expect(names).toContain(
      "Prerequisites for Mean, variance and RMS (Zero average is not no movement, reading steps)",
    );
    expect(names).toContain(
      "Prerequisites for Mean, variance and RMS (What would let us count molecules?, reading steps)",
    );
    // The clarification panel's copy is no longer in the page: a lesson's body loads when it
    // opens (src/reader/lessonBody.ts), and extractLesson gives its landmark the same
    // "(clarification panel)" context, asserted in src/reader/lessonBody.test.tsx.
    expect(names).not.toContain("Prerequisites for Mean, variance and RMS (clarification panel)");
    // The step reading is not rendered twice: no passage carries a second copy of the nav.
    expect([...names].filter((n) => n.includes("local steps"))).toEqual([]);
  });

  test("companion view side column and bottom sheet navs get distinct accessible names", () => {
    // PaperReader renders no companion switch (Companion.tsx says why: a static export cannot
    // serve ?companion=), so the property is checked where a switch is rendered: the same
    // companion in both of ReaderLayout's slots.
    const html = renderToStaticMarkup(
      <ReaderLayout
        outline={<nav aria-label="Argument outline" />}
        companion={
          <Companion kind="explanation" switchable>
            <p>Beside this passage.</p>
          </Companion>
        }
      >
        <article id="arg-bm-observable" />
      </ReaderLayout>,
    );
    const companionNavs = extractNavLandmarks(html).filter((n) =>
      n.accessibleName.includes("Companion view"),
    );
    expect(companionNavs.map((n) => n.accessibleName).sort()).toEqual([
      "Companion view (bottom sheet)",
      "Companion view (side column)",
    ]);
  });

  test("the Brownian reading renders no companion switch whose links could do nothing", async () => {
    const html = await exportMarkup(await PaperReader());
    expect(
      extractNavLandmarks(html).filter((n) => n.accessibleName.includes("Companion view")),
    ).toEqual([]);
    expect(html).not.toContain("?companion=");
  });

  test("planted negative: duplicate nav accessible names fail reporting both distinct and total counts (AC b)", () => {
    const duplicateHtml = `
      <nav aria-label="Argument outline"></nav>
      <nav aria-label="Reading face"></nav>
      <nav aria-label="Argument outline"></nav>
    `;

    expect(() => assertNavLandmarkUniqueness(duplicateHtml, "PlantedNegativeSample")).toThrow(
      /2 distinct names across 3 nav landmarks \(gap: 1\)/,
    );
  });
});
