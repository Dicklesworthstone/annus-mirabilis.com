import { describe, expect, test } from "bun:test";
import sitemap from "./sitemap.ts";

describe("sitemap", () => {
  test("lists home, compiled papers, sections, and German/English faces", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls[0]).toBe("https://annus-mirabilis.com/");
    expect(urls).toContain("https://annus-mirabilis.com/papers/brownian-motion/");
    expect(urls).toContain("https://annus-mirabilis.com/papers/brownian-motion/s4/");
    expect(urls).toContain("https://annus-mirabilis.com/papers/brownian-motion/view/german/");
    expect(urls).toContain("https://annus-mirabilis.com/papers/brownian-motion/view/english/");
    expect(urls).not.toContain("https://annus-mirabilis.com/papers/brownian-motion/view/results/");
    expect(urls.some((url) => url.includes("ap-17-549"))).toBe(false);
  });
});
