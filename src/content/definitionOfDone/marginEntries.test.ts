/**
 * THE MARGIN-ENTRIES CELL (am-definition-of-done-as-code-8w1c).
 *
 * This cell was declared `unmeasured` on a reason that had expired: `NOT_YET_READ` said the
 * per-paper requirement "is in the plan rather than in a record this can read", which was true when
 * written and stopped being true on 2026-10-08, when the four
 * `content/editorial/required-margin-entries/<paper>.yaml` records landed. Each opens by declaring
 * itself: "This file is a DENOMINATOR, not editorial copy."
 *
 * WHAT THESE TESTS GUARD, beyond the arithmetic:
 *
 *   THE POPULATION. Counting records with `kind: historian-margin` is the wrong denominator and the
 *   requirement files say so themselves -- that kind gives 16 across the four papers, of which only
 *   mass-energy's six are section 3.9 entries and ten are notation-concordance notes sharing the
 *   kind. So the count is read from the REQUIREMENT's side, and the test asserts the denominators
 *   are the requirement lengths rather than any record count.
 *
 *   A PARTIAL IS NOT A PASS. The requirement files say "Do not promote a partial by widening this
 *   file", so an entry carrying `partial` is not counted however much of the clause it covers. Both
 *   papers that have one are asserted, because an implementation that treated `satisfiedBy` as
 *   sufficient would silently credit them.
 */
import { describe, expect, test } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { marginEntries } from "./measure.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("margin-entries measures against the per-paper requirement record", () => {
  test("every paper measures, and none is unmeasured", () => {
    for (const paper of ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"]) {
      const cell = marginEntries(ROOT, paper);
      expect(cell.unmeasured, `${paper} must measure now that its requirement record exists`).toBe(
        false,
      );
      // A 0 denominator is arithmetic, not a verdict: the report's own rule.
      expect(cell.denominator, `${paper} must have a real denominator`).toBeGreaterThan(0);
    }
  });

  test("the measured values, each read from its requirement record", () => {
    // Pinned as identities rather than as a total, because the requirement lists are permanent and
    // a sum would move for either of two different reasons.
    const measured = Object.fromEntries(
      ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"].map((p) => {
        const c = marginEntries(ROOT, p);
        return [p, `${c.count} of ${c.denominator}`];
      }),
    );
    console.log(`[margin-entries] ${JSON.stringify(measured)}`);
    expect(measured["mass-energy"]).toBe("8 of 8");
    expect(measured["light-quanta"]).toBe("0 of 5");
    expect(measured["brownian-motion"]).toBe("0 of 8");
    expect(measured["special-relativity"]).toBe("2 of 9");
  });

  test("only mass-energy is met, and it is met because every entry names a record", () => {
    expect(marginEntries(ROOT, "mass-energy").met).toBe(true);
    for (const paper of ["light-quanta", "brownian-motion", "special-relativity"]) {
      expect(marginEntries(ROOT, paper).met, `${paper} is not met`).toBe(false);
    }
  });

  test("A PARTIAL IS NOT COUNTED, and the note says how many were withheld", () => {
    // light-quanta has one partial and four absent of five; special-relativity one partial of nine.
    // An implementation reading only `satisfiedBy` would score these 1 of 5 and 3 of 9.
    const lq = marginEntries(ROOT, "light-quanta");
    expect(lq.count).toBe(0);
    expect(lq.note).toContain("partial");
    const sr = marginEntries(ROOT, "special-relativity");
    expect(sr.count).toBe(2);
    expect(sr.note).toContain("partial");
  });

  test("a paper with no requirement record is UNMEASURED, not met", () => {
    // The distinction the bead's first criterion asks for: an absent denominator can never be a
    // pass. Asserted on a paper slug that has no record rather than by deleting one.
    const cell = marginEntries(ROOT, "no-such-paper");
    expect(cell.unmeasured).toBe(true);
    expect(cell.met).toBe(false);
    expect(cell.note).toContain("no requirement record");
  });
});
