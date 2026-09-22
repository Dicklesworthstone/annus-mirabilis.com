import { describe, expect, test } from "bun:test";
import { sectionPlate } from "./sectionPlate.ts";

describe("the printed page a section begins on", () => {
  test("is the section's own page, not the paper's first", () => {
    // Brownian's first page is 549; its §4 and §5 begin on 556 and 559. A plate keyed by the
    // paper rather than the section would put page 549 beside §4.
    expect(sectionPlate("brownian-motion", "s4")?.page).toBe(556);
    expect(sectionPlate("brownian-motion", "s5")?.page).toBe(559);
    expect(sectionPlate("light-quanta", "s4")?.page).toBe(139);
  });

  test("names both plate files and the section in German", () => {
    expect(sectionPlate("brownian-motion", "s4")).toEqual({
      page: 556,
      volume: "17",
      src: "/figures/plates/pages/ap-17-549/556.webp",
      srcSet:
        "/figures/plates/pages/ap-17-549/556.webp 640w, /figures/plates/pages/ap-17-549/556-1280.webp 1280w",
      germanHref: "/papers/brownian-motion/s4/view/german/",
    });
  });

  test("offers nothing for a section the page map does not know", () => {
    expect(sectionPlate("brownian-motion", "s99")).toBeUndefined();
  });
});
