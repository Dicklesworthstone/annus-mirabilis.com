import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadPaperMargins } from "./marginRecords.ts";
import { PAPER_OWN_CITATIONS } from "./PaperMargins.tsx";

const ROOT = resolve(import.meta.dirname, "../..");
const PAPERS = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"] as const;

/**
 * The Sources line stops restating the paper's own title to a reader inside it (dispatch 546). The
 * risk this file exists for is NOT that the shortening looks wrong: it is that it silently does
 * nothing.
 *
 * Keyed on each paper record's `citation` field alone, mass-energy would never match, because its
 * `citation` is `ap-18-639` (the 1923 translation) while its margin records cite
 * `cit-einstein-1905-inertia` (the German original). That failure is invisible: the page renders
 * exactly as it does today and no assertion about rendering would go red. So the test is that every
 * paper HAS a recognised own-paper source, with the count printed beside the verdict.
 */
describe("a margin's own-paper sources are recognised on every paper", () => {
  test("the map is not vacuous and names every paper", () => {
    expect(Object.keys(PAPER_OWN_CITATIONS).sort()).toEqual([...PAPERS].sort());
    for (const [paper, ids] of Object.entries(PAPER_OWN_CITATIONS))
      expect(ids.length, `${paper} names no citation`).toBeGreaterThan(0);
  });

  test("every declared id resolves to a bibliography record", () => {
    for (const ids of Object.values(PAPER_OWN_CITATIONS))
      for (const id of ids)
        expect(() =>
          readFileSync(resolve(ROOT, "content", "bibliography", `${id}.json`), "utf8"),
        ).not.toThrow();
  });

  for (const paper of PAPERS) {
    test(`${paper}: at least one margin source is its own paper, so the shortening reaches it`, () => {
      const own = new Set(PAPER_OWN_CITATIONS[paper] ?? []);
      const notes = loadPaperMargins(paper, ROOT).notes;
      // Non-vacuity: a paper with no notes would pass every assertion below having examined none.
      expect(notes.length, `${paper} has no margin records to judge`).toBeGreaterThan(0);
      const sources = notes.flatMap((n) => n.sourceSupport);
      const matched = sources.filter((s) => own.has(s.citationId) && Boolean(s.locator));
      // THE PLANT THIS FILE IS FOR: drop "cit-einstein-1905-inertia" from mass-energy's entry and
      // this line goes red there and nowhere else.
      expect(
        matched.length,
        `${paper}: ${sources.length} sources, none recognised as this paper; the shortening would do nothing here`,
      ).toBeGreaterThan(0);
    });
  }

  test("a source citing the paper as a whole, with no locator, is never shortened", () => {
    // "This paper." alone carries nothing, so the full citation must survive that case.
    for (const paper of PAPERS) {
      const own = new Set(PAPER_OWN_CITATIONS[paper] ?? []);
      for (const note of loadPaperMargins(paper, ROOT).notes)
        for (const s of note.sourceSupport)
          if (own.has(s.citationId) && !s.locator)
            expect(Boolean(s.locator), `${note.id} cites its own paper with no locator`).toBe(
              false,
            );
    }
  });
});
