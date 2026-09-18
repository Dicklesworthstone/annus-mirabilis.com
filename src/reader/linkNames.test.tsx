import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { getKernelListingsForInstrument } from "../content/kernel/listings.ts";
import { PaperPage } from "./PaperPage.tsx";
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

export const BENIGN_SAME_TARGET_NAMES = new Set([
  "Zero average is not no movement",
  "Why the square grows with time",
  "From a step law to a density law",
  "What the spreading curve predicts",
  "Why viscosity changes the spread",
]);

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

  test("PaperPage on brownian-motion also isolates distinct destinations cleanly", async () => {
    const jsx = await PaperPage({ paperId: "brownian-motion" });
    const html = renderToStaticMarkup(jsx);
    const links = extractLinks(html);
    const byName = groupLinksByName(links);

    const multi = [...byName.entries()].filter(([_, hrefs]) => hrefs.size > 1);
    for (const [name, hrefs] of multi) {
      expect(BENIGN_SAME_TARGET_NAMES.has(name)).toBe(true);
      const targets = [...hrefs].map((h) => {
        const hashIdx = h.indexOf("#");
        return hashIdx >= 0 ? h.slice(hashIdx) : h;
      });
      const uniqueTargets = new Set(targets);
      expect(uniqueTargets.size).toBe(1);
    }
  });

  describe("AC4 negative: naive fixes fail link accessibility isolation", () => {
    test("planted negative: reverting section aria-label on real rendered markup fails verification", async () => {
      const jsx = await PaperReader({});
      let html = renderToStaticMarkup(jsx);
      // Strip aria-label from section-only reading links so they collapse to 'Section-only reading →'
      html = html.replace(/aria-label="Section-only reading: [^"]*"/g, "");
      const links = extractLinks(html);
      const byName = groupLinksByName(links);

      const multi = [...byName.entries()].filter(([_, hrefs]) => hrefs.size > 1);
      const unTriagedMulti = multi.filter(([name]) => !BENIGN_SAME_TARGET_NAMES.has(name));
      expect(unTriagedMulti.length).toBeGreaterThan(0);
      expect(byName.get("Section-only reading →")?.size).toBe(2);
    });

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

  describe("am-xbfm: ten collision classes locked against regression", () => {
    test("all ten collision classes resolve without multi-destination collisions", async () => {
      const jsx = await PaperReader({});
      const html = renderToStaticMarkup(jsx);
      const links = extractLinks(html);
      const byName = groupLinksByName(links);

      // 1. "Read the prerequisite": 0 bare instances, all discriminated, each reaches exactly 1 destination
      expect(byName.has("Read the prerequisite")).toBe(false);
      const prereqLinks = [...byName.entries()].filter(([name]) =>
        name.startsWith("Read the prerequisite: "),
      );
      expect(prereqLinks.length).toBeGreaterThan(0);
      for (const [_, hrefs] of prereqLinks) {
        expect(hrefs.size).toBe(1);
      }

      // 2. "Adding and averaging": reaches exactly 1 destination (/foundations/bridge-sum-average/)
      expect(byName.get("Adding and averaging")?.size).toBe(1);
      expect(byName.get("Adding and averaging")?.has("/foundations/bridge-sum-average/")).toBe(
        true,
      );

      // 3. "Open this as a full reading page →" / "Open this as a full reading page": 0 bare instances
      expect(byName.has("Open this as a full reading page →")).toBe(false);
      expect(byName.has("Open this as a full reading page")).toBe(false);
      const fullReadingLinks = [...byName.entries()].filter(
        ([name]) => name.startsWith("Open ") && name.endsWith(" as a full reading page"),
      );
      expect(fullReadingLinks.length).toBe(13);
      for (const [_, hrefs] of fullReadingLinks) {
        expect(hrefs.size).toBe(1);
      }

      // 4. "Squares and square roots": reaches exactly 1 destination
      expect(byName.get("Squares and square roots")?.size).toBe(1);
      expect(
        byName.get("Squares and square roots")?.has("/foundations/bridge-squaring-square-roots/"),
      ).toBe(true);

      // 5. "A sign records direction": reaches exactly 1 destination
      expect(byName.get("A sign records direction")?.size).toBe(1);
      expect(
        byName
          .get("A sign records direction")
          ?.has("/foundations/bridge-negative-numbers-direction/"),
      ).toBe(true);

      // 6. "Mean, variance and RMS": reaches exactly 1 destination
      expect(byName.get("Mean, variance and RMS")?.size).toBe(1);
      expect(byName.get("Mean, variance and RMS")?.has("/foundations/mean-variance-rms/")).toBe(
        true,
      );

      // 7. "Why?": 0 bare instances, each discriminated instance reaches 1 destination
      expect(byName.has("Why?")).toBe(false);
      const whyLinks = [...byName.entries()].filter(([name]) => name.startsWith("Why?: "));
      expect(whyLinks.length).toBe(6);
      for (const [_, hrefs] of whyLinks) {
        expect(hrefs.size).toBe(1);
      }

      // 8. "Show the missing step": 0 bare instances, each reaches 1 destination
      expect(byName.has("Show the missing step")).toBe(false);
      const stepLinks = [...byName.entries()].filter(([name]) =>
        name.startsWith("Show the missing step: "),
      );
      expect(stepLinks.length).toBe(6);
      for (const [_, hrefs] of stepLinks) {
        expect(hrefs.size).toBe(1);
      }

      // 9. "Show me one example first": 0 bare instances, each reaches 1 destination
      expect(byName.has("Show me one example first")).toBe(false);
      const exampleLinks = [...byName.entries()].filter(([name]) =>
        name.startsWith("Show me one example first: "),
      );
      expect(exampleLinks.length).toBe(6);
      for (const [_, hrefs] of exampleLinks) {
        expect(hrefs.size).toBe(1);
      }

      // 10. "Try it": 0 bare instances, each reaches 1 destination
      expect(byName.has("Try it")).toBe(false);
      const tryItLinks = [...byName.entries()].filter(([name]) => name.startsWith("Try it: "));
      expect(tryItLinks.length).toBe(4);
      for (const [_, hrefs] of tryItLinks) {
        expect(hrefs.size).toBe(1);
      }
      // AC2 exact requirement: bm-07 is labeled 'Molecular-number inference'
      expect(byName.get("Try it: Molecular-number inference")?.size).toBe(1);
      expect(byName.get("Try it: Molecular-number inference")?.has("/lab/bm-07/")).toBe(true);
    });

    test("benign set invariant: any name in benign set MUST resolve to identical anchor", async () => {
      // Invariant: every name in the benign set must actually appear in the rendered reader
      // and all its destinations must resolve to the exact same hash anchor.
      const jsx = await PaperReader({});
      const html = renderToStaticMarkup(jsx);
      const links = extractLinks(html);
      const byName = groupLinksByName(links);

      for (const benignName of BENIGN_SAME_TARGET_NAMES) {
        const hrefs = byName.get(benignName);
        expect(hrefs).toBeDefined();
        expect(hrefs?.size).toBeGreaterThan(1);
        const targets = [...(hrefs ?? [])].map((h) => {
          const hashIdx = h.indexOf("#");
          return hashIdx >= 0 ? h.slice(hashIdx) : h;
        });
        const uniqueTargets = new Set(targets);
        expect(uniqueTargets.size).toBe(1);
      }

      // Verify validator rejects an entry if hrefs diverge
      const invalidBenignCheck = (name: string, hrefs: Set<string>) => {
        if (!BENIGN_SAME_TARGET_NAMES.has(name)) {
          throw new Error(`Non-benign multi-destination link: ${name}`);
        }
        const targets = [...hrefs].map((h) => {
          const hashIdx = h.indexOf("#");
          return hashIdx >= 0 ? h.slice(hashIdx) : h;
        });
        const uniqueTargets = new Set(targets);
        if (uniqueTargets.size > 1) {
          throw new Error(
            `Defect: benign name ${name} maps to divergent targets: ${[...hrefs].join(", ")}`,
          );
        }
      };

      // Negative proof: differing anchors in benign set throws
      const divergingHrefs = new Set(["#section-1", "#section-2"]);
      expect(() => invalidBenignCheck("Zero average is not no movement", divergingHrefs)).toThrow(
        "Defect: benign name Zero average is not no movement maps to divergent targets",
      );
    });

    test("planted negative: reverting passage actions to bare 'Try it' fails gate", async () => {
      const jsx = await PaperReader({});
      let html = renderToStaticMarkup(jsx);
      // Revert aria-label on Try it links so they collapse back to bare 'Try it'
      html = html.replace(/aria-label="Try it: [^"]*"/g, "");
      const links = extractLinks(html);
      const byName = groupLinksByName(links);

      const tryItDestinations = byName.get("Try it");
      expect(tryItDestinations?.size).toBeGreaterThan(1);
      expect(BENIGN_SAME_TARGET_NAMES.has("Try it")).toBe(false);
    });

    test("planted negative: reverting passage actions to bare 'Why?' fails gate", async () => {
      const jsx = await PaperReader({});
      let html = renderToStaticMarkup(jsx);
      // Revert aria-label on Why? links so they collapse back to bare 'Why?'
      html = html.replace(/aria-label="Why\?: [^"]*"/g, "");
      const links = extractLinks(html);
      const byName = groupLinksByName(links);

      const whyDestinations = byName.get("Why?");
      expect(whyDestinations?.size).toBeGreaterThan(1);
      expect(BENIGN_SAME_TARGET_NAMES.has("Why?")).toBe(false);
    });

    test("planted negative: reverting equation prerequisites to bare 'Read the prerequisite' fails gate", async () => {
      const jsx = await PaperReader({});
      let html = renderToStaticMarkup(jsx);
      // Revert aria-label on prerequisite links
      html = html.replace(/aria-label="Read the prerequisite: [^"]*"/g, "");
      const links = extractLinks(html);
      const byName = groupLinksByName(links);

      const prereqDestinations = byName.get("Read the prerequisite");
      // 40 occurrences mapping to many distinct foundation destinations
      expect(prereqDestinations?.size).toBeGreaterThan(1);
      expect(BENIGN_SAME_TARGET_NAMES.has("Read the prerequisite")).toBe(false);
    });

    test("planted negative: reverting drawer full reading page links to bare label fails gate", async () => {
      const jsx = await PaperReader({});
      let html = renderToStaticMarkup(jsx);
      // Revert aria-label on full reading page links
      html = html.replace(/aria-label="Open [^"]* as a full reading page"/g, "");
      const links = extractLinks(html);
      const byName = groupLinksByName(links);

      const fullPageDestinations = byName.get("Open this as a full reading page →");
      expect(fullPageDestinations?.size).toBe(13);
      expect(BENIGN_SAME_TARGET_NAMES.has("Open this as a full reading page →")).toBe(false);
    });
  });
});
