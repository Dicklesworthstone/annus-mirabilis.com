/**
 * /search/ CAN RENDER EVERY SEARCH TYPE, AND NAMES EACH ONE.
 *
 * The page fills byType by iterating TYPE_ORDER, so a type missing from that list is not rendered at
 * all, however many documents the index holds. Measured 2026-09-28: the index had just gained
 * walkthrough, discovery and tour documents; the command palette grouped and filtered all three
 * because it iterates SEARCH_TYPES; and /search/ showed none of them, because the page kept its own
 * list of ten and nothing compared the two.
 *
 * This is the comparison. It is cheap and it makes the whole class of that error impossible: a new
 * SearchType cannot reach the index without also being renderable and named here.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SEARCH_TYPES } from "../../search/core.ts";
import { TYPE_LABELS, TYPE_ORDER } from "./indexSections.ts";

describe("the search page's sections cover every search type", () => {
  test("the type list is non-empty, so the comparisons below examine something", () => {
    console.log(
      `[search sections] ${SEARCH_TYPES.length} search types, ${TYPE_ORDER.length} ordered, ` +
        `${Object.keys(TYPE_LABELS).length} labelled`,
    );
    expect(SEARCH_TYPES.length).toBeGreaterThan(10);
  });

  test("every search type appears in the render order", () => {
    const missing = SEARCH_TYPES.filter((type) => !TYPE_ORDER.includes(type));
    expect(missing).toEqual([]);
  });

  test("every search type has a heading, and none is the raw type name", () => {
    for (const type of SEARCH_TYPES) {
      const label = TYPE_LABELS[type];
      expect(label).toBeDefined();
      expect(label.length).toBeGreaterThan(0);
      // The page falls back to the raw type when a label is missing, which renders a heading
      // reading "walkthrough" in lower case. A label equal to its own key is that fallback,
      // written out.
      expect(label).not.toBe(type);
    }
  });

  test("the order lists nothing twice and nothing unknown", () => {
    expect(new Set(TYPE_ORDER).size).toBe(TYPE_ORDER.length);
    const unknown = TYPE_ORDER.filter((type) => !SEARCH_TYPES.includes(type));
    expect(unknown).toEqual([]);
  });

  test("the page reads these lists rather than keeping its own", () => {
    // The coarse half: the defect was two lists, so a test that only checks THIS list would pass
    // while the page used a private copy. Proving it imports them is source-level; proving it
    // renders from them needs the page, which is covered by the page's own tests.
    const page = readFileSync(join(process.cwd(), "src/app/search/page.tsx"), "utf8");
    expect(page).toContain('from "./indexSections.ts"');
    expect(page).not.toContain("const TYPE_ORDER");
    expect(page).not.toContain("const TYPE_LABELS");
  });
});
