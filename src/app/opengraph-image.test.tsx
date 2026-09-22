/**
 * Tests for Root OpenGraph Image Generator (am-scaf-extract-ui-components-c31).
 */

import { describe, expect, test } from "bun:test";
import { countPixelsUnlike, decodePng, pixelAt } from "../testing/decodePng.ts";
import Image, { alt, contentType, size } from "./opengraph-image.tsx";

/**
 * The card's padding gutter, derived rather than guessed: 1200 wide, a 16px border on
 * each side, 70px of padding inside that. Content therefore occupies x in [86, 1114),
 * and anything drawn outside it has escaped the layout. If the border or padding
 * changes, these change with it - and re-verifying the emitted image at that point is
 * the correct amount of work, because that IS a layout change.
 */
const BORDER = 16;
const PADDING = 70;

describe("Root OpenGraph Image Generator", () => {
  test("exports standard 1200x630 dimensions and png content type", () => {
    expect(size.width).toBe(1200);
    expect(size.height).toBe(630);
    expect(contentType).toBe("image/png");
    expect(alt).toContain("Annus Mirabilis");
  });

  // am-ecuf. The headline was authored as two lines separated by <br />, and the emitted
  // card showed one line running off the right edge: "Albert Einstein's Miraculous Year,
  // Decoded &" cut mid-glyph, with "Made Interactive." absent entirely. Every existing
  // check passed, because every existing check read the markup, and the markup said
  // <br />. This image is rendered by Satori at build time, where <br /> is not a line
  // break. The only witness is the image.
  test("no ink escapes the card's padding gutter", async () => {
    const image = decodePng(Buffer.from(await (await Image()).arrayBuffer()));
    expect(image.width).toBe(size.width);
    expect(image.height).toBe(size.height);

    // Sampled from the lower middle, which is background in any layout this card has.
    const background = pixelAt(image, Math.floor(image.width / 2), Math.floor(image.height * 0.72));

    const gutters = [
      { name: "left", x0: BORDER, x1: BORDER + PADDING },
      { name: "right", x0: image.width - BORDER - PADDING, x1: image.width - BORDER },
    ];
    const escaped: string[] = [];
    for (const gutter of gutters) {
      const { count, firstRow } = countPixelsUnlike(image, background, {
        x0: gutter.x0,
        y0: BORDER,
        x1: gutter.x1,
        y1: image.height - BORDER,
      });
      if (count > 0) {
        escaped.push(
          `${gutter.name} gutter x[${gutter.x0},${gutter.x1}): ${count} non-background pixels, first at y=${firstRow}`,
        );
      }
    }
    expect(escaped).toEqual([]);
  });

  // am-ecuf, SETTLED BY MEASUREMENT AND STILL REACHABLE. The string this bead named is gone:
  // 1eb7da05 replaced "Albert Einstein's Miraculous Year," / "Decoded & Made Interactive." with
  // the current two lines, so "loses Made Interactive" cannot happen by construction. The gutter
  // check above passes, and it is not passing because the card is blank - the headline band
  // x[86,1114) y[180,340) carries 18,427 non-background pixels, first row y=225.
  //
  // WHAT FIXED IT IS NOT WHAT THE SOURCE SAYS FIXED IT. opengraph-image.tsx attributes the repair
  // to `maxWidth: 1028px`: "A headline longer than one line now wraps inside the card instead of
  // leaving it." That is not load-bearing. Planted against it directly - ceiling lifted to 4000px
  // AND the two lines joined into one long wrappable run - and the gutter check still PASSED,
  // because Satori wraps at the parent flex container's width regardless of the ceiling. The half
  // that does the work is the other one: two explicit children of a column flex container in
  // place of a <br />, which Satori does not treat as a line break.
  //
  // THE MECHANISM IS LATENT, NOT REMOVED. Text that cannot break still escapes the card. Planted
  // a 62-character unbreakable run in place of the first line and the right gutter x[1114,1184)
  // reported 924 non-background pixels at y=228, failing the check above. No authored string
  // triggers it today. The change that re-opens this bead is a headline that stops being authored
  // prose - an id, a URL, a hyphen-free compound, anything data-driven - and at that point the
  // repair is a break rule on the h1, not a wider ceiling, for the reason the plant above gives.

  // am-jfyo. Every build printed "Failed to load dynamic font for ✦ . Error: Failed to
  // download dynamic font. Status: 400" and shipped the brand mark as an empty
  // missing-glyph box. next/og reaches the NETWORK for any glyph its built-in font does
  // not cover, and this file's own header has claimed since the donor extraction that
  // it makes no third-party font request. The claim was false for that one glyph, on
  // every build, and nothing checked it - the warning was only ever read by a person
  // watching build output scroll past.
  //
  // The warning arrives on console.error, verified by intercepting each channel in turn.
  test("rendering the card fetches no font over the network", async () => {
    const messages: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      messages.push(args.map(String).join(" "));
      original(...args);
    };
    try {
      await (await Image()).arrayBuffer();
    } finally {
      console.error = original;
    }
    expect(messages.filter((message) => /dynamic font/i.test(message))).toEqual([]);
  });

  test("generates valid ImageResponse instance with image/png content-type", async () => {
    const res = await Image();
    expect(res).toBeDefined();
    expect(res.headers.get("content-type")).toContain("image/png");
  });
});
