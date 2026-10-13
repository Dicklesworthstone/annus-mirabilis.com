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
 *   THE MATCH IS ON THE RECORD'S DECLARED `paper`, never on a filename. The bead ids say
 *   `brownian` where the paper slug is `brownian-motion`, so a filename convention guessed from
 *   either source would be wrong for at least one paper. The unknown-slug test is what holds the
 *   match to the field: a slug with no tour must not pick up another paper's record.
 *   (This paragraph claimed "the last test plants a renamed paper field". No such plant was ever
 *   in the file; the last test is the unknown-slug one.)
 *
 *   ABSENT AND BROKEN ARE DIFFERENT, and both score zero. A record that does not resolve is not a
 *   tour a reader can take, so it cannot count; but the note has to say which case it is, or a
 *   missing tour and a broken one become the same work item.
 *
 * IT USED TO FREEZE THE CENSUS, AND THAT BROKE ON CORRECT WORK. The second test asserted
 * `count === 1` for mass-energy and `count === 0` for the other three, under a title saying so.
 * Writing the light-quanta tour (46a57b30b) turned it red with nothing it protects changed, and the
 * relativity tour (8ccc9d852) would have again: the cell is designed to climb from 0 of 1 to 1 of 1
 * per paper, so any equality against today's total expires the next time someone does the work.
 * AGENTS.md puts it as "A Count Is For Reporting, Not For Asserting".
 *
 * So the tests below assert the PROPERTIES, which hold at any size: every paper is in exactly one
 * bucket; a paper with a resolving record counts 1 and is met and says so; a paper without one
 * counts 0, is not met, and its note distinguishes absent from broken and states how many records
 * it examined. The present bucket carries a floor rather than an equality, because it only ever
 * grows, and the absent bucket is reported rather than asserted, because the day all four tours
 * exist it is legitimately empty and that must not be a failure.
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

  test("each paper is in exactly one bucket, and each bucket says which it is", () => {
    const present: string[] = [];
    const absent: string[] = [];
    const broken: string[] = [];
    for (const paper of PAPERS) {
      const cell = tourPresent(ROOT, paper);
      if (cell.met) {
        // A met cell is a tour a reader can take: it counts one and names the record.
        expect(cell.count, `${paper} is met, so it counts one`).toBe(1);
        expect(cell.note, `${paper}'s note names the record and its state`).toContain(
          "present and resolving",
        );
        present.push(paper);
        continue;
      }
      expect(cell.count, `${paper} is not met, so it counts zero`).toBe(0);
      if (cell.note.includes("no record in content/tours declares paper")) {
        // Absent: the note also says how many records it examined, so a tour directory that
        // silently emptied does not read the same as an unwritten tour.
        expect(cell.note).toMatch(/\d+ tour record\(s\) on disk/);
        absent.push(paper);
        continue;
      }
      // Broken: present but not resolving, which is a different work item from absent.
      expect(cell.note, `${paper} is neither met, absent, nor broken`).toContain(
        "does not resolve",
      );
      broken.push(paper);
    }
    // The partition is total, and reported rather than asserted as a frozen total.
    expect(present.length + absent.length + broken.length).toBe(PAPERS.length);
    console.log(
      `[census] tour-present: ${present.length} present (${present.join(", ") || "none"}), ` +
        `${absent.length} absent (${absent.join(", ") || "none"}), ` +
        `${broken.length} broken (${broken.join(", ") || "none"}) of ${PAPERS.length} papers`,
    );
    // A floor, not an equality: this only ever grows, and a run that credited nothing would
    // otherwise iterate the met branch zero times and pass while proving nothing.
    expect(present.length, "at least one paper's tour is written and resolving").toBeGreaterThan(0);
    // No tour may be broken. This one IS an equality, because it is a property rather than a
    // census: a record that exists must resolve.
    expect(broken, "a tour record that exists must resolve").toEqual([]);
  });

  test("the papers whose tours are written are identified, not counted", () => {
    // Identity rather than census, because a written tour is permanent: once a paper's record
    // exists and resolves, it does not go back to absent. Each id is asserted on its own, so this
    // grows by one line per tour instead of breaking on the next one.
    for (const paper of ["mass-energy", "light-quanta", "special-relativity"] as const) {
      const cell = tourPresent(ROOT, paper);
      expect(cell.met, `${paper}'s fifteen-minute tour is written and must stay so`).toBe(true);
    }
    // brownian-motion is deliberately not asserted either way: am-tour-15min-brownian-z034 is
    // blocked on bm-06's predict-mode exemption, so it is absent today and must be free to become
    // met without touching this file.
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
