import { describe, expect, test } from "bun:test";
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
});
