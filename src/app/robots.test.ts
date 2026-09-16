import { describe, expect, test } from "bun:test";
import robots from "./robots";

describe("robots", () => {
  test("allows indexing and references the sitemap", () => {
    const result = robots();
    expect(result.rules).toEqual({ userAgent: "*", allow: "/" });
    expect(result.sitemap).toBe("https://annus-mirabilis.com/sitemap.xml");
  });
});
