import { describe, expect, test } from "bun:test";
import { decodePng, pixelAt } from "../../testing/decodePng.ts";
import { loadFirstPages } from "../home/firstPages.ts";
import { CARD, CARD_MARGIN, LAB_CARDS, renderShareCard, shareCardIds } from "./shareCards.tsx";

/**
 * The share cards are images drawn at build time, so the only witness to what they show is the
 * image. am-ecuf found a headline running off the old card while every check that read the markup
 * passed; these read the pixels.
 */

async function png(id: string) {
  const card = renderShareCard(id);
  expect(card, id).not.toBeNull();
  return decodePng(Buffer.from(await (card as Response).arrayBuffer()));
}

const grey = ([r, g, b]: [number, number, number]) => 0.299 * r + 0.587 * g + 0.114 * b;

describe("share cards", () => {
  test("there is a card for the site, each of the four papers, and each instrument that has one", () => {
    expect(shareCardIds()).toEqual([
      "home",
      ...loadFirstPages().map((paper) => paper.slug),
      ...Object.keys(LAB_CARDS),
    ]);
    expect(shareCardIds()).toHaveLength(6);
  });

  // Ink is anything darker than 200 of 255. The plate's soft shadow reaches into the margin by
  // design and measured 223 at its darkest; text and the page's own print are far darker.
  test("every card is 1200x630 and draws no ink within its margin", async () => {
    const escaped: string[] = [];
    for (const id of shareCardIds()) {
      const image = await png(id);
      expect([image.width, image.height], id).toEqual([CARD.width, CARD.height]);
      for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
          const inMargin =
            x < CARD_MARGIN ||
            x >= image.width - CARD_MARGIN ||
            y < CARD_MARGIN ||
            y >= image.height - CARD_MARGIN;
          if (inMargin && grey(pixelAt(image, x, y)) < 200) {
            escaped.push(`${id} (${x}, ${y})`);
            break;
          }
        }
      }
    }
    expect(escaped).toEqual([]);
  });

  test("the margin check sees ink: a card's plate and text are inside it", async () => {
    // Without this, a blank card would pass the check above.
    const image = await png("light-quanta");
    let ink = 0;
    for (let y = CARD_MARGIN; y < image.height - CARD_MARGIN; y += 2) {
      for (let x = CARD_MARGIN; x < image.width - CARD_MARGIN; x += 2) {
        if (grey(pixelAt(image, x, y)) < 200) ink++;
      }
    }
    expect(ink).toBeGreaterThan(5000);
  });

  // am-jfyo. next/og fetches any glyph its fonts lack from a font service, and says so only on
  // console.error. The cards set German titles, dashes and middle dots in the site's own fonts;
  // one uncovered glyph would be a request from every build.
  test("rendering every card fetches no font over the network", async () => {
    const messages: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      messages.push(args.map(String).join(" "));
      original(...args);
    };
    try {
      for (const id of shareCardIds()) await (renderShareCard(id) as Response).arrayBuffer();
    } finally {
      console.error = original;
    }
    expect(
      messages.filter((message) => /dynamic font|failed to (load|download)/i.test(message)),
    ).toEqual([]);
  });

  test("an id with no card renders nothing, and the route answers it with a 404", () => {
    expect(renderShareCard("molecular-dimensions")).toBeNull();
    expect(renderShareCard("bm-02")).toBeNull();
  });
});
