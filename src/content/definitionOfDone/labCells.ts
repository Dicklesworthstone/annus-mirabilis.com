/**
 * ITEM: lab contract cells, per paper (am-definition-of-done-as-code-8w1c).
 *
 * The bead's list says "lab contract cells", and that is literal: the instrument audit judges
 * fourteen contract columns per instrument, so a paper's population is its core instruments times
 * fourteen. A per-instrument pass/fail would lose the information the item is about -- a lab missing
 * one column is not the same as a lab missing nine.
 *
 * IT CONSUMES THE AUDIT, as the bead's third criterion requires: `loadLiveInstrumentRows` reads the
 * manifests and the registry, `auditInstruments` judges them, and the per-cell verdict here uses
 * the same predicate `formatInstrumentAuditTable` uses -- a finding whose `recordId` is the
 * instrument and whose `requirement` (or `check`) is the column. A test asserts this grid agrees
 * with that formatter's PASS/FAIL table cell for cell, so the shared predicate is a checked copy
 * rather than a second opinion that can drift.
 *
 * THE PAPER-TO-INSTRUMENT MAP IS THE ID PREFIX, and I had wrongly called it missing. AGENTS.md's
 * naming section fixes it: "Instrument ids: `lq-01` … `lq-09`, `bm-01` … `bm-08`, `sr-01` … `sr-13`,
 * `me-01` … `me-03`". So the map needs no record; it is in the id, and the unmeasured note that
 * said otherwise was wrong before this file existed.
 */

import { INSTRUMENT_COLUMNS, type InstrumentAuditRow } from "../audits/instruments.ts";
import type { AuditReport } from "../audits/types.ts";

/** The id prefix each paper's core instruments carry (AGENTS.md, naming conventions). */
export const PAPER_INSTRUMENT_PREFIX: Readonly<Record<string, string>> = {
  "light-quanta": "lq",
  "brownian-motion": "bm",
  "special-relativity": "sr",
  "mass-energy": "me",
};

/**
 * Whether one contract cell is satisfied.
 *
 * The predicate is `formatInstrumentAuditTable`'s, deliberately: a finding counts against a cell
 * when it names this instrument AND this column, by `requirement` or by the `instrument-<column>`
 * check id. Both forms are checked there and both are checked here, because a column that only
 * ever reports one of them would otherwise read as satisfied.
 */
export function cellSatisfied(report: AuditReport, instrumentId: string, column: string): boolean {
  return !report.findings.some(
    (f) =>
      f.recordId === instrumentId &&
      (f.requirement === column || f.check === `instrument-${column}`),
  );
}

export type LabCellTally = Readonly<{
  instruments: number;
  columns: number;
  satisfied: number;
  total: number;
}>;

/**
 * The cells for one paper's CORE instruments.
 *
 * Core only, by `row.core`, which the loader sets from the `^(lq|bm|sr|me)-\d{2}$` shape. The shelf
 * labs and other non-core rows are real instruments with their own obligations, but they are not
 * part of a paper's §17.7 definition of done, and folding them in would move the denominator
 * without anyone choosing to.
 */
export function labCellsForPaper(
  report: AuditReport,
  rows: readonly InstrumentAuditRow[],
  paper: string,
): LabCellTally {
  const prefix = PAPER_INSTRUMENT_PREFIX[paper];
  if (prefix === undefined) return { instruments: 0, columns: 0, satisfied: 0, total: 0 };
  const mine = rows.filter((r) => r.core && r.id.startsWith(`${prefix}-`));
  let satisfied = 0;
  for (const row of mine) {
    for (const column of INSTRUMENT_COLUMNS) {
      if (cellSatisfied(report, row.id, column)) satisfied += 1;
    }
  }
  return {
    instruments: mine.length,
    columns: INSTRUMENT_COLUMNS.length,
    satisfied,
    total: mine.length * INSTRUMENT_COLUMNS.length,
  };
}
