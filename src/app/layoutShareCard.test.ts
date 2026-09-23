/**
 * The share image every page without a card of its own inherits from the root layout.
 *
 * It was the opengraph-image.tsx convention, whose URL has no extension; on Vercel that answered
 * 308 to a trailing slash and then served the PNG as application/octet-stream, which link previews
 * reject. The layout now names the same card at /share/home.png. These check the property that
 * makes it work, for both Open Graph and Twitter: every image named is a .png path under /share/
 * whose id the share route publishes.
 */

import { describe, expect, test } from "bun:test";
import type { Metadata } from "next";
import { shareCardIds } from "../components/share/shareCards.tsx";
import { alt as fileCardAlt } from "./_opengraph-image.tsx";
import { metadata } from "./layout.tsx";

type ImageEntry = string | URL | { url: string | URL; alt?: string; type?: string };

function entries(images: unknown): ImageEntry[] {
  if (images === undefined) return [];
  return (Array.isArray(images) ? images : [images]) as ImageEntry[];
}

function urlOf(image: ImageEntry): string {
  return typeof image === "string" || image instanceof URL ? String(image) : String(image.url);
}

const sources: [string, unknown][] = [
  ["openGraph", (metadata as Metadata).openGraph?.images],
  ["twitter", (metadata as Metadata).twitter?.images],
];

describe("the root layout's share image", () => {
  for (const [name, images] of sources) {
    test(`${name}: names at least one image, each a published /share/<id>.png`, () => {
      const list = entries(images);
      // Without this, a layout that named no image would pass the loop below by skipping it.
      expect(list.length).toBeGreaterThan(0);
      for (const image of list) {
        const match = /^\/share\/([a-z0-9-]+)\.png$/.exec(urlOf(image));
        expect(match).not.toBeNull();
        expect(shareCardIds()).toContain(match?.[1] as string);
        if (typeof image === "object" && !(image instanceof URL)) {
          expect(image.type).toBe("image/png");
        }
      }
    });
  }

  test("describes the card in the words the file convention's card uses", () => {
    const list = entries((metadata as Metadata).openGraph?.images);
    const first = list[0];
    expect(typeof first === "object" && !(first instanceof URL) ? first.alt : undefined).toBe(
      fileCardAlt,
    );
  });
});
