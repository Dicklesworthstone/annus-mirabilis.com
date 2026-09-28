/**
 * THE TOURS COME FROM TWO SOURCES, AND NOTHING STOPPED AN ID BEING IN BOTH (dispatch 397).
 *
 * One content record under content/tours, read by `requireTour`, and four entries in the
 * GUIDED_TOURS catalogue. Measured on 2026-09-28 the two id sets are disjoint, and this holds them
 * that way, because a collision fails in three places at once and none of them errors:
 *
 *   - src/app/tours/[tour]/page.tsx resolves the record FIRST and only consults getGuidedTour when
 *     there is none, so a shared id makes the record silently SHADOW the catalogue entry and the
 *     catalogue's tour becomes unreachable with no message;
 *   - its generateStaticParams concatenates both lists, so the id appears twice in the params;
 *   - src/app/sitemap.ts spreads both lists into one map, so the URL is listed twice;
 *   - and this index renders both lists, so one tour appears as two sections.
 *
 * Merging the two sources is a design decision for the owner and this is not it. This only makes
 * the hazard fail loudly here instead of quietly there.
 */
import { describe, expect, test } from "bun:test";
import { requireTour, tourIds } from "../../content/tours/tours.ts";
import { GUIDED_TOURS, getGuidedTour } from "../../discovery/tours/catalogue.ts";

const PROFILE = process.env.AM_RELEASE_PROFILE ?? "scaffold";

describe("the two tour sources", () => {
  test("no id exists in both, and both sets are non-empty", () => {
    const records = tourIds(process.cwd());
    const catalogue = GUIDED_TOURS.map((tour) => tour.id);
    // Non-vacuity: two empty sets never overlap, which would make this pass while checking nothing.
    expect(records.length).toBeGreaterThan(0);
    expect(catalogue.length).toBeGreaterThan(0);
    const shared = records.filter((id) => catalogue.includes(id));
    expect(shared).toEqual([]);
  });

  test("the shadowing is real, so the rule above is worth keeping", () => {
    // The positive control for the mechanism the docblock describes: for an id the catalogue holds
    // and the records do not, requireTour returns nothing and getGuidedTour returns the tour. Were
    // a record ever added under that id, the route's own order would return the record instead.
    const [first] = GUIDED_TOURS;
    if (!first) throw new Error("the catalogue is empty");
    expect(requireTour(process.cwd(), first.id, PROFILE)).toBeFalsy();
    expect(getGuidedTour(first.id)?.id).toBe(first.id);
  });
});
