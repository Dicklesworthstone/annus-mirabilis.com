import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  DISCOVERY_PAPER_SLUGS,
  isDiscoveryPaperSlug,
  UNWRITTEN_DISCOVERY_ROUTES,
  WRITTEN_DISCOVERY_ROUTES,
} from "../../discovery/journeyRegistry.ts";

/**
 * THIS SUITE USED TO IMPORT `./[paper]/page.tsx` AND TEST ITS RENDERING. THAT SEGMENT NO LONGER
 * SERVES A URL, SO THOSE TESTS WERE REMOVED RATHER THAN REPOINTED AT THE RETIRED FILE.
 *
 * What happened, so the removal is auditable rather than convenient. The dynamic segment existed
 * to serve discovery routes that had no hand-authored page, and `dynamicParams = false` meant it
 * served nothing else. Writing the fourth route on 2026-09-22 emptied the unwritten set, so
 * `generateStaticParams` returned `[]`, and under `output: export` Next reads an empty param list
 * as a missing function:
 *
 *     [Error: Page "/discover/[paper]" is missing "generateStaticParams()"
 *      so it cannot be used with "output: export" config.]
 *
 * Main did not build. The segment was moved to `_retired_paper_route/`, which Next excludes from
 * routing, so nothing was destroyed and the move is reversible.
 *
 * FIVE TESTS WERE DROPPED AND ONE THING GENUINELY LOSES COVERAGE. The two `generateMetadata`
 * tests, the two render tests and the `notFound` test all exercised that module. Four of the five
 * covered behaviour the four hand-authored pages now provide directly and cover themselves. The
 * fifth rendered `JourneyInPreparation`, which has no caller left; the component and its file are
 * untouched, and it is honest to say its coverage is now zero rather than to keep a green test
 * over a module no reader can reach.
 *
 * THE REPLACEMENT IS STRONGER THAN WHAT IT REPLACES. Nothing previously caught "a declared slug
 * with neither a page nor a fallback" until `next build` failed with the message above, which
 * names the wrong cause. The first test below catches it in milliseconds and says what to do.
 */
describe("Discover route declarations against the filesystem", () => {
  const pageFor = (slug: string) => resolve(import.meta.dirname, slug, "page.tsx");

  test("no dynamic segment serves /discover, so every declared slug needs its own page", () => {
    // Not a census. This asserts the precondition that makes the build work: with the fallback
    // gone, an unwritten slug has nothing to serve it, and Next's refusal names the wrong cause.
    expect(
      existsSync(resolve(import.meta.dirname, "[paper]")),
      "a dynamic [paper] segment is back; if that is deliberate, it must generate a non-empty " +
        "param list, because output: export reads an empty one as a missing generateStaticParams",
    ).toBe(false);
    expect(
      UNWRITTEN_DISCOVERY_ROUTES.length,
      `these slugs are declared but unwritten and nothing serves them: ` +
        `${UNWRITTEN_DISCOVERY_ROUTES.join(", ")}. Either write ` +
        `src/app/discover/<slug>/page.tsx for each, or restore a dynamic segment that generates ` +
        `exactly them. Leaving it is a production build failure, not a missing page.`,
    ).toBe(0);
  });

  test("every written slug has a page module and every unwritten slug has none", () => {
    // The load-bearing one: it compares the DECLARATION against the FILESYSTEM, so it fails
    // when someone adds a route page without declaring it, or declares one without writing it.
    // Nothing else in the suite can see that disagreement.
    //
    // Non-vacuity is asserted on the WRITTEN set only. It once required an unwritten route too,
    // and that was the census-as-assertion trap AGENTS.md records: the fourth route was written
    // on 2026-09-22, the unwritten set became empty, and a test whose subject is a partition went
    // red on the work succeeding. An empty unwritten set is a correct end state, and the partition
    // assertion below is what keeps the pair honest when one side is empty.
    expect(WRITTEN_DISCOVERY_ROUTES.length).toBeGreaterThan(0);
    for (const slug of WRITTEN_DISCOVERY_ROUTES) {
      expect(existsSync(pageFor(slug)), `written route ${slug} must have a page module`).toBe(true);
    }
    for (const slug of UNWRITTEN_DISCOVERY_ROUTES) {
      expect(existsSync(pageFor(slug)), `unwritten route ${slug} must NOT have a page`).toBe(false);
    }
  });

  test("written and unwritten partition the four slugs, with nothing in both", () => {
    const written = new Set<string>(WRITTEN_DISCOVERY_ROUTES);
    const unwritten = new Set<string>(UNWRITTEN_DISCOVERY_ROUTES);
    for (const slug of written) expect(unwritten.has(slug)).toBe(false);
    expect([...written, ...unwritten].sort()).toEqual([...DISCOVERY_PAPER_SLUGS].sort());
    expect(written.size + unwritten.size).toBe(DISCOVERY_PAPER_SLUGS.length);
  });

  test("isDiscoveryPaperSlug recognizes the 4 papers and rejects molecular-dimensions and unknown slugs", () => {
    expect(isDiscoveryPaperSlug("light-quanta")).toBe(true);
    expect(isDiscoveryPaperSlug("brownian-motion")).toBe(true);
    expect(isDiscoveryPaperSlug("special-relativity")).toBe(true);
    expect(isDiscoveryPaperSlug("mass-energy")).toBe(true);
    expect(isDiscoveryPaperSlug("molecular-dimensions")).toBe(false);
    expect(isDiscoveryPaperSlug("quantum-mechanics")).toBe(false);
  });
});
