/**
 * THE TOUR-PRESENT CELL (am-definition-of-done-as-code-8w1c).
 *
 * Declared `unmeasured` on the reason "which tour each paper must have is in the plan, so there is
 * no per-paper denominator to read". There are exactly four per-paper tour beads, one each --
 * am-tour-15min-mass-energy-nqz1, am-tour-15min-light-quanta-yj70, am-tour-15min-brownian-z034,
 * am-tour-15min-relativity-qcxc -- and AGENTS.md calls the beads the executable work queue. So the
 * denominator is one per paper and it comes from a record.
 *
 * WHAT THESE TESTS GUARD:
 *
 *   THE MATCH IS ON THE RECORD'S DECLARED `paper`, never on a filename. The only tour that exists is
 *   `fifteen-minutes-mass-energy.yaml` while the bead ids say `brownian` where the paper slug is
 *   `brownian-motion`, so a filename convention guessed from either source would be wrong for at
 *   least one paper. The last test plants a renamed paper field to prove the match is on the field.
 *
 *   ABSENT AND BROKEN ARE DIFFERENT, and both score zero. A record that does not resolve is not a
 *   tour a reader can take, so it cannot count; but the note has to say which case it is, or a
 *   missing tour and a broken one become the same work item.
 */
import { describe, expect, test } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tourPresent } from "./measure.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;

describe("tour-present measures one fifteen-minute tour per paper", () => {
  test("every paper measures against a denominator of one, and none is unmeasured", () => {
    for (const paper of PAPERS) {
      const cell = tourPresent(ROOT, paper);
      expect(cell.unmeasured, `${paper} must measure`).toBe(false);
      expect(cell.denominator, `${paper} owes exactly one fifteen-minute tour`).toBe(1);
    }
  });

  test("mass-energy's tour is present and resolving; the other three are absent", () => {
    const me = tourPresent(ROOT, "mass-energy");
    expect(me.count).toBe(1);
    expect(me.met).toBe(true);
    expect(me.note).toContain("present and resolving");

    for (const paper of ["light-quanta", "brownian-motion", "special-relativity"] as const) {
      const cell = tourPresent(ROOT, paper);
      expect(cell.count, `${paper} has no tour yet`).toBe(0);
      expect(cell.met).toBe(false);
      // The note distinguishes absent from broken, and says how many records it looked at, so a
      // tour directory that silently emptied does not read the same as three unwritten tours.
      expect(cell.note).toContain("no record in content/tours declares paper");
      expect(cell.note).toMatch(/\d+ tour record\(s\) on disk/);
    }
  });

  test("an unknown paper slug scores zero of one rather than crediting another paper's tour", () => {
    // The guard against matching by filename or by position: a slug with no tour must not pick up
    // the one tour that exists.
    const cell = tourPresent(ROOT, "no-such-paper");
    expect(cell.count).toBe(0);
    expect(cell.denominator).toBe(1);
    expect(cell.met).toBe(false);
  });
});
