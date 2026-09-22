import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DISCOVERY_PAPER_SLUGS,
  isDiscoveryPaperSlug,
  UNWRITTEN_DISCOVERY_ROUTES,
  WRITTEN_DISCOVERY_ROUTES,
} from "../../discovery/journeyRegistry.ts";
import DiscoverPaperPage, {
  dynamicParams,
  generateMetadata,
  generateStaticParams,
} from "./[paper]/page.tsx";

describe("Discover [paper] route contracts and page rendering", () => {
  test("dynamicParams is false to prevent unbounded dynamic route generation", () => {
    expect(dynamicParams).toBe(false);
  });

  /**
   * THIS ASSERTED ALL FOUR SLUGS UNTIL 1555fc88, AND THE CONTRACT CHANGED UNDER IT.
   *
   * A written route is a hand-authored page at src/app/discover/<slug>/page.tsx. That static
   * segment wins over this dynamic one, so generating a param for such a slug produced two route
   * files claiming one URL while this module went on deciding, from JOURNEY_MAP, what to say
   * about a route it never served. The dynamic segment now generates only the unwritten slugs.
   *
   * The replacement is deliberately STRONGER than what it replaces rather than looser. The old
   * assertion could only ever have caught a change to this one function. These three catch the
   * failure the seam actually had: a declaration and a filesystem that disagree.
   */
  test("generateStaticParams returns exactly the unwritten slugs, by name", async () => {
    const params = await generateStaticParams();
    expect(params).toEqual(UNWRITTEN_DISCOVERY_ROUTES.map((paper) => ({ paper })));
    for (const slug of WRITTEN_DISCOVERY_ROUTES) {
      expect(params).not.toContainEqual({ paper: slug });
    }
  });

  test("every written slug has a page module and every unwritten slug has none", () => {
    // The load-bearing one: it compares the DECLARATION against the FILESYSTEM, so it fails
    // when someone adds a route page without declaring it, or declares one without writing it.
    // Nothing else in the suite can see that disagreement.
    const pageFor = (slug: string) =>
      resolve(import.meta.dirname, "..", "..", "app", "discover", slug, "page.tsx");
    expect(WRITTEN_DISCOVERY_ROUTES.length).toBeGreaterThan(0);
    for (const slug of WRITTEN_DISCOVERY_ROUTES) {
      expect(existsSync(pageFor(slug)), `written route ${slug} must have a page module`).toBe(true);
    }
    expect(UNWRITTEN_DISCOVERY_ROUTES.length).toBeGreaterThan(0);
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

  test("generateMetadata generates descriptive title for valid paper", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ paper: "brownian-motion" }) });
    expect(meta.title).toContain("On the Movement of Small Particles");
  });

  test("generateMetadata returns fallback title for invalid paper", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ paper: "unknown-paper" }) });
    expect(meta.title).toBe("Not in the edition");
  });

  test("renders Brownian motion journey page with kramgasse-night theme", async () => {
    const pageElement = await DiscoverPaperPage({
      params: Promise.resolve({ paper: "brownian-motion" }),
    });
    const html = renderToStaticMarkup(pageElement);

    expect(html).toContain('data-theme="kramgasse-night"');
    expect(html).toContain('data-journey-id="brownian-motion"');
    expect(html).toContain(
      "Suspended microscopic particles in a liquid at rest never settle into permanent stillness.",
    );
  });

  test("renders JourneyInPreparation for unpublished paper in production profile with bibliographic props", async () => {
    const originalEnv = process.env.BUILD_PROFILE;
    try {
      process.env.BUILD_PROFILE = "production";
      const pageElement = await DiscoverPaperPage({
        params: Promise.resolve({ paper: "light-quanta" }),
      });
      const html = renderToStaticMarkup(pageElement);

      expect(html).toContain("This journey is in preparation.");
      expect(html).toContain(
        "Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt",
      );
      expect(html).toContain(
        "On a Heuristic Point of View Concerning the Production and Transformation of Light",
      );
      expect(html).toContain("Ann. Phys. (4) 17, 132–148 (1905)");
      expect(html).toContain('href="/papers/light-quanta/"');
    } finally {
      process.env.BUILD_PROFILE = originalEnv;
    }
  });

  test("throws notFound error when paper slug is invalid", async () => {
    expect(
      DiscoverPaperPage({ params: Promise.resolve({ paper: "molecular-dimensions" }) }),
    ).rejects.toThrow();
  });
});
