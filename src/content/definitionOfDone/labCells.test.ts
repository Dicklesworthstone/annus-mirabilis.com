/**
 * THE LAB-CONTRACT-CELL GRID AGREES WITH THE AUDIT'S OWN TABLE, cell for cell.
 *
 * `cellSatisfied` repeats the predicate inside `formatInstrumentAuditTable`: a finding counts
 * against a cell when it names this instrument AND this column, by `requirement` or by the
 * `instrument-<column>` check id. A repeated predicate beside its original is the mistake
 * src/reader/anchors/mapToFace.ts made with SENTENCE_PATTERN, so this file is the thing that makes
 * the copy safe -- it drives the real audit and compares my grid with the formatter's PASS/FAIL
 * table position by position. If either side changes, this goes red rather than the two drifting.
 *
 * It also records what the grid currently finds, because the point of the row is to surface
 * something: five of the thirty-three core labs declare no probes.
 */

import { describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditInstruments,
  formatInstrumentAuditTable,
  INSTRUMENT_COLUMNS,
  loadLiveInstrumentRows,
} from "../audits/instruments.ts";
import { cellSatisfied, labCellsForPaper, PAPER_INSTRUMENT_PREFIX } from "./labCells.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const rows = loadLiveInstrumentRows(ROOT);
const report = auditInstruments(rows);

describe("the grid is the audit's own verdict, not a second opinion", () => {
  test("every cell agrees with formatInstrumentAuditTable's PASS/FAIL", () => {
    const table = formatInstrumentAuditTable(report, rows);
    const lines = table.split("\n").slice(2); // header, separator, then one line per row
    expect(lines.length).toBe(rows.length);

    let compared = 0;
    const disagreements: string[] = [];
    for (const [index, row] of rows.entries()) {
      const cells = (lines[index] ?? "").split("|").map((c) => c.trim());
      // cells[0] is empty (leading pipe), cells[1] is the id, then one per column.
      expect(cells[1]).toBe(row.id);
      for (const [i, column] of INSTRUMENT_COLUMNS.entries()) {
        const fromTable = cells[2 + i] === "PASS";
        const fromGrid = cellSatisfied(report, row.id, column);
        compared += 1;
        if (fromTable !== fromGrid) {
          disagreements.push(`${row.id}/${column}: table ${cells[2 + i]}, grid ${fromGrid}`);
        }
      }
    }
    // The denominator beside the verdict: an empty comparison would agree perfectly.
    console.log(`[census] lab-cell grid compared ${compared} cells against the audit's own table`);
    expect(compared).toBeGreaterThanOrEqual(33 * INSTRUMENT_COLUMNS.length);
    expect(disagreements).toEqual([]);
  });

  test("the predicate can FAIL a cell, so the agreement above is not two constants", () => {
    // Non-vacuity. If `cellSatisfied` returned true unconditionally it would agree with a table
    // that was all PASS, and the test above would pass over nothing.
    const failing = rows.flatMap((row) =>
      INSTRUMENT_COLUMNS.filter((c) => !cellSatisfied(report, row.id, c)).map(
        (c) => `${row.id}/${c}`,
      ),
    );
    expect(failing.length).toBeGreaterThan(0);
    console.log(
      `[census] ${failing.length} cells currently unsatisfied: ${failing.slice(0, 8).join(", ")}`,
    );
  });
});

describe("the per-paper population is the paper's core instruments times the columns", () => {
  test("each paper's instrument count is the one AGENTS.md records: 9, 8, 13, 3", () => {
    // AGENTS.md's naming section: lq-01..lq-09, bm-01..bm-08, sr-01..sr-13, me-01..me-03, and its
    // status block says all 33 core labs are live. The denominators follow from those, so a change
    // to either shows up here rather than silently moving a definition-of-done row.
    const expected: Record<string, number> = {
      "light-quanta": 9,
      "brownian-motion": 8,
      "special-relativity": 13,
      "mass-energy": 3,
    };
    let instruments = 0;
    for (const [paper, count] of Object.entries(expected)) {
      const tally = labCellsForPaper(report, rows, paper);
      expect(tally.instruments).toBe(count);
      expect(tally.total).toBe(count * INSTRUMENT_COLUMNS.length);
      instruments += tally.instruments;
    }
    expect(instruments).toBe(33);
  });

  test("the five unsatisfied core cells are all the probes column, named", () => {
    // Recorded as identity rather than a count, because the point of this row is to surface a
    // specific gap: five of the thirty-three core labs declare no probes. If a sixth appears, or
    // one is fixed, this is where it shows -- and a count alone would not say which.
    const unsatisfied: string[] = [];
    for (const paper of Object.keys(PAPER_INSTRUMENT_PREFIX)) {
      const prefix = PAPER_INSTRUMENT_PREFIX[paper] as string;
      for (const row of rows.filter((r) => r.core && r.id.startsWith(`${prefix}-`))) {
        for (const column of INSTRUMENT_COLUMNS) {
          if (!cellSatisfied(report, row.id, column)) unsatisfied.push(`${row.id}/${column}`);
        }
      }
    }
    expect(unsatisfied.slice().sort()).toEqual([
      "lq-09/probes",
      "me-01/probes",
      "me-03/probes",
      "sr-01/probes",
      "sr-04/probes",
    ]);
  });

  test("a paper with no prefix measures nothing rather than throwing", () => {
    const tally = labCellsForPaper(report, rows, "molecular-dimensions");
    expect(tally.total).toBe(0);
    expect(tally.instruments).toBe(0);
  });

  test("non-core rows are excluded, so the shelf labs do not move a paper's denominator", () => {
    // The shelf labs also declare no probes -- shelf-michelson-morley, shelf-fizeau and
    // shelf-maxwell-galilean -- and they are real instruments with their own obligations. They are
    // not part of a paper's §17.7 definition of done, and folding them in would move the
    // denominator without anyone choosing to.
    const nonCore = rows.filter((r) => !r.core);
    expect(nonCore.length).toBeGreaterThan(0);
    const sr = labCellsForPaper(report, rows, "special-relativity");
    expect(sr.instruments).toBe(13);
    expect(rows.filter((r) => r.id.startsWith("sr-")).length).toBeGreaterThanOrEqual(13);
  });
});
