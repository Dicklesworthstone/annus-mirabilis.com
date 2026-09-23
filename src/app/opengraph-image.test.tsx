/**
 * Tests for the root Open Graph image (am-scaf-extract-ui-components-c31): the card every page
 * without a card of its own shares. It is the site card from src/components/share/shareCards.tsx,
 * whose own test reads every card's pixels for ink in the margin and for network font requests
 * (am-ecuf, am-jfyo). This file checks that the route exports that card, at that size.
 */

import { describe, expect, test } from "bun:test";
import { CARD } from "../components/share/shareCards.tsx";
import { decodePng } from "../testing/decodePng.ts";
import Image, { alt, contentType, size } from "./opengraph-image.tsx";

describe("Root OpenGraph Image", () => {
  test("exports the card's 1200x630 size, a png content type, and a text alternative", () => {
    expect(size).toEqual(CARD);
    expect(size.width).toBe(1200);
    expect(size.height).toBe(630);
    expect(contentType).toBe("image/png");
    expect(alt).toContain("first printed pages");
    // The old card's claims, neither of them true: no translation exists yet, and the fourth
    // paper never writes the formula it was labelled with.
    expect(alt).not.toContain("translation");
    expect(alt).not.toContain("mc²");
  });

  test("renders a png of exactly that size", async () => {
    const response = await Image();
    expect(response.headers.get("content-type")).toContain("image/png");
    const image = decodePng(Buffer.from(await response.arrayBuffer()));
    expect([image.width, image.height]).toEqual([size.width, size.height]);
  });
});
