import { describe, expect, test } from "bun:test";
import { isSitemapExemptUrl } from "../experiments/permalink/canonical.ts";
import {
  absoluteUrl,
  faceFallbackPath,
  listReadablePapers,
  paperPath,
} from "../reader/paperRoutes.ts";
import sitemap from "./sitemap.ts";

describe("sitemap", () => {
  test("lists home, compiled papers, sections, and German/English faces", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls[0]).toBe("https://annus-mirabilis.com/");
    const papers = await listReadablePapers();
    expect(papers.length).toBeGreaterThan(0);
    for (const paperId of papers) {
      expect(urls).toContain(absoluteUrl(paperPath(paperId)));
      expect(urls).toContain(absoluteUrl(faceFallbackPath(paperId, "german")));
      expect(urls).toContain(absoluteUrl(faceFallbackPath(paperId, "english")));
      expect(urls).not.toContain(absoluteUrl(faceFallbackPath(paperId, "results")));
    }
    expect(urls.some((url) => url.includes("ap-17-549"))).toBe(false);
  });

  test("strictly filters out tape permalinks and export paths via isSitemapExemptUrl", async () => {
    const entries = await sitemap();
    for (const entry of entries) {
      expect(isSitemapExemptUrl(entry.url)).toBe(false);
      expect(entry.url).not.toContain("tape=");
      expect(entry.url).not.toContain("/export");
      expect(entry.url.endsWith(".json")).toBe(false);
    }
    expect(isSitemapExemptUrl("https://annus-mirabilis.com/lab/bm-01/?tape=abc123")).toBe(true);
    expect(isSitemapExemptUrl("https://annus-mirabilis.com/lab/bm-01?x=1&tape=abc123")).toBe(true);
    expect(isSitemapExemptUrl("https://annus-mirabilis.com/export/data.json")).toBe(true);
  });
});
