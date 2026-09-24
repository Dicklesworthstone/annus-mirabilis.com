/**
 * Blocks mounts a lesson's construction only when constructionIds.ts lists the lesson, so the
 * list and FoundationConstruction's dispatch must agree. Two halves, checked in two places:
 *
 *   - A case with no list entry is a compile error, because the switch is typed by the list
 *     (bun run check:types; planted by dropping "taylor-expansion" from the list: TS2678).
 *   - A listed id with no case is caught here: every listed id must render a construction, or
 *     the lesson would load a chunk for an empty island (planted by deleting the "logarithms"
 *     case: this test goes red).
 *
 * The second loop guards the dispatch itself: if FoundationConstruction ever stopped routing
 * through the list and gained a case for an unlisted lesson, that lesson would render here while
 * Blocks never mounted it on a page.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { contentIndex } from "../../content/server";
import { FOUNDATION_CONSTRUCTION_IDS, foundationConstructionId } from "./constructionIds.ts";
import { FoundationConstruction } from "./FoundationConstruction.tsx";

describe("the construction list agrees with FoundationConstruction", () => {
  test("listed and unlisted lessons, in both directions, over every built lesson", async () => {
    const lessons = (await contentIndex()).payloads
      .filter((p) => p.kind === "foundation")
      .map((p) => p.id);
    // Non-vacuity: a lesson list that came back empty would pass both loops.
    expect(lessons.length).toBeGreaterThan(FOUNDATION_CONSTRUCTION_IDS.length);
    for (const id of FOUNDATION_CONSTRUCTION_IDS) {
      expect(lessons).toContain(id);
      expect(renderToStaticMarkup(<FoundationConstruction foundationId={id} />)).not.toBe("");
    }
    const unlisted = lessons.filter((id) => foundationConstructionId(id) === null);
    expect(unlisted.length).toBeGreaterThan(0);
    for (const id of unlisted) {
      expect(renderToStaticMarkup(<FoundationConstruction foundationId={id} />)).toBe("");
    }
  });

  test("the foundation: prefix names the same construction", () => {
    expect(foundationConstructionId("foundation:derivatives")).toBe("derivatives");
    expect(foundationConstructionId("derivatives")).toBe("derivatives");
    expect(foundationConstructionId("mean-variance-rms")).toBe(null);
  });
});
