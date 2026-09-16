import { describe, expect, test } from "bun:test";
import sitemap from "./sitemap";

describe("sitemap", () => {
  test("contains exactly the canonical home URL for the empty corpus", () => {
    const entries = sitemap();
    expect(entries).toEqual([{ url: "https://annus-mirabilis.com/" }]);
  });
});
