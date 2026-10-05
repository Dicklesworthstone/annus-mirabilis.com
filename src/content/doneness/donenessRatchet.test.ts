/**
 * A MET ITEM MAY NOT REGRESS (am-definition-of-done-as-code-8w1c).
 *
 * This is the consumer the bead asks for: running code that branches on the report, so the report is
 * a gate rather than a status page. AGENTS.md's creation gate for process artifacts is satisfied by
 * this file and not by the report alone.
 *
 * WHAT COUNTS AS A REGRESSION, and why each is here rather than a cheaper rule:
 *
 *   met -> short        An item that was complete is not. The case the bead was filed for.
 *   met -> unmeasured   The MEASUREMENT disappeared. This is the dangerous one: an unmeasured cell
 *                       is not a failure anywhere else in this repository, so a change that removed
 *                       a loader or emptied a population would otherwise turn a met item into
 *                       silence and nothing would say so.
 *   numerator drops at the same denominator
 *                       Twelve paragraphs bound of twelve becomes eleven of twelve.
 *
 * WHAT IS NOT A REGRESSION, deliberately. A CHANGED DENOMINATOR is new content, not a loss: a paper
 * that gains a printed sentence goes from 28 of 28 to 29 of 29, and a ratchet keyed on the numerator
 * alone would go red on correct authoring work every time. So the numerator is compared only at an
 * equal denominator, and the state transition carries the rest.
 *
 * AND AN ABSENT BUILD IS NOT A REGRESSION EITHER, which is the half that would otherwise make this
 * gate useless to a developer. Two of the fifteen items read out/, so without a build they report
 * unmeasured and the met -> unmeasured rule above would fire on eight cells for a reason that has
 * nothing to do with the papers. Those cells are skipped BY THEIR OWN REASON -- the report's detail
 * names the build -- and the number skipped is printed, so a run with no build is visibly partial
 * rather than quietly clean. That distinction is the contract's declineForDisk rule applied here: a
 * missing input is not a verdict.
 *
 * THE BASELINE IS A RECORD OF A DEBT. Where a cell has improved, this fails and prints the exact
 * replacement, so the ceiling comes down with the work instead of only ever rising.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DONENESS_PAPERS, type DonenessCell, siteDoneness } from "./definitionOfDone.ts";

const ROOT = process.cwd();
const BASELINE_PATH = join(ROOT, "src/content/doneness/donenessBaseline.json");

type BaselineCell = Readonly<{ state: string; met: number; of: number }>;
type Baseline = Readonly<Record<string, Readonly<Record<string, BaselineCell>>>>;

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Baseline;

/** A cell the report could not measure because `out/` is absent, named by its own reason. */
const buildAbsent = (c: DonenessCell): boolean =>
  c.state === "unmeasured" && c.detail.includes("bun run build");

describe("the definition-of-done ratchet", () => {
  const report = siteDoneness(ROOT);

  it("the baseline names every paper and every item the report produces", () => {
    // Without this the loop below silently skips a cell the baseline forgot, and a forgotten cell is
    // exactly where a regression would hide.
    expect(Object.keys(baseline).sort()).toEqual([...DONENESS_PAPERS].sort());
    for (const paper of report) {
      const recorded = baseline[paper.paper];
      expect(recorded).toBeDefined();
      expect(Object.keys(recorded ?? {}).sort()).toEqual(paper.cells.map((c) => c.item).sort());
    }
  });

  it("no met item has regressed, and no measurement has vanished", () => {
    const regressions: string[] = [];
    let compared = 0;
    let skippedForBuild = 0;
    for (const paper of report) {
      for (const c of paper.cells) {
        const was = baseline[paper.paper]?.[c.item];
        if (!was) continue;
        if (buildAbsent(c)) {
          skippedForBuild += 1;
          continue;
        }
        compared += 1;
        if (was.state === "met" && c.state === "short")
          regressions.push(
            `${paper.paper}/${c.item}: was met at ${was.met}/${was.of}, now ${c.met}/${c.of}`,
          );
        else if (was.state === "met" && c.state === "unmeasured")
          regressions.push(
            `${paper.paper}/${c.item}: was met at ${was.met}/${was.of}, now UNMEASURED -- ${c.detail}`,
          );
        else if (c.of === was.of && c.met < was.met)
          regressions.push(
            `${paper.paper}/${c.item}: ${c.met} of ${c.of}, was ${was.met} of the same ${was.of}`,
          );
      }
    }
    console.log(
      `[doneness ratchet] ${compared} cells compared against the baseline; ${skippedForBuild} skipped because out/ is absent`,
    );
    // Non-vacuity: a run that compared nothing would report no regression. Two of the fifteen items
    // read out/, so even with no build 13 of 15 per paper remain comparable.
    expect(compared).toBeGreaterThanOrEqual(DONENESS_PAPERS.length * 13);
    expect(regressions).toEqual([]);
  });

  it("no baseline is slack: a cell that has improved must be recorded at its new figure", () => {
    const slack: string[] = [];
    for (const paper of report) {
      for (const c of paper.cells) {
        const was = baseline[paper.paper]?.[c.item];
        if (!was || buildAbsent(c)) continue;
        const improved =
          (was.state !== "met" && c.state === "met") || (c.of === was.of && c.met > was.met);
        if (improved)
          slack.push(
            `  "${paper.paper}" / "${c.item}": {"state": "${c.state}", "met": ${c.met}, "of": ${c.of}}   (was ${was.state} ${was.met}/${was.of})`,
          );
      }
    }
    expect(slack).toEqual([]);
  });
});

describe("the ratchet's own predicates, planted both ways", () => {
  /** The comparison, lifted out so it can be driven on values rather than on the repository. */
  const regressed = (was: BaselineCell, now: Pick<DonenessCell, "state" | "met" | "of">): boolean =>
    (was.state === "met" && now.state === "short") ||
    (was.state === "met" && now.state === "unmeasured") ||
    (now.of === was.of && now.met < was.met);

  it("catches the three regressions it is for", () => {
    expect(regressed({ state: "met", met: 12, of: 12 }, { state: "short", met: 11, of: 12 })).toBe(
      true,
    );
    expect(
      regressed({ state: "met", met: 12, of: 12 }, { state: "unmeasured", met: 0, of: 0 }),
    ).toBe(true);
    expect(regressed({ state: "short", met: 5, of: 7 }, { state: "short", met: 4, of: 7 })).toBe(
      true,
    );
  });

  it("does NOT fire on new content, which is the false red it would otherwise produce daily", () => {
    // A paper gains a printed sentence: 28 of 28 becomes 29 of 29. Still met, nothing lost.
    expect(regressed({ state: "met", met: 28, of: 28 }, { state: "met", met: 29, of: 29 })).toBe(
      false,
    );
    // And a paper gains a sentence that is not yet served: the denominator grew, so the numerator
    // comparison is not made, and the state transition reports it instead.
    expect(regressed({ state: "met", met: 28, of: 28 }, { state: "short", met: 28, of: 29 })).toBe(
      true,
    );
  });

  it("does not fire on an item that was already unmeasured", () => {
    // The seven declared items stay unmeasured run after run; they must not read as regressions.
    expect(
      regressed({ state: "unmeasured", met: 0, of: 0 }, { state: "unmeasured", met: 0, of: 0 }),
    ).toBe(false);
  });

  it("an absent build is skipped by its own reason, not by its item name", () => {
    // Keyed on the report's detail rather than on a list of item names, so a third item that starts
    // reading out/ is covered without anyone remembering to add it here.
    expect(
      buildAbsent({
        item: "x",
        met: 0,
        of: 0,
        state: "unmeasured",
        detail: "no built German face at out/...; run bun run build",
      }),
    ).toBe(true);
    expect(
      buildAbsent({
        item: "y",
        met: 0,
        of: 0,
        state: "unmeasured",
        detail: "no record states which R2 passage expands which R1 passage",
      }),
    ).toBe(false);
    // And a MEASURED cell is never skipped, whatever its detail says.
    expect(
      buildAbsent({ item: "z", met: 1, of: 1, state: "met", detail: "run bun run build" }),
    ).toBe(false);
  });
});
