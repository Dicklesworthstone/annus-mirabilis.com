import { describe, expect, test } from "bun:test";
import {
  absoluteUrl,
  faceFallbackPath,
  paperMetadata,
  paperPath,
  readerSitemapEntries,
} from "./paperRoutes.ts";

describe("canonical and hreflang policy", () => {
  test("the reading face is canonical at the paper and section routes", async () => {
    const paper = await paperMetadata({ paperId: "brownian-motion" });
    expect(paper.alternates?.canonical).toBe(absoluteUrl(paperPath("brownian-motion")));
    const section = await paperMetadata({ paperId: "brownian-motion", section: "s4" });
    expect(section.alternates?.canonical).toBe(absoluteUrl(paperPath("brownian-motion", "s4")));
  });

  test("german and english fallbacks are self-canonical with hreflang alternates", async () => {
    const german = await paperMetadata({ paperId: "brownian-motion", face: "german" });
    expect(german.alternates?.canonical).toBe(
      absoluteUrl(faceFallbackPath("brownian-motion", "german")),
    );
    expect(german.alternates?.languages).toEqual({
      de: absoluteUrl(faceFallbackPath("brownian-motion", "german")),
      en: absoluteUrl(faceFallbackPath("brownian-motion", "english")),
    });
    const english = await paperMetadata({ paperId: "brownian-motion", face: "english" });
    expect(english.alternates?.canonical).toBe(
      absoluteUrl(faceFallbackPath("brownian-motion", "english")),
    );
  });

  test("results, gloss, parallel, split, and facsimile fallbacks canonicalise to the paper route", async () => {
    for (const face of ["results", "gloss", "parallel", "split", "facsimile"] as const) {
      const meta = await paperMetadata({ paperId: "brownian-motion", face });
      expect(meta.alternates?.canonical).toBe(absoluteUrl(paperPath("brownian-motion")));
      expect(meta.alternates?.languages).toBeUndefined();
    }
  });

  test("the sitemap lists papers, sections, and the German and English faces, not other fallbacks", async () => {
    const entries = await readerSitemapEntries();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(absoluteUrl(paperPath("brownian-motion")));
    expect(urls).toContain(absoluteUrl(paperPath("brownian-motion", "s4")));
    expect(urls).toContain(absoluteUrl(faceFallbackPath("brownian-motion", "german")));
    expect(urls).toContain(absoluteUrl(faceFallbackPath("brownian-motion", "english")));
    expect(urls).not.toContain(absoluteUrl(faceFallbackPath("brownian-motion", "results")));
    expect(urls).not.toContain(absoluteUrl(faceFallbackPath("brownian-motion", "split")));
    expect(urls.some((url) => url.includes("ap-17-549"))).toBe(false);
  });
});
