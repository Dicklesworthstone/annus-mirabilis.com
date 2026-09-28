/**
 * EVERY GUIDED LAYER HAS A ROUTE THAT NEEDS NO CONTEXT.
 *
 * The site has three: /tours/ (guided reading paths), /discover/ (routes you could take) and
 * /tapes/ (recorded walkthroughs). Measured 2026-09-28, the first two were in the shared chrome and
 * the third was not: /tapes/ was reachable from a paper section, an instrument, the instruments
 * catalogue and search, every one of which needs a reader to already be somewhere. A reader who has
 * just arrived could not find 22 authored walkthroughs.
 *
 * WHAT THIS PROVES AND WHAT IT DOES NOT. It reads the shared layout's source, so it proves the links
 * are written, not that they render or that they are reachable by keyboard. The rendering is covered
 * by the layout's own tests and by the a11y lane; this is the cheap half that catches a layer being
 * added, or dropped, without a way in. It exists because the asymmetry above survived a week of work
 * on exactly these layers, including by me.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * THE CHROME IS TWO FILES, which I got wrong on the first attempt at this very test. The footer
 * navs are literal anchors in layout.tsx; the header's are a DESTINATIONS array in
 * PrimaryNavLinks.tsx, so a grep of the layout alone reports /discover/ missing when a reader can
 * see it in the header of every page. Reading one of two sources is the error this test exists to
 * catch, and it caught me writing it.
 */
const chrome = ["src/app/layout.tsx", "src/components/chrome/PrimaryNavLinks.tsx"]
  .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
  .join("\n");

/** Each guided layer, with the words the shared chrome uses for it. */
const GUIDED_LAYERS: readonly (readonly [route: string, label: string])[] = [
  ["/tours/", "Guided reading paths"],
  ["/tapes/", "Recorded walkthroughs"],
];

describe("the guided layers are reachable from the shared chrome", () => {
  test("each has a link, under the name the rest of the site uses for it", () => {
    for (const [route, label] of GUIDED_LAYERS) {
      expect(chrome).toContain(`href="${route}"`);
      expect(chrome).toContain(label);
    }
  });

  test("the layer list is not empty, so the loop above examines something", () => {
    expect(GUIDED_LAYERS.length).toBeGreaterThan(1);
  });

  test("/discover/ reaches a reader from the chrome too, wherever it sits", () => {
    // Asserted apart from the pair above because it lives in the header's DESTINATIONS array rather
    // than the footer's literal anchors. The point is that all three layers have SOME context-free
    // route, not that they share one nav.
    expect(chrome).toContain('href: "/discover/"');
  });
});
