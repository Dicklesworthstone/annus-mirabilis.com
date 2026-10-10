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

  test("all four carry seven of nine, and the two absences are stages and exercises", () => {
    for (const paper of PAPERS) {
      const cell = journeySkeletonParts(ROOT, paper);
      expect(`${paper} ${cell.count} of ${cell.denominator}`).toBe(`${paper} 7 of 9`);
      expect(cell.note).toContain("stages");
      expect(cell.note).toContain("exercises");
    }
  });

  test("no paper is met, which is the honest reading of seven of nine", () => {
    for (const paper of PAPERS) {
      expect(journeySkeletonParts(ROOT, paper).met, `${paper} is not met at 7 of 9`).toBe(false);
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
    for (const paper of PAPERS) {
      const { undeclared, subPartOnly } = journeySkeletonUndeclared(ROOT, paper);
      expect(undeclared, `${paper} has an absent part it does not declare at all`).toEqual([]);
      // And the finer point stays visible rather than being absorbed: `exercises` is absent
      // ENTIRELY while the record declares only `exercises.instrumented`, so the declaration is
      // narrower than the absence. Reported, not failed — it is a smaller discrepancy than an
      // undeclared absence and it is not the same thing.
      expect(subPartOnly, `${paper}'s sub-part-only declarations`).toEqual(["exercises"]);
      expect(journeySkeletonParts(ROOT, paper).note).toContain("sub-part grain");
    }
  });
});
