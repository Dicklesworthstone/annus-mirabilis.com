import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RouteMap, stepAnchor } from "./RouteMap.tsx";
import { ROUTE_INDEX } from "./routeIndex.ts";

/**
 * Every link in a route's map must land on a section of that route. The map draws its links from
 * ROUTE_INDEX (whose labels routeIndex.test.ts holds to the pages); this holds the other end: each
 * numbered step's section carries the anchor the map links to, and the shelf and the way into the
 * paper carry theirs. The pages are read as source, matching the section element and the step
 * element that follows it, so a comment quoting either would not count.
 */
function source(slug: string): string {
  return readFileSync(resolve(import.meta.dirname, "../app/discover", slug, "page.tsx"), "utf8");
}
const STEP_SECTION = /<section id="(step-\d{2})">\s*<p className="step-number">(\d{2}) \//g;

describe("the route map's links", () => {
  test("a slug the index does not know is refused with route-index-missing, never a guess", () => {
    // biome-ignore lint/suspicious/noExplicitAny: the point is a slug outside the typed set.
    expect(() => RouteMap({ slug: "no-such-route" as any })).toThrow("route-index-missing");
  });

  test("a step's anchor is its two-digit number", () => {
    expect(stepAnchor(1)).toBe("step-01");
    expect(stepAnchor(8)).toBe("step-08");
    expect(stepAnchor(10)).toBe("step-10");
  });

  for (const route of ROUTE_INDEX) {
    test(`${route.slug}: every step, the shelf and the paper section carry the map's anchors`, () => {
      const page = source(route.slug);
      const found = [...page.matchAll(STEP_SECTION)].map((m) => [m[1], m[2]]);
      // Non-vacuity: a pattern that matched nothing would compare [] with [] and pass.
      expect(route.steps.length).toBeGreaterThan(0);
      expect(found).toEqual(
        route.steps.map((_, i) => [stepAnchor(i + 1), String(i + 1).padStart(2, "0")]),
      );
      expect(page.match(/<section id="shelf">/g)?.length).toBe(1);
      expect(page.match(/<section id="in-the-paper">/g)?.length).toBe(1);
      expect(page.match(new RegExp(`<RouteMap slug="${route.slug}" />`, "g"))?.length).toBe(1);
    });
  }
});
