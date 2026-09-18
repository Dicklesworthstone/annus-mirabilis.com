import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { isDiscoveryPaperSlug } from "../../discovery/journeyRegistry.ts";
import DiscoverPaperPage, {
  dynamicParams,
  generateMetadata,
  generateStaticParams,
} from "./[paper]/page.tsx";

describe("Discover [paper] route contracts and page rendering", () => {
  test("dynamicParams is false to prevent unbounded dynamic route generation", () => {
    expect(dynamicParams).toBe(false);
  });

  test("generateStaticParams returns exactly the 4 paper slugs", async () => {
    const params = await generateStaticParams();
    expect(params).toEqual([
      { paper: "light-quanta" },
      { paper: "brownian-motion" },
      { paper: "special-relativity" },
      { paper: "mass-energy" },
    ]);
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

  test("renders Brownian motion journey page with slate theme", async () => {
    const pageElement = await DiscoverPaperPage({
      params: Promise.resolve({ paper: "brownian-motion" }),
    });
    const html = renderToStaticMarkup(pageElement);

    expect(html).toContain('data-theme="slate"');
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
