import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BROWNIAN_SHELF_CARDS } from "../../content/brownianShelf.ts";
import { Shelf } from "./Shelf.tsx";
import { StatusLabel } from "./StatusLabel.tsx";

/**
 * The shelf reads like a book (dispatch 276): one level of container, the card. Until then the shelf
 * was a filled, bordered section holding a bordered card holding a callout for the card's limits,
 * three deep on every journey (12 on light quanta's), and its legend's "Admitted 1905 import" chip
 * was ringed in the accent, the only red on the shelf. A status is told apart by its icon and its
 * words (StatusLabel), never by colour alone, so the accent adds nothing there.
 */
const openingTag = (html: string, tag: string) =>
  new RegExp(`<${tag}\\b[^>]*>`).exec(html)?.[0] ?? "";

describe("the 1904 shelf", () => {
  const html = renderToStaticMarkup(<Shelf cards={BROWNIAN_SHELF_CARDS} />);

  test("the shelf's own section draws no box around its cards", () => {
    const section = openingTag(html, "section");
    expect(section).not.toBe("");
    expect(section).not.toMatch(/border|background/);
  });

  test("a card's limits are a line of the card, not a callout inside it", () => {
    const withLimits = BROWNIAN_SHELF_CARDS.filter((c) => c.limits);
    // Non-vacuity: Stokes's card, among others, carries its limits.
    expect(withLimits.length).toBeGreaterThan(0);
    for (const card of withLimits) {
      const start = html.indexOf(`data-card-id="${card.id}"`);
      const body = html.slice(start, html.indexOf("</details>", start));
      expect(body, card.id).toContain("Limits:");
      expect(body, card.id).not.toContain('class="notice"');
    }
  });

  test("the admitted-import chip is told apart by its icon and words, not by the accent", () => {
    const chip = renderToStaticMarkup(<StatusLabel status="available" admittedImport={true} />);
    expect(chip).toContain("Admitted 1905 import");
    expect(chip).toContain("<svg");
    expect(chip).not.toContain("--accent");
  });
});
