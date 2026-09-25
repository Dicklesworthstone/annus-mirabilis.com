import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import TracerPage from "../app/lab/bm-01/page.tsx";
import { getKernelListingsForInstrument } from "../content/kernel/listings.ts";
import { loadPaper } from "../content/server";
import { exportMarkup } from "../testing/exportMarkup.ts";
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

/** The Brownian section pages, which serve the equation cards the whole-paper page loads lazily. */
/**
 * Every section page of the whole-paper page's sections. The steps, with the lessons embedded in
 * them, are served there, and the whole-paper page lifts them in when they open (stepsBody.ts).
 */
async function stepsSectionPages(wholePage: string): Promise<readonly string[]> {
  const sections = new Set(
    [...wholePage.matchAll(/<section\b[^>]*\sid="(s\d+)"[^>]*class="reader-section"/g)].map(
      (m) => m[1] ?? "",
    ),
  );
  return Promise.all(
    [...sections].map(async (section) => exportMarkup(await PaperReader({ section }))),
  );
}

async function brownianSectionPagesHtml(): Promise<string> {
  const pages = await Promise.all(
    ["s4", "s5"].map(async (section) => exportMarkup(await PaperReader({ section }))),
  );
  return pages.join("\n");
}

// The names that may reach two hrefs: a passage's title, linked from the outline ("#id") and from
// the "Earlier step" line of a passage that names it as a prerequisite ("/papers/brownian-motion/#id").
// Both resolve to the same anchor, which the invariant test below checks for every name here. The set
// is read from the passages' prerequisites, so a new prerequisite edge joins it; it was a hand-typed
// census of five titles, which the sixth edge (arg-bm-kinetic-justification to
// arg-bm-osmotic-suspended) turned red although nothing collided.
const { arguments: BROWNIAN_PASSAGES } = await loadPaper("brownian-motion");
export const BENIGN_SAME_TARGET_NAMES = new Set(
  BROWNIAN_PASSAGES.filter((a) =>
    BROWNIAN_PASSAGES.some((b) => b.prerequisites.some((p) => p.id === a.id)),
  ).map((a) => a.title),
);

describe("PaperReader link accessible names (am-jmma)", () => {
  test("re-measurement: every name with genuinely differing destinations reaches exactly 1 destination", async () => {
    const jsx = await PaperReader({});
    const html = await exportMarkup(jsx);
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
    // 1. ShowTheCode tabs for bm-01 kernels, checked where the laboratory is served. The
    // reading's inline laboratory mounts on first opening, so its tabs are not in the reading's
    // served HTML; /lab/bm-01/ serves the same TracerLab with its show-the-code listings.
    const labByName = groupLinksByName(extractLinks(renderToStaticMarkup(TracerPage())));
    const bm01Listings = getKernelListingsForInstrument("bm-01");
    expect(bm01Listings.length).toBeGreaterThan(0);
    // Non-vacuous: some bm-01 listings name an equation, so some Mathematics tabs are checked.
    expect(bm01Listings.some((l) => l.equationId)).toBe(true);
    for (const listing of bm01Listings) {
      const wordsName = `In words: ${listing.exportName}`;
      const mathName = `Mathematics: ${listing.exportName}`;
      const implName = `Implementation: ${listing.exportName}`;

      expect(labByName.get(wordsName)?.size).toBe(1);
      // A Mathematics tab exists only where the function computes an equation (dispatch 178);
      // a listing that names none has no tab, where it used to have a heading over nothing.
      expect(labByName.get(mathName)?.size).toBe(listing.equationId ? 1 : undefined);
      expect(labByName.get(implName)?.size).toBe(1);
    }

    // 2. Section-only reading links
    const s4SectionName = "Section-only reading: §4 · From random displacement to diffusion";
    const s5SectionName = "Section-only reading: §5 · From displacement to molecular scale";
    expect(byName.get(s4SectionName)?.size).toBe(1);
    expect(byName.get(s5SectionName)?.size).toBe(1);

    // 3. Companion links: none. The switch is not rendered (Companion.tsx: a static export
    // cannot serve ?companion=, so each link reloaded the same page).
    expect(byName.get("Companion: Explanation")).toBeUndefined();
    expect(byName.get("Companion: Laboratory")).toBeUndefined();
    expect(byName.get("Explanation")?.size).toBe(1);
  });

  test("PaperPage on brownian-motion also isolates distinct destinations cleanly", async () => {
    const jsx = await PaperPage({ paperId: "brownian-motion" });
    const html = await exportMarkup(jsx);
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
      let html = await exportMarkup(jsx);
      // Strip aria-label from section-only reading links so they collapse to 'Section-only reading →'
      html = html.replace(/aria-label="Section-only reading: [^"]*"/g, "");
      const links = extractLinks(html);
      const byName = groupLinksByName(links);

      const multi = [...byName.entries()].filter(([_, hrefs]) => hrefs.size > 1);
      const unTriagedMulti = multi.filter(([name]) => !BENIGN_SAME_TARGET_NAMES.has(name));
      expect(unTriagedMulti.length).toBeGreaterThan(0);
      // One per section of the paper, read from the payload: the count grows as sections are
      // explained, and the property is that each section's link collapses to the one bare name.
      const { paper } = await loadPaper("brownian-motion");
      expect(paper.sections.length).toBeGreaterThan(1);
      expect(byName.get("Section-only reading →")?.size).toBe(paper.sections.length);
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
      const html = await exportMarkup(jsx);
      const links = extractLinks(html);
      const byName = groupLinksByName(links);

      // 1. "Read the prerequisite": 0 bare instances, all discriminated, each reaches exactly 1
      // destination. Checked on the section pages, where the equation cards that carry these
      // links are served: the whole-paper page loads its cards, and its laboratory, on opening.
      const sectionByName = groupLinksByName(extractLinks(await brownianSectionPagesHtml()));
      expect(sectionByName.has("Read the prerequisite")).toBe(false);
      const prereqLinks = [...sectionByName.entries()].filter(([name]) =>
        name.startsWith("Read the prerequisite: "),
      );
      expect(prereqLinks.length).toBeGreaterThan(0);
      for (const [_, hrefs] of prereqLinks) {
        expect(hrefs.size).toBe(1);
      }

      // Classes 2, 4, 5 and 6 name lessons that the steps embed, and the steps are served on the
      // section pages (the whole-paper page lifts them in when they open). Each page is checked
      // on its own: wherever the name appears it reaches exactly its one destination, and it
      // appears on at least one page.
      const pages = [html, ...(await stepsSectionPages(html))];
      expect(pages.length).toBeGreaterThan(1);
      const reachesOnly = (name: string, href: string) => {
        const found = pages
          .map((page) => groupLinksByName(extractLinks(page)).get(name))
          .filter((hrefs) => hrefs !== undefined);
        expect(found.length).toBeGreaterThan(0);
        for (const hrefs of found) expect([...hrefs]).toEqual([href]);
      };

      // 2. "Adding and averaging": reaches exactly 1 destination (/foundations/bridge-sum-average/)
      reachesOnly("Adding and averaging", "/foundations/bridge-sum-average/");

      // 3. "Open this as a full reading page →" / "Open this as a full reading page": 0 bare instances
      expect(byName.has("Open this as a full reading page →")).toBe(false);
      expect(byName.has("Open this as a full reading page")).toBe(false);
      const fullReadingLinks = [...byName.entries()].filter(
        ([name]) => name.startsWith("Open ") && name.endsWith(" as a full reading page"),
      );
      // One discriminated link per foundation panel in the clarification dialog. The number of
      // panels is the paper's foundation set, which grows when an equation note cites a new lesson
      // (13 became 20 with nine Brownian records), so it is read from the payload, not frozen.
      const { foundations } = await loadPaper("brownian-motion");
      expect(foundations.length).toBeGreaterThan(1);
      expect(fullReadingLinks.length).toBe(foundations.length);
      for (const [_, hrefs] of fullReadingLinks) {
        expect(hrefs.size).toBe(1);
      }

      // 4. "Squares and square roots": reaches exactly 1 destination
      reachesOnly("Squares and square roots", "/foundations/bridge-squaring-square-roots/");

      // 5. "A sign records direction": reaches exactly 1 destination
      reachesOnly("A sign records direction", "/foundations/bridge-negative-numbers-direction/");

      // 6. "Mean, variance and RMS": reaches exactly 1 destination
      reachesOnly("Mean, variance and RMS", "/foundations/mean-variance-rms/");

      // 7. "Why?": 0 bare instances, each discriminated instance reaches 1 destination. One per
      // passage, so the number follows the argument records rather than a frozen census.
      const { arguments: passages } = await loadPaper("brownian-motion");
      expect(passages.length).toBeGreaterThan(1);
      expect(byName.has("Why?")).toBe(false);
      const whyLinks = [...byName.entries()].filter(([name]) => name.startsWith("Why?: "));
      expect(whyLinks.length).toBe(passages.length);
      for (const [_, hrefs] of whyLinks) {
        expect(hrefs.size).toBe(1);
      }

      // 8. "Show the missing step": 0 bare instances, each reaches 1 destination
      expect(byName.has("Show the missing step")).toBe(false);
      const stepLinks = [...byName.entries()].filter(([name]) =>
        name.startsWith("Show the missing step: "),
      );
      expect(stepLinks.length).toBe(passages.length);
      for (const [_, hrefs] of stepLinks) {
        expect(hrefs.size).toBe(1);
      }

      // 9. "Show me one example first": 0 bare instances, each reaches 1 destination
      expect(byName.has("Show me one example first")).toBe(false);
      // No census here. The label renders only where a passage's example lesson differs from
      // its Why? and missing-step lessons, so how many there are follows the argument records;
      // the property below holds at any count. Sections 7 and 8 keep the help family non-empty.
      const exampleLinks = [...byName.entries()].filter(([name]) =>
        name.startsWith("Show me one example first: "),
      );
      for (const [_, hrefs] of exampleLinks) {
        expect(hrefs.size).toBe(1);
      }

      // 10. "Try it": 0 bare instances, each reaches 1 destination
      expect(byName.has("Try it")).toBe(false);
      const tryItLinks = [...byName.entries()].filter(([name]) => name.startsWith("Try it: "));
      // One per distinct laboratory that some passage opens first (its "Try it").
      const firstLabs = new Set(passages.flatMap((a) => a.experiments.slice(0, 1)));
      expect(firstLabs.size).toBeGreaterThan(1);
      expect(tryItLinks.length).toBe(firstLabs.size);
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
      const html = await exportMarkup(jsx);
      const links = extractLinks(html);
      const byName = groupLinksByName(links);

      // Non-vacuity: the set is derived, so an empty one would pass the loop below unexamined.
      expect(BENIGN_SAME_TARGET_NAMES.size).toBeGreaterThan(0);
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
      let html = await exportMarkup(jsx);
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
      let html = await exportMarkup(jsx);
      // Revert aria-label on Why? links so they collapse back to bare 'Why?'
      html = html.replace(/aria-label="Why\?: [^"]*"/g, "");
      const links = extractLinks(html);
      const byName = groupLinksByName(links);

      const whyDestinations = byName.get("Why?");
      expect(whyDestinations?.size).toBeGreaterThan(1);
      expect(BENIGN_SAME_TARGET_NAMES.has("Why?")).toBe(false);
    });

    test("planted negative: reverting equation prerequisites to bare 'Read the prerequisite' fails gate", async () => {
      let html = await brownianSectionPagesHtml();
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
      let html = await exportMarkup(jsx);
      // Revert aria-label on full reading page links
      html = html.replace(/aria-label="Open [^"]* as a full reading page"/g, "");
      const links = extractLinks(html);
      const byName = groupLinksByName(links);

      const fullPageDestinations = byName.get("Open this as a full reading page →");
      const { foundations } = await loadPaper("brownian-motion");
      expect(foundations.length).toBeGreaterThan(1);
      expect(fullPageDestinations?.size).toBe(foundations.length);
      expect(BENIGN_SAME_TARGET_NAMES.has("Open this as a full reading page →")).toBe(false);
    });
  });
});
