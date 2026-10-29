/**
 * EVERY EXPLANATION PAGE'S TITLE NAMES ITS PAPER, BECAUSE 117 OF THEM USED TO BE AMBIGUOUS.
 *
 * `/equations/<paper>/<display>/` titled itself `` `${display}: the equation explained` ``. Display
 * ids repeat across papers -- `eq-s1-d1` exists in brownian-motion, light-quanta AND
 * special-relativity -- so three different pages carried byte-identical titles. Measured over the
 * 764 built pages on 2026-10-28: 692 distinct titles, 49 shared by more than one route, and 47 of
 * those 49 were these pages, covering **117 routes**. A reader with three tabs, three bookmarks or
 * three search results could not tell which paper's equation they had.
 *
 * This asserts the property rather than the strings: every route's title is distinct, and each names
 * its own paper. Both hold at any corpus size, which a list of 279 expected titles would not.
 *
 * THE SHORT NAME IS DERIVED AND THE DERIVATION IS ASSERTED. All four papers' titles are
 * `<name>: <subtitle>` and the subtitle is dropped, because the full title plus the id plus the root
 * layout's " · Annus Mirabilis" runs past 100 characters and a truncating search result cuts the END
 * -- where the id is, the only distinguishing part. A title with no ": " is returned whole, so a
 * later paper cannot be silently truncated to nothing.
 *
 * What this does NOT fix is recorded on am-bzsk: there is no short authored NAME for an equation
 * anywhere in the data, so the id stays in the title as the equation's address, which is what the
 * catalogue page shows beside each row for the same reason.
 */
import { describe, expect, test } from "bun:test";
import { shortPaperName } from "../equations/printed/catalogue.ts";
import { everyExplanationRoute } from "../equations/printed/fullExplanations.ts";
import { generateMetadata } from "./equations/[paper]/[display]/page.tsx";

describe("shortPaperName", () => {
  test("drops the editorial subtitle, and keeps a title that has none", () => {
    expect(shortPaperName("Brownian motion: from wandering to a measurable law")).toBe(
      "Brownian motion",
    );
    expect(shortPaperName("Mass and energy: two accounts, one subtraction")).toBe(
      "Mass and energy",
    );
    // No ": " at all: returned whole rather than emptied. The companion dissertation's record is
    // not in the catalogue yet, and this is what keeps its arrival from producing a blank name.
    expect(shortPaperName("Zur Elektrodynamik bewegter Körper")).toBe(
      "Zur Elektrodynamik bewegter Körper",
    );
    // A leading colon is not a subtitle boundary: slice(0, 0) would be empty.
    expect(shortPaperName(": odd")).toBe(": odd");
  });
});

describe("every explanation page's title", () => {
  test("is distinct across all routes, and names its paper", async () => {
    const routes = [...everyExplanationRoute()];
    // Non-vacuity first: an empty route list would make both assertions below pass on nothing.
    expect(routes.length).toBeGreaterThanOrEqual(279);

    /** The short name each paper's title reduces to, named here so the assertion is not circular. */
    const PAPER_NAMES: Readonly<Record<string, string>> = {
      "brownian-motion": "Brownian motion",
      "light-quanta": "Light quanta",
      "special-relativity": "Special relativity",
      "mass-energy": "Mass and energy",
    };
    const titles = new Map<string, string[]>();
    const notNamingItsPaper: string[] = [];
    const notLocated: string[] = [];
    for (const { paper, display } of routes) {
      const meta = await generateMetadata({ params: Promise.resolve({ paper, display }) });
      const title = typeof meta.title === "string" ? meta.title : "";
      titles.set(title, [...(titles.get(title) ?? []), `${paper}/${display}`]);
      const name = PAPER_NAMES[paper];
      if (name === undefined || !title.startsWith(`${name} · `))
        notNamingItsPaper.push(`${paper}/${display}: "${title}"`);
      /*
       * A PRINTED DISPLAY IS CITED, NEVER ADDRESSED BY ID. This is the half that makes the title
       * worth reading rather than merely unique: "§3, display 7" is how the same equation is cited
       * on every face, and it comes from `equationLocator`, the function the search document
       * pointing at this page already used. A title falling back to the raw `eq-s3-d7` here would
       * be unique and useless, so the two properties are asserted separately.
       */
      if (/^eq-s\d|^eq-\d/.test(display) && title.includes(display))
        notLocated.push(`${paper}/${display}: "${title}"`);
    }
    expect(notLocated).toEqual([]);

    const shared = [...titles.entries()]
      .filter(([, where]) => where.length > 1)
      .map(([title, where]) => `${title} <- ${where.join(", ")}`);
    expect(shared).toEqual([]);
    expect(notNamingItsPaper).toEqual([]);
    expect(titles.size).toBe(routes.length);
    console.log(
      `[equation page titles] ${routes.length} route(s), ${titles.size} distinct title(s), 0 shared`,
    );
  });

  test("the old ambiguous shape cannot come back", async () => {
    // The exact string that collided three ways, asserted as an explicit negative so a future edit
    // that drops the paper from the title fails here rather than in a reader's tab bar.
    const meta = await generateMetadata({
      params: Promise.resolve({ paper: "brownian-motion", display: "eq-s1-d1" }),
    });
    const title = typeof meta.title === "string" ? meta.title : "";
    expect(title).not.toBe("eq-s1-d1: the equation explained");
    expect(title).toContain("Brownian motion");
    // The locator a reader would cite, from the same function the search index titles by.
    expect(title).toContain("§1, display 1");
    // The raw id is gone, and so is the editorial subtitle, which is the point of the short name.
    expect(title).not.toContain("eq-s1-d1");
    expect(title).not.toContain("from wandering");
  });

  test("a derivation step, which has no locator, falls back to its address", async () => {
    // The 35 steps are the kind `explainedEquationLabel` returns undefined for, and the fallback is
    // the display id. Asserted so the fallback is a decision with a test rather than a surprise.
    const step = [...everyExplanationRoute()].find(({ display }) =>
      display.startsWith("eq-model-"),
    );
    expect(step).toBeDefined();
    if (!step) return;
    const meta = await generateMetadata({ params: Promise.resolve(step) });
    const title = typeof meta.title === "string" ? meta.title : "";
    expect(title).toContain(step.display);
    expect(title).toContain(" · ");
  });
});
