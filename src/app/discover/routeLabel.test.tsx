/**
 * Every Discover page says "A route you could take" (am-rc1001-bridge-plan-pcjk.34).
 *
 * AGENTS.md: the site's own reconstruction "is always labeled 'A route you could take,' never 'What
 * Einstein thought.'" On 2026-10-01 the live /discover/brownian-motion/investigate/ carried the
 * label 0 times while its siblings carried it 2 to 4 times, because each page wrote its own copy
 * and one page wrote a different sentence.
 *
 * The population is read from the route tree, not listed here, so a new Discover page is checked
 * the day it is added. A folder whose name starts with "_" is private to the App Router and serves
 * no route, so it is not a page a reader can open.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";

const HERE = dirname(fileURLToPath(import.meta.url));
const LABEL = "A route you could take";

/** Every page.tsx under src/app/discover that serves a route. */
function discoverPages(dir: string = HERE): string[] {
  const pages: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!name.startsWith("_")) pages.push(...discoverPages(path));
    } else if (name === "page.tsx") pages.push(relative(HERE, path));
  }
  return pages;
}

/** The page's visible text: no script, style or MathML annotation, tags as spaces. */
function visibleText(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, " ")
    .replace(/<annotation\b[\s\S]*?<\/annotation>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

export function carriesRouteLabel(html: string): boolean {
  return visibleText(html).includes(LABEL);
}

const route = (page: string) =>
  `/discover/${page
    .split(sep)
    .join("/")
    .replace(/page\.tsx$/, "")}`;

describe("the label check reads what it is pointed at", () => {
  test("a page without the label is caught, and one with it passes", () => {
    // The sentence the Brownian investigation printed on 2026-10-01, without the label.
    expect(
      carriesRouteLabel("<p>It is not a historical measurement, and not a reconstruction of</p>"),
    ).toBe(false);
    expect(carriesRouteLabel('<p class="eyebrow">Discover · A route you could take</p>')).toBe(
      true,
    );
    // The label inside a script is not something a reader sees.
    expect(carriesRouteLabel(`<script>"${LABEL}"</script>`)).toBe(false);
  });
});

describe("every Discover page carries the route label", () => {
  const pages = discoverPages();

  test("the population is the route tree's, not an empty list", () => {
    // Measured 2026-10-02: the index, four journeys and four investigations.
    expect(pages.length).toBeGreaterThanOrEqual(9);
    expect(pages).toContain(join("brownian-motion", "investigate", "page.tsx"));
  });

  test("each page renders the label in its visible text", async () => {
    const unlabelled: string[] = [];
    for (const page of pages) {
      const mod = (await import(`./${page}`)) as { default: () => unknown };
      const html = renderToStaticMarkup((await mod.default()) as never);
      // A page that rendered nothing would not carry the label either, but say so separately.
      expect(visibleText(html).length).toBeGreaterThan(1000);
      if (!carriesRouteLabel(html)) unlabelled.push(route(page));
    }
    console.log(
      `route label: examined ${pages.length} discover pages, ${pages.length - unlabelled.length} labelled`,
    );
    expect(unlabelled).toEqual([]);
  });
});
