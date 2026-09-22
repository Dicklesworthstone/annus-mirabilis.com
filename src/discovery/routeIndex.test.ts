import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadFirstPages } from "../components/home/firstPages.ts";
import { DISCOVERY_PAPER_SLUGS } from "./journeyRegistry.ts";
import { ROUTE_INDEX } from "./routeIndex.ts";

/**
 * The /discover/ index draws each route as its steps. Those labels are copied from the journey
 * pages, so these tests hold the copy to its source: the index must never show a reader a step
 * the route does not have, or miss one it does.
 *
 * The journey pages are read as source, matching the exact JSX element that prints a step
 * (`<p className="step-number">01 / Label</p>`). A comment quoting that element would be
 * miscounted; none does, and the sequential-numbering check below would catch a stray match.
 */
const STEP = /<p className="step-number">(\d{2}) \/ ([^<]+)<\/p>/g;

function decode(text: string): string {
  return text.replaceAll("&rsquo;", "’").replaceAll("&amp;", "&").trim();
}

function journeySteps(slug: string): { numbers: number[]; labels: string[] } {
  const source = readFileSync(
    resolve(import.meta.dirname, "../app/discover", slug, "page.tsx"),
    "utf8",
  );
  const found = [...source.matchAll(STEP)];
  return {
    numbers: found.map((m) => Number(m[1])),
    labels: found.map((m) => decode(m[2] ?? "")),
  };
}

const SPELLED: Record<string, number> = {
  Two: 2,
  Three: 3,
  Four: 4,
  Five: 5,
  Six: 6,
  Seven: 7,
  Eight: 8,
  Nine: 9,
  Ten: 10,
};

describe("the /discover/ index's routes", () => {
  test("names each of the four routes exactly once", () => {
    expect(ROUTE_INDEX.map((r) => r.slug).sort()).toEqual([...DISCOVERY_PAPER_SLUGS].sort());
  });

  for (const route of ROUTE_INDEX) {
    test(`${route.slug}: the steps are the journey page's own labels, in order`, () => {
      const { numbers, labels } = journeySteps(route.slug);
      // Non-vacuity: a pattern that matched nothing would compare [] with [] and pass.
      expect(labels.length).toBeGreaterThan(0);
      expect(numbers).toEqual(labels.map((_, i) => i + 1));
      expect([...route.steps]).toEqual(labels);
    });

    test(`${route.slug}: the summary's step count agrees with the steps`, () => {
      const said = /\b(Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten) steps\b/.exec(route.blurb);
      expect(said, `the summary should say how many steps: "${route.blurb}"`).not.toBeNull();
      expect(SPELLED[said?.[1] ?? ""]).toBe(route.steps.length);
    });
  }

  test("are listed in the order the journal received the papers", () => {
    const received = new Map(loadFirstPages().map((p) => [p.slug, p.received]));
    const dates = ROUTE_INDEX.map((r) => received.get(r.slug) ?? "");
    expect(dates.every((d) => d.length > 0)).toBe(true);
    expect(dates).toEqual([...dates].sort());
  });
});
