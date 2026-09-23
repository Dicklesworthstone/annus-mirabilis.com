import { describe, expect, test } from "bun:test";
import { metadata as tracerMetadata } from "../../app/lab/bm-01/page.tsx";
import { loadPaper } from "../../content/server.ts";
import { paperMetadata } from "../../reader/paperRoutes.ts";
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

  // A page that names a card the route does not publish shares a broken image, and nothing in a
  // browser would show it.
  test("every paper page, its sections, and bm-01 name a card the route publishes", async () => {
    const published = new Set(shareCardIds().map((id) => `/share/${id}.png`));
    const named: string[] = [];
    for (const paper of loadFirstPages()) {
      const firstSection = (await loadPaper(paper.slug)).paper.sections[0]?.id;
      expect(firstSection, paper.slug).toBeDefined();
      for (const section of [undefined, firstSection]) {
        const meta = await paperMetadata(
          section === undefined ? { paperId: paper.slug } : { paperId: paper.slug, section },
        );
        const images = (meta.openGraph?.images ?? []) as { url: string }[];
        expect(
          images.map((image) => image.url),
          `${paper.slug} ${section ?? ""}`,
        ).toEqual([`/share/${paper.slug}.png`]);
        named.push(...images.map((image) => image.url));
      }
    }
    const tracer = (tracerMetadata.openGraph?.images ?? []) as { url: string }[];
    expect(tracer.map((image) => image.url)).toEqual(["/share/bm-01.png"]);
    named.push(...tracer.map((image) => image.url));
    expect(named.filter((url) => !published.has(url))).toEqual([]);
    expect(named.length).toBe(9);
  });

  test("an id with no card renders nothing, and the route answers it with a 404", () => {
    expect(renderShareCard("molecular-dimensions")).toBeNull();
    expect(renderShareCard("bm-02")).toBeNull();
  });
});
