/**
 * THE DEFINITION OF DONE, COMPUTED FROM THE RECORDS (am-definition-of-done-as-code-8w1c).
 *
 * Plan §17.7 lists per-paper items. Today bead status stands in for them, and the bead's own
 * background says why that fails: all 33 instrument beads are open while all 33 labs are live,
 * several beads are closed while the deliverable does not work, and `coverage-report.ts` refuses
 * "no loader wired" while am-cm-coverage-ledger-0ip is closed. Bead status measures ACCEPTANCE,
 * not the product.
 *
 * EVERY CELL IS A COUNT WITH ITS DENOMINATOR, never an aggregate percentage. AGENTS.md forbids "a
 * single flattering completeness percentage that aggregates translation, instruments, review, and
 * validation", and the reason shows up immediately here: the four papers differ by a factor of
 * eight in size, so any average over them is dominated by relativity and says nothing about
 * mass-energy.
 *
 * A ZERO DENOMINATOR IS `unmeasured`, NEVER `met`. That is the bead's first acceptance criterion
 * and it is the whole design: an item whose data this report cannot read must not come out looking
 * complete, because `0 of 0` is arithmetically perfect and informationally empty. Each unmeasured
 * cell carries the reason and, where known, the path its data would come from -- so the gap is a
 * work item rather than a silence.
 */

/** The §17.7 items, as ids. Every paper has a cell for every item, measured or not. */
export const DONE_ITEMS = [
  "manifest-units-covered",
  "english-units-present",
  "paragraphs-bound",
  "displays-bound",
  "results-cards-printed",
  "misconceptions-at-least-five",
  "readings-r0-to-r3",
  "r2-covers-r1",
  "margin-entries",
  "lab-contract-cells",
  "journey-skeleton-parts",
  "tour-present",
  "reviews-with-names",
] as const;

export type DoneItem = (typeof DONE_ITEMS)[number];

export type DoneCell = Readonly<{
  item: DoneItem;
  paper: string;
  /** The numerator: how many of the denominator are done. */
  count: number;
  /** The population. Zero means this report could not read the item at all. */
  denominator: number;
  /** True only when the denominator is real AND every member is accounted for. */
  met: boolean;
  /** True when the denominator is zero, which is never `met`. */
  unmeasured: boolean;
  /** Why it is unmeasured, or what the two numbers mean. Always present. */
  note: string;
}>;

/**
 * The one constructor, so the met/unmeasured rule is applied in a single place.
 *
 * `met` requires `denominator > 0`, which is the rule the first acceptance criterion names. It is
 * expressed here rather than at each call site because thirteen items times four papers is
 * fifty-two chances to write `count === denominator` and have it be true of nothing.
 */
/**
 * A CODED refusal, so the throw-site census can name it. Three bare `RangeError`s sat here until
 * the bare-throw ratchet refused the commit: "Either give these refusals typed codes, or add the
 * file to the baseline... and say why the debt is being recorded rather than paid." AGENTS.md
 * settles which -- "a baseline is the record of a debt, not a budget to draw on" -- so they are
 * coded rather than baselined. The code is the FIRST argument and a standalone kebab string,
 * which is what src/testing/refusals/throwSiteCensus.ts reads (KEBAB_CODE is anchored, so a code
 * inside a message template is invisible to it).
 */
export class DoneCellError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "DoneCellError";
  }
}

export function doneCell(
  item: DoneItem,
  paper: string,
  count: number,
  denominator: number,
  note: string,
): DoneCell {
  if (!Number.isInteger(count) || count < 0) {
    throw new DoneCellError(
      "done-cell-count",
      `${item}/${paper}: count must be a non-negative integer, got ${count}.`,
    );
  }
  if (!Number.isInteger(denominator) || denominator < 0) {
    throw new DoneCellError(
      "done-cell-denominator",
      `${item}/${paper}: denominator must be a non-negative integer, got ${denominator}.`,
    );
  }
  if (count > denominator) {
    // Not defensive: a numerator above its denominator means the two were counted over different
    // populations, which is the error this whole report exists to make visible.
    throw new DoneCellError(
      "done-cell-population-mismatch",
      `${item}/${paper}: counted ${count} of ${denominator}, which means the numerator and the ` +
        "denominator are not the same population.",
    );
  }
  const unmeasured = denominator === 0;
  return Object.freeze({
    item,
    paper,
    count,
    denominator,
    met: !unmeasured && count === denominator,
    unmeasured,
    note,
  });
}

/** An item this report cannot read, with the reason and where its data would come from. */
export function unmeasuredCell(item: DoneItem, paper: string, reason: string): DoneCell {
  return doneCell(item, paper, 0, 0, reason);
}

/** `12 of 14` or `unmeasured`, for a table. Never a percentage. */
export function formatCell(cell: DoneCell): string {
  return cell.unmeasured ? "unmeasured" : `${cell.count} of ${cell.denominator}`;
}

/**
 * The report's own census line, in the gate grammar
 * (scripts/gate-census/population.ts, am-rc1001-bridge-plan-pcjk.9).
 *
 * The population is the cells that were MEASURED, not the cells that exist: a report over four
 * papers always has fifty-two cells, so counting those could never fall and would make the line
 * useless. A run that measured nothing would print 0 and be refused.
 */
export function measuredCount(cells: readonly DoneCell[]): number {
  return cells.filter((c) => !c.unmeasured).length;
}
