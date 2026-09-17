import { describe, expect, test } from "bun:test";
import {
  absoluteUrl,
  faceFallbackPath,
  listReadablePapers,
  paperMetadata,
  paperPath,
  readerSitemapEntries,
} from "./paperRoutes.ts";

describe("canonical and hreflang policy", () => {
  test("the reading face is canonical at the paper and section routes", async () => {
    const papers = await listReadablePapers();
    expect(papers.length).toBeGreaterThan(0);
    const paperId = papers[0];
    if (paperId === undefined) throw new Error("no compiled papers");
    const paper = await paperMetadata({ paperId });
    expect(paper.alternates?.canonical).toBe(absoluteUrl(paperPath(paperId)));
    const payload = await (await import("../content/server.ts")).loadPaper(paperId);
    const sectionId = payload.paper.sections[0]?.id;
    expect(sectionId).toBeDefined();
    const section = await paperMetadata({ paperId, section: sectionId });
    expect(section.alternates?.canonical).toBe(absoluteUrl(paperPath(paperId, sectionId)));
  });

  test("german and english fallbacks are self-canonical with hreflang alternates", async () => {
    const papers = await listReadablePapers();
    const paperId = papers[0];
    if (paperId === undefined) throw new Error("no compiled papers");
    const german = await paperMetadata({ paperId, face: "german" });
    expect(german.alternates?.canonical).toBe(absoluteUrl(faceFallbackPath(paperId, "german")));
    expect(german.alternates?.languages).toEqual({
      de: absoluteUrl(faceFallbackPath(paperId, "german")),
      en: absoluteUrl(faceFallbackPath(paperId, "english")),
    });
    const english = await paperMetadata({ paperId, face: "english" });
    expect(english.alternates?.canonical).toBe(absoluteUrl(faceFallbackPath(paperId, "english")));
  });

  test("results, gloss, parallel, split, and facsimile fallbacks canonicalise to the paper route", async () => {
    const papers = await listReadablePapers();
    const paperId = papers[0];
    if (paperId === undefined) throw new Error("no compiled papers");
    for (const face of ["results", "gloss", "parallel", "split", "facsimile"] as const) {
      const meta = await paperMetadata({ paperId, face });
      expect(meta.alternates?.canonical).toBe(absoluteUrl(paperPath(paperId)));
      expect(meta.alternates?.languages).toBeUndefined();
    }
  });

  test("the sitemap lists papers, sections, and the German and English faces, not other fallbacks", async () => {
    const papers = await listReadablePapers();
    const entries = await readerSitemapEntries();
    const urls = entries.map((e) => e.url);
    for (const paperId of papers) {
      expect(urls).toContain(absoluteUrl(paperPath(paperId)));
      expect(urls).toContain(absoluteUrl(faceFallbackPath(paperId, "german")));
      expect(urls).toContain(absoluteUrl(faceFallbackPath(paperId, "english")));
      expect(urls).not.toContain(absoluteUrl(faceFallbackPath(paperId, "results")));
      expect(urls).not.toContain(absoluteUrl(faceFallbackPath(paperId, "split")));
    }
    expect(urls.some((url) => url.includes("ap-17-549"))).toBe(false);
  });
});
