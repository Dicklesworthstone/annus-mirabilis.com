import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PaperPage } from "../../reader/PaperPage.tsx";
import { PaperReader } from "../../reader/PaperReader.tsx";

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
    const html = renderToStaticMarkup(await PaperReader());
    const result = assertNavLandmarkUniqueness(html, "PaperReader");

    expect(result.distinctCount).toBe(result.navCount);
    expect(result.navCount).toBe(58);
    expect(result.distinctCount).toBe(58);
  });

  test("every nav landmark on PaperPage carries a unique accessible name (AC a)", async () => {
    const html = renderToStaticMarkup(await PaperPage({ paperId: "brownian-motion" }));
    const result = assertNavLandmarkUniqueness(html, "PaperPage");

    expect(result.distinctCount).toBe(result.navCount);
    expect(result.navCount).toBe(45);
    expect(result.distinctCount).toBe(45);
  });

  test("section-scoped PaperReader renders carry unique nav accessible names", async () => {
    const htmlS4 = renderToStaticMarkup(await PaperReader({ section: "s4" }));
    const resultS4 = assertNavLandmarkUniqueness(htmlS4, "PaperReader(s4)");
    expect(resultS4.distinctCount).toBe(resultS4.navCount);

    const htmlS5 = renderToStaticMarkup(await PaperReader({ section: "s5" }));
    const resultS5 = assertNavLandmarkUniqueness(htmlS5, "PaperReader(s5)");
    expect(resultS5.distinctCount).toBe(resultS5.navCount);
  });

  test("prerequisite navs across different passages pointing to the same foundation get distinct context names (AC 4)", async () => {
    const html = renderToStaticMarkup(await PaperReader());
    const navs = extractNavLandmarks(html);
    const meanVarianceNavs = navs.filter((n) =>
      n.accessibleName.includes("Mean, variance and RMS"),
    );

    // Mean, variance and RMS is embedded in:
    // 1. Passage 1 (reading steps)
    // 2. Passage 1 (local steps)
    // 3. Passage 6 (reading steps)
    // 4. Passage 6 (local steps)
    // 5. Clarification dialog panel
    expect(meanVarianceNavs.length).toBe(5);
    const distinctMeanVarianceNames = new Set(meanVarianceNavs.map((n) => n.accessibleName));
    expect(distinctMeanVarianceNames.size).toBe(5);

    expect(distinctMeanVarianceNames).toContain(
      "Prerequisites for Mean, variance and RMS (Zero average is not no movement, reading steps)",
    );
    expect(distinctMeanVarianceNames).toContain(
      "Prerequisites for Mean, variance and RMS (Zero average is not no movement, local steps)",
    );
    expect(distinctMeanVarianceNames).toContain(
      "Prerequisites for Mean, variance and RMS (What would let us count molecules?, reading steps)",
    );
    expect(distinctMeanVarianceNames).toContain(
      "Prerequisites for Mean, variance and RMS (What would let us count molecules?, local steps)",
    );
    expect(distinctMeanVarianceNames).toContain(
      "Prerequisites for Mean, variance and RMS (clarification panel)",
    );
  });

  test("companion view side column and bottom sheet navs get distinct accessible names", async () => {
    const html = renderToStaticMarkup(await PaperReader());
    const navs = extractNavLandmarks(html);
    const companionNavs = navs.filter((n) => n.accessibleName.includes("Companion view"));

    expect(companionNavs.length).toBe(2);
    expect(companionNavs.map((n) => n.accessibleName).sort()).toEqual([
      "Companion view (bottom sheet)",
      "Companion view (side column)",
    ]);
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
