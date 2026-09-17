import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ShowTheCode } from "../components/lab/ShowTheCode.tsx";
import { getKernelListingsForInstrument } from "../content/kernel/listings.ts";

mock.module("../components/lab/TracerLab", () => ({
  TracerLab: () => (
    <ShowTheCode listings={getKernelListingsForInstrument("bm-01")} uid="stc-bm-01" />
  ),
}));

import { PaperReader } from "./PaperReader.tsx";

export type ExtractedLink = {
  accessibleName: string;
  href: string;
};

export function extractLinks(html: string): ExtractedLink[] {
  const linkRegex = /<a\b([^>]*)>(.*?)<\/a>/gis;
  const links: ExtractedLink[] = [];
  const matches = html.matchAll(linkRegex);
  for (const match of matches) {
    const attrs = match[1] ?? "";
    const body = match[2] ?? "";
    const hrefMatch = /href="([^"]*)"/i.exec(attrs);
    const ariaLabelMatch = /aria-label="([^"]*)"/i.exec(attrs);
    const href = hrefMatch?.[1] ?? "";
    const text = body.replace(/<[^>]+>/g, "").trim();
    const accessibleName = ariaLabelMatch?.[1] ?? text;
    links.push({ accessibleName, href });
  }
  return links;
}

export function groupLinksByName(links: readonly ExtractedLink[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const { accessibleName, href } of links) {
    const set = map.get(accessibleName);
    if (set) {
      set.add(href);
    } else {
      map.set(accessibleName, new Set([href]));
    }
  }
  return map;
}

describe("PaperReader link accessible names (am-jmma)", () => {
  test("re-measurement: every name with genuinely differing destinations reaches exactly 1 destination", async () => {
    const jsx = await PaperReader({});
    const html = renderToStaticMarkup(jsx);
    const links = extractLinks(html);
    const byName = groupLinksByName(links);

    // Filter to names mapping to > 1 destination
    const multi = [...byName.entries()].filter(([_, hrefs]) => hrefs.size > 1);

    // All remaining multi-destination names must be the triaged benign set
    // where outline and prerequisite heading point to the SAME section anchor
    const BENIGN_SAME_TARGET_NAMES = new Set([
      "Zero average is not no movement",
      "Why the square grows with time",
      "From a step law to a density law",
      "What the spreading curve predicts",
      "Why viscosity changes the spread",
    ]);

    for (const [name, hrefs] of multi) {
      expect(BENIGN_SAME_TARGET_NAMES.has(name)).toBe(true);
      // Verify both hrefs actually resolve to the exact same hash anchor target
      const targets = [...hrefs].map((h) => {
        const hashIdx = h.indexOf("#");
        return hashIdx >= 0 ? h.slice(hashIdx) : h;
      });
      const uniqueTargets = new Set(targets);
      expect(uniqueTargets.size).toBe(1);
    }

    // Verify previously broken names whose destinations genuinely differed now reach 1 destination each
    // 1. ShowTheCode tabs for bm-01 kernels
    const bm01Listings = getKernelListingsForInstrument("bm-01");
    expect(bm01Listings.length).toBe(5);
    for (const listing of bm01Listings) {
      const wordsName = `In words: ${listing.exportName}`;
      const mathName = `Mathematics: ${listing.exportName}`;
      const implName = `Implementation: ${listing.exportName}`;

      expect(byName.get(wordsName)?.size).toBe(1);
      expect(byName.get(mathName)?.size).toBe(1);
      expect(byName.get(implName)?.size).toBe(1);
    }

    // 2. Section-only reading links
    const s4SectionName = "Section-only reading: §4 · From random displacement to diffusion";
    const s5SectionName = "Section-only reading: §5 · From displacement to molecular scale";
    expect(byName.get(s4SectionName)?.size).toBe(1);
    expect(byName.get(s5SectionName)?.size).toBe(1);

    // 3. Companion links
    expect(byName.get("Companion: Explanation")?.size).toBe(1);
    expect(byName.get("Companion: Laboratory")?.size).toBe(1);
    expect(byName.get("Explanation")?.size).toBe(1);
  });

  describe("AC4 negative: naive fixes fail link accessibility isolation", () => {
    test("two sections offering the same action type without section title collide", () => {
      // Simulates a naive fix that adds aria-label="Section-only reading" without the section title
      const naiveHtml = `
        <a href="/papers/brownian-motion/s4/" aria-label="Section-only reading">Section-only reading →</a>
        <a href="/papers/brownian-motion/s5/" aria-label="Section-only reading">Section-only reading →</a>
      `;
      const links = extractLinks(naiveHtml);
      const byName = groupLinksByName(links);
      const naiveDestinations = byName.get("Section-only reading");
      expect(naiveDestinations?.size).toBe(2);

      // A proper discriminating assertion fails on the naive fix
      expect(() => {
        if ((naiveDestinations?.size ?? 0) > 1) {
          throw new Error("AC4 failure: distinct sections share identical accessible name");
        }
      }).toThrow("AC4 failure: distinct sections share identical accessible name");
    });

    test("two kernel listings offering the same tab without kernel identifier collide", () => {
      // Simulates a naive fix that uses bare tab labels across multiple kernels
      const naiveHtml = `
        <a href="#stc-k1-words" aria-label="In words">In words</a>
        <a href="#stc-k2-words" aria-label="In words">In words</a>
      `;
      const links = extractLinks(naiveHtml);
      const byName = groupLinksByName(links);
      const naiveDestinations = byName.get("In words");
      expect(naiveDestinations?.size).toBe(2);

      // A proper discriminating assertion fails on the naive fix
      expect(() => {
        if ((naiveDestinations?.size ?? 0) > 1) {
          throw new Error("AC4 failure: distinct kernels share identical tab accessible name");
        }
      }).toThrow("AC4 failure: distinct kernels share identical tab accessible name");
    });
  });
});
