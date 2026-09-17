/**
 * Tests for Root OpenGraph Image Generator (am-scaf-extract-ui-components-c31).
 */

import { describe, expect, test } from "bun:test";
import Image, { alt, contentType, size } from "./opengraph-image.tsx";

describe("Root OpenGraph Image Generator", () => {
  test("exports standard 1200x630 dimensions and png content type", () => {
    expect(size.width).toBe(1200);
    expect(size.height).toBe(630);
    expect(contentType).toBe("image/png");
    expect(alt).toContain("Annus Mirabilis");
  });

  test("generates valid ImageResponse instance with image/png content-type", async () => {
    const res = await Image();
    expect(res).toBeDefined();
    expect(res.headers.get("content-type")).toContain("image/png");
  });
});
