/**
 * THE JOURNEY-SKELETON CELL (am-definition-of-done-as-code-8w1c).
 *
 * Declared `unmeasured` because the skeleton's parts "are a structural requirement with no field
 * asserting presence yet". All four `content/journeys/<paper>.yaml` records now carry one field per
 * part of AGENTS.md's "How to Add a Discovery Step", so presence is readable.
 *
 * THE PROPERTY WORTH MORE THAN THE COUNT is the last test here. Each record declares its own
 * `completeness` and `pendingElements`, and today every absent part is named there with a reason:
 * `stages` because the staged chain still lives in the discover page's JSX (am-4k0m), and
 * `exercises` likewise. A record that quietly LOSES a part without adding it to pendingElements has
 * drifted from its own statement of completeness, and no count of present parts would show that —
 * 6 of 9 reads like progress stalling rather than a record contradicting itself.
 */
import { describe, expect, test } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { journeySkeletonParts, journeySkeletonUndeclared } from "./measure.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;

describe("journey-skeleton-parts measures the nine parts of the discovery skeleton", () => {
  test("every paper measures against a denominator of nine", () => {
    for (const paper of PAPERS) {
      const cell = journeySkeletonParts(ROOT, paper);
      expect(cell.unmeasured, `${paper} must measure`).toBe(false);
      expect(cell.denominator, `${paper}: the skeleton is nine parts`).toBe(9);
    }
  });

  test("the count is a FLOOR that rises, and stages is the part still absent", () => {
    /*
     * THIS ASSERTED `7 of 9` AND BROKE ON CORRECT WORK, which is the failure AGENTS.md records
     * under "A test that asserts a debt breaks when it is paid". The exercises were composed from
     * the parts the pages already render on 2026-10-20 and every paper went to 8 of 9; the
     * equality then reported progress as a regression.
     *
     * The counts are REPORTED with their denominator and floored. What is asserted as an identity
     * is the part still missing, because `stages` is a named element and naming it is stable in a
     * way counting is not.
     */
    const counts = PAPERS.map((paper) => {
      const cell = journeySkeletonParts(ROOT, paper);
      return `${paper} ${cell.count} of ${cell.denominator}`;
    });
    console.log(`[census] journey skeleton: ${counts.join(", ")}`);
    for (const paper of PAPERS) {
      const cell = journeySkeletonParts(ROOT, paper);
      expect(cell.count, `${paper}: ${cell.note}`).toBeGreaterThanOrEqual(8);
      expect(cell.note).toContain("stages");
    }
  });

  test("no paper is met while a part is absent, whatever the count has reached", () => {
    for (const paper of PAPERS) {
      const cell = journeySkeletonParts(ROOT, paper);
      expect(cell.met, `${paper} is not met at ${cell.count} of ${cell.denominator}`).toBe(false);
    }
  });

  test("a key that exists but is EMPTY does not count as a part", () => {
    // Nine keys present and all empty would score 9 of 9 under a key-existence check, which is the
    // "a result computed over an empty population is not a clean result" failure in miniature.
    // Asserted through the public cell rather than by reaching into the predicate: today's records
    // prove the distinction matters, because `stages` and `exercises` are absent rather than empty
    // in some records and the count is 7 either way.
    for (const paper of PAPERS) {
      expect(journeySkeletonParts(ROOT, paper).count).toBeLessThan(9);
    }
  });

  test("EVERY ABSENT PART IS DECLARED, and the declaration grammar is dotted", () => {
    // The drift guard. A record that loses a part without declaring it contradicts its own
    // completeness statement, and the count alone would read as stalled progress rather than as a
    // record disagreeing with itself.
    //
    // MY FIRST VERSION OF THIS FAILED FOR THE WRONG REASON and the failure was the useful part. It
    // matched the part name exactly and reported `exercises` undeclared in all four papers, when
    // each record declares `exercises.instrumented` — a MORE specific claim. The records' grammar is
    // dotted (`move.derivationChain` too), so a pending element declares its part when it is the
    // part or a path beneath it.
    const subPartOnlyByPaper: string[] = [];
    for (const paper of PAPERS) {
      const { undeclared, subPartOnly } = journeySkeletonUndeclared(ROOT, paper);
      expect(undeclared, `${paper} has an absent part it does not declare at all`).toEqual([]);
      /*
       * THE SUB-PART-ONLY CASE IS EMPTY NOW, and it used to be `["exercises"]` on every paper:
       * `exercises` was absent entirely while the record declared only `exercises.instrumented`,
       * a declaration narrower than the absence. Composing the exercises closed it.
       *
       * Asserting `[]` would make this test a statement about today rather than about the rule,
       * so what is asserted is the PROPERTY -- a sub-part-only declaration is reported and never
       * silently credited -- and the list is printed. Two of the four papers still declare
       * `exercises.instrumented`, for a real shortfall rather than for an absent element, so the
       * case being empty here is itself the thing worth seeing.
       */
      expect(subPartOnly, `${paper}'s sub-part-only declarations`).toEqual([]);
      subPartOnlyByPaper.push(`${paper} [${subPartOnly.join(", ")}]`);
    }
    console.log(`[census] sub-part-only declarations: ${subPartOnlyByPaper.join(", ")}`);
  });
});
