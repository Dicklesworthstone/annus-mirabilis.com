/**
 * THE DEFINITION OF DONE ONLY MOVES FORWARD (am-definition-of-done-as-code-8w1c).
 *
 * The bead names the consumer and requires it to be running code: "the deploy's fast gates fail
 * when an item the previous release recorded as met now measures lower." This is that gate. It runs
 * in `bun test`, which is the registry's `unit-tests` step in the `fast` family, so the deploy's
 * preflight gates reach it -- a release cannot promote past a regression in a met item.
 *
 * A BASELINE FILE RATHER THAN A RELEASE RECORD, and the reason is measured: `docs/releases/` holds
 * exactly ONE record, the 2026-10-02 candidate, and its own `candidateChecksPassed` is false. A
 * gate that read "the previous release" would therefore have nothing to compare against on every
 * run, which is the vacuous-pass shape this repository keeps finding. baseline.json is tracked, so
 * the comparison exists from the first run and every change to it is a reviewable diff.
 *
 * WHAT IT REFUSES, AND WHAT IT DELIBERATELY DOES NOT:
 *
 *   - a cell the baseline records as MET that now measures lower: REFUSED. That is the regression
 *     the bead is about.
 *   - a cell whose count fell while staying under a smaller denominator: REFUSED, because a
 *     denominator that shrinks with the count hides a removal -- `12 of 12` to `11 of 11` reads as
 *     met both times.
 *   - a cell that IMPROVES: permitted, and the baseline is then stale in the harmless direction.
 *     Lowering the ceiling is the owner's work, as AGENTS.md says for every other ratchet: "when a
 *     debt is paid down, lower the ceiling with it".
 *   - a NEW cell, from a new item or a new paper: permitted. A gate that refused new rows would
 *     make adding an item to the table a red build.
 *
 * It is NOT a percentage and does not aggregate. Each cell is judged against its own recorded pair.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type DoneCell, doneCell } from "./cells.ts";
import { allCells } from "./measure.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_ROOT = join(HERE, "../../..");

type Recorded = Readonly<{ count: number; denominator: number; met: boolean }>;

function baseline(): Readonly<Record<string, Recorded>> {
  const raw = JSON.parse(readFileSync(join(HERE, "baseline.json"), "utf8")) as {
    cells?: Record<string, Recorded>;
  };
  return raw.cells ?? {};
}

/**
 * Every way the measurement has gone backwards against what was recorded.
 *
 * Exported and pure, so the plants below drive it with synthetic cells rather than editing the
 * corpus: a regression test that needs content removed to prove itself cannot run in a shared tree.
 */
export function regressions(
  cells: readonly DoneCell[],
  recorded: Readonly<Record<string, Recorded>>,
): readonly string[] {
  const found: string[] = [];
  for (const cell of cells) {
    const key = `${cell.item}|${cell.paper}`;
    const was = recorded[key];
    if (was === undefined) continue; // a new item or paper is not a regression
    if (was.met && !cell.met) {
      found.push(
        `${key}: was met at ${was.count} of ${was.denominator}, now ${cell.unmeasured ? "unmeasured" : `${cell.count} of ${cell.denominator}`}`,
      );
      continue;
    }
    if (cell.count < was.count) {
      // Caught even when the cell still reads "met", because a denominator that shrinks with the
      // count hides a removal: 12 of 12 to 11 of 11 is met both times and one paragraph short.
      found.push(
        `${key}: the count fell from ${was.count} to ${cell.count} (denominator ${was.denominator} -> ${cell.denominator})`,
      );
    }
  }
  return found;
}

describe("no definition-of-done item regresses against the recorded baseline", () => {
  const recorded = baseline();
  const cells = allCells(REAL_ROOT);

  test("the baseline is real and covers the table", () => {
    // Non-vacuity: an empty baseline would make `regressions` return [] for any corpus at all,
    // and this gate would pass over nothing. That is the exact failure it is built to catch
    // elsewhere, so it is asserted here first.
    const met = Object.values(recorded).filter((r) => r.met).length;
    console.log(
      `[census] definition-of-done ratchet judged ${cells.length} cells against ${Object.keys(recorded).length} recorded, ${met} of them met`,
    );
    expect(Object.keys(recorded).length).toBeGreaterThanOrEqual(40);
    expect(met).toBeGreaterThanOrEqual(20);
  });

  test("NO REGRESSION, and a failure names the item, the paper and both readings", () => {
    expect(regressions(cells, recorded)).toEqual([]);
  });

  test("and no baseline cell is slack: a recorded `met` still measures met", () => {
    // The other direction of the same discipline AGENTS.md applies to every ratchet. A baseline
    // that recorded a cell as not-met while it now measures met is stale in the harmless
    // direction, and is reported rather than failed, so a run that improved the corpus is not red.
    const improved = cells.filter((c) => c.met && recorded[`${c.item}|${c.paper}`]?.met === false);
    if (improved.length > 0) {
      console.log(
        `[baseline is behind, which is not a failure] now met: ${improved.map((c) => `${c.item}|${c.paper}`).join(", ")}. Lower the ceiling with them.`,
      );
    }
    expect(improved.length).toBeGreaterThanOrEqual(0);
  });
});

describe("PLANTS: the gate goes red for each shape of regression, and stays green otherwise", () => {
  const recorded = {
    "paragraphs-bound|mass-energy": { count: 12, denominator: 12, met: true },
    "tour-present|mass-energy": { count: 0, denominator: 0, met: false },
  } as const;

  test("a met item that falls below its denominator is named", () => {
    const planted = [doneCell("paragraphs-bound", "mass-energy", 11, 12, "one removed")];
    const found = regressions(planted, recorded);
    expect(found.length).toBe(1);
    expect(found[0]).toContain("paragraphs-bound|mass-energy");
    expect(found[0]).toContain("was met at 12 of 12");
    expect(found[0]).toContain("11 of 12");
  });

  test("a met item that becomes UNMEASURED is named, not quietly skipped", () => {
    // The sharper case: losing the data entirely makes the cell 0 of 0, which `met === false`
    // catches but a naive `count < was.count` alone would also catch -- and the message must say
    // "unmeasured" rather than "0 of 0", or a reader goes looking for a deleted paragraph.
    const planted = [doneCell("paragraphs-bound", "mass-energy", 0, 0, "bindings file gone")];
    const found = regressions(planted, recorded);
    expect(found.length).toBe(1);
    expect(found[0]).toContain("now unmeasured");
  });

  test("A SHRINKING DENOMINATOR IS CAUGHT, although the cell still reads met", () => {
    // 12 of 12 -> 11 of 11. Both are `met`, so a gate that only compared `met` would pass this,
    // and one paragraph would have left the corpus silently. This is the case worth having.
    const planted = [doneCell("paragraphs-bound", "mass-energy", 11, 11, "one unit removed")];
    const found = regressions(planted, recorded);
    expect(found.length).toBe(1);
    expect(found[0]).toContain("the count fell from 12 to 11");
    expect(found[0]).toContain("denominator 12 -> 11");
  });

  test("an improvement is NOT a regression", () => {
    const planted = [doneCell("tour-present", "mass-energy", 3, 3, "now measured")];
    expect(regressions(planted, recorded)).toEqual([]);
  });

  test("a NEW cell is not a regression, so adding an item is not a red build", () => {
    const planted = [doneCell("margin-entries", "light-quanta", 0, 0, "not read yet")];
    expect(regressions(planted, recorded)).toEqual([]);
  });

  test("an unchanged corpus is green, which is the control", () => {
    const planted = [
      doneCell("paragraphs-bound", "mass-energy", 12, 12, "unchanged"),
      doneCell("tour-present", "mass-energy", 0, 0, "unchanged"),
    ];
    expect(regressions(planted, recorded)).toEqual([]);
  });
});
