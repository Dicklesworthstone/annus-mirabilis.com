#!/usr/bin/env bun
/**
 * EACH PAPER'S DEFINITION OF DONE, COMPUTED FROM THE RECORDS
 * (am-definition-of-done-as-code-8w1c).
 *
 *   bun scripts/definition-of-done.ts            the table
 *   bun scripts/definition-of-done.ts --json     the same cells as data
 *
 * Why this exists, in the bead's own words: bead status stands in for §17.7 today and it measures
 * ACCEPTANCE, not the product -- all 33 instrument beads are open while all 33 labs are live, and
 * `coverage-report.ts` refuses "no loader wired" while its bead is closed. (I confirmed that
 * refusal separately: as registered the step runs with no arguments and exits 1.)
 *
 * NO AGGREGATE PERCENTAGE, ANYWHERE. Every cell is a count with its denominator. AGENTS.md forbids
 * "a single flattering completeness percentage that aggregates translation, instruments, review,
 * and validation", and the reason is visible in the first run: the papers differ eightfold in size,
 * so any average is relativity's number wearing four papers' clothes.
 *
 * A ZERO DENOMINATOR PRINTS `unmeasured`, NEVER A TICK. Seven of the thirteen items are not read
 * yet and each says why and where its data is, so the gaps are work items rather than silence.
 */

import { resolve } from "node:path";
import {
  DONE_ITEMS,
  type DoneCell,
  formatCell,
  measuredCount,
} from "../src/content/definitionOfDone/cells.ts";
import { allCells, DONE_PAPERS } from "../src/content/definitionOfDone/measure.ts";
import { reportPopulation } from "./gate-census/population.ts";

export function renderTable(cells: readonly DoneCell[]): string {
  const byKey = new Map(cells.map((c) => [`${c.item}|${c.paper}`, c]));
  const widest = Math.max(...DONE_ITEMS.map((i) => i.length));
  const cols = DONE_PAPERS.map((p) => p.slice(0, 13));
  const lines: string[] = [];
  lines.push(`${"item".padEnd(widest)}  ${cols.map((c) => c.padStart(13)).join("  ")}`);
  lines.push("-".repeat(widest + cols.length * 15));
  for (const item of DONE_ITEMS) {
    const row = DONE_PAPERS.map((paper) => {
      const cell = byKey.get(`${item}|${paper}`);
      return (cell ? formatCell(cell) : "-").padStart(13);
    });
    lines.push(`${item.padEnd(widest)}  ${row.join("  ")}`);
  }
  return lines.join("\n");
}

/** The items that are met for a paper, which is what a closure rule would read. */
export function metItems(cells: readonly DoneCell[], paper: string): readonly string[] {
  return cells.filter((c) => c.paper === paper && c.met).map((c) => c.item);
}

function main(argv: readonly string[]): number {
  const root = resolve(process.cwd());
  const cells = allCells(root);
  const measured = measuredCount(cells);

  if (argv.includes("--json")) {
    console.log(JSON.stringify({ cells, measured, total: cells.length }, null, 2));
  } else {
    console.log(
      "=== Definition of done, per paper (plan §17.7, am-definition-of-done-as-code-8w1c) ===\n",
    );
    console.log(renderTable(cells));
    console.log("\nMet items per paper:");
    for (const paper of DONE_PAPERS) {
      const met = metItems(cells, paper);
      console.log(
        `  ${paper.padEnd(20)} ${met.length} of ${DONE_ITEMS.length}: ${met.join(", ") || "(none)"}`,
      );
    }
    console.log("\nUnmeasured items, with the reason and where the data is:");
    const seen = new Set<string>();
    for (const cell of cells) {
      if (!cell.unmeasured || seen.has(cell.item)) continue;
      seen.add(cell.item);
      console.log(`  ${cell.item}: ${cell.note}`);
    }
    console.log(
      "\nNo percentage is printed, by design (AGENTS.md: no single flattering completeness figure). " +
        "An `unmeasured` cell is NOT met: 0 of 0 is arithmetically perfect and says nothing.",
    );
  }

  /*
    THE POPULATION IS THE MEASURED CELLS, not the cells that exist. Four papers times thirteen items
    is always fifty-two, so counting those could never fall and the line would be decoration. The
    floor is 20 against the 24 measured today -- six items across four papers -- so losing a whole
    item is caught while adding a paper or an item is not refused.
  */
  const vacuous = reportPopulation({
    gate: "definition-of-done",
    examined: measured,
    noun: "measured definition-of-done cells",
    minimum: 20,
  });
  if (vacuous) {
    console.error(
      `REFUSED: ${measured} of ${cells.length} cells were measured, below the floor. A table of ` +
        "mostly-unmeasured cells is not a definition-of-done report; check that content/ is present.",
    );
    return 1;
  }
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
