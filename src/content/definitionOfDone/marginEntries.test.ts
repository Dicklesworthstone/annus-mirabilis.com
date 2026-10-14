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
 *   kind. So the count is read from the REQUIREMENT's side, and the denominators are asserted as
 *   the requirement lengths rather than any record count.
 *
 *   A PARTIAL IS NOT A PASS. The requirement files say "Do not promote a partial by widening this
 *   file", so an entry carrying `partial` is not counted however much of the clause it covers. An
 *   implementation that treated `satisfiedBy` as sufficient would silently credit it.
 *
 * THE NUMERATORS USED TO BE PINNED HERE AND ARE NOT ANY MORE (2026-10-14). The file asserted
 * `light-quanta` at "0 of 5" and `brownian-motion` at "0 of 8" under a comment reading "Pinned as
 * identities rather than as a total, because the requirement lists are permanent". The LISTS are
 * permanent; how many of them are satisfied is the thing the project is trying to change, and it
 * changed: three entries were authored on 2026-10-14 and the equalities went red on correct work,
 * with the partial assertion going red beside them because light-quanta's partial had been
 * completed rather than abandoned. That is AGENTS.md's own distinction, "report a count, assert a
 * property", applied to the wrong half. Denominators are identities and stay; numerators are
 * reported, floored below, and never frozen.
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { marginEntries } from "./measure.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;

/** The requirement lists, which are the plan's and do not move. */
const DENOMINATORS: Readonly<Record<string, number>> = {
  "mass-energy": 8,
  "light-quanta": 5,
  "brownian-motion": 8,
  "special-relativity": 9,
};

/**
 * A root holding one requirement file, so the partial rule can be driven on values rather than on
 * whichever paper happens to carry a partial today. The previous version of this file was keyed to
 * light-quanta's, and expired when that entry was completed.
 */
function rootWithRequirement(yaml: string): string {
  const root = mkdtempSync(join(tmpdir(), "margin-entries-"));
  const dir = join(root, "content", "editorial", "required-margin-entries");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "fixture-paper.yaml"), yaml);
  return root;
}

describe("margin-entries measures against the per-paper requirement record", () => {
  test("every paper measures, and none is unmeasured", () => {
    for (const paper of PAPERS) {
      const cell = marginEntries(ROOT, paper);
      expect(cell.unmeasured, `${paper} must measure now that its requirement record exists`).toBe(
        false,
      );
      // A 0 denominator is arithmetic, not a verdict: the report's own rule.
      expect(cell.denominator, `${paper} must have a real denominator`).toBeGreaterThan(0);
    }
  });

  test("each denominator is its requirement list, which is the plan's and does not move", () => {
    const measured: Record<string, string> = {};
    for (const paper of PAPERS) {
      const cell = marginEntries(ROOT, paper);
      measured[paper] = `${cell.count} of ${cell.denominator}`;
      expect(cell.denominator, `${paper} denominator`).toBe(DENOMINATORS[paper] ?? -1);
      // Reported, not frozen. A count may rise as entries are authored and may fall if one is
      // withdrawn; what must hold is that it never exceeds its own denominator.
      expect(cell.count).toBeGreaterThanOrEqual(0);
      expect(cell.count).toBeLessThanOrEqual(cell.denominator);
    }
    console.log(`[margin-entries] ${JSON.stringify(measured)}`);
  });

  /**
   * The floor, which replaces the frozen equalities. mass-energy is the paper the plan's section
   * 3.9 is fully carried for, and a regression there would mean a record was withdrawn without its
   * requirement being withdrawn with it. The other three are floored at zero on purpose: they are
   * incomplete, and a test that pretended otherwise would be the thing this cell exists to catch.
   */
  test("mass-energy stays complete, and is the only paper that is", () => {
    expect(marginEntries(ROOT, "mass-energy").count).toBe(DENOMINATORS["mass-energy"]);
    expect(marginEntries(ROOT, "mass-energy").met).toBe(true);
    for (const paper of ["light-quanta", "brownian-motion", "special-relativity"]) {
      expect(marginEntries(ROOT, paper).met, `${paper} is not met`).toBe(false);
    }
  });

  test("PLANTED: a partial is not counted, and the same entry without one is", () => {
    const partial = rootWithRequirement(
      [
        "paper: fixture-paper",
        "entries:",
        "  - letter: a",
        '    proposition: "A requirement an entry half covers."',
        "    partial:",
        "      satisfiedBy: note-fixture-a",
        '      covers: "half"',
        '      missing: "the other half"',
        "    satisfiedBy: note-fixture-a",
        "",
      ].join("\n"),
    );
    const withPartial = marginEntries(partial, "fixture-paper");
    expect(withPartial.denominator).toBe(1);
    expect(withPartial.count).toBe(0);
    expect(withPartial.note).toContain("partial");

    // The control: the same entry, the same `satisfiedBy`, no `partial`. Without this, a measure
    // that counted nothing at all would satisfy the assertion above.
    const complete = rootWithRequirement(
      [
        "paper: fixture-paper",
        "entries:",
        "  - letter: a",
        '    proposition: "A requirement an entry covers."',
        "    satisfiedBy: note-fixture-a",
        "",
      ].join("\n"),
    );
    const withoutPartial = marginEntries(complete, "fixture-paper");
    expect(withoutPartial.denominator).toBe(1);
    expect(withoutPartial.count).toBe(1);
  });

  /**
   * The corpus still carries at least one partial, and the measure must keep declining to count
   * it. Asserted as a property of the corpus rather than against a named paper, so completing one
   * partial does not turn this red the way the previous version did.
   */
  test("every partial still in the corpus is withheld from its count", () => {
    const withPartials = PAPERS.map((p) => marginEntries(ROOT, p)).filter((c) =>
      c.note.includes("partial"),
    );
    expect(withPartials.length).toBeGreaterThan(0);
    for (const cell of withPartials) {
      expect(cell.note).toMatch(/\d+ partial and therefore not counted/);
      expect(cell.count).toBeLessThan(cell.denominator);
    }
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
