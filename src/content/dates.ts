/**
 * Precision-aware date formatting and chronological comparison helpers.
 * Specification: AGENTS.md and am-cm-schemas-source-1en
 *
 * NO PRODUCTION MODULE IMPORTS THIS, AND DELEGATING TO IT MEANS UNIFYING TWO DATE MODELS
 * (am-50bk, triaged 2026-10-24). The live counterparts exist and were written separately:
 * `src/app/sources/page.tsx:45` declares its own six-line `formatDate`, and
 * `src/content/provenance/checkReceipt.ts:1048` its own `validateChronology` beside
 * `compareDatesAtCoarserPrecision`.
 *
 * They could not simply call this file, because there are TWO `PaperDate` types in this
 * repository and the live pages use the other one. `src/content/schemas/dates.ts`, which this
 * module reads, carries `earliest` and `latest` and a four-member `DATE_PRECISIONS` including
 * `range`; `src/content/provenance/receiptSchema.ts`, which the receipts and `/sources` use,
 * carries a single `iso` and a three-member `DATE_PRECISIONS` with no `range`. Both export
 * `PaperDate`, `PaperDateType` and `DATE_PRECISIONS` under those names, so an import that picks
 * the wrong one type-checks until a field is touched.
 *
 * Both chronology checks are live, so the ordering rule AGENTS.md names is not missing: the
 * receipt one is the stricter of the two, comparing at the coarser of the two precisions where
 * this file's `compareDates` compares interval strings. What this file holds that neither live
 * path does is `compareDates`'s `"indeterminate"` for overlapping intervals and
 * `formatDateStrict`'s refusal to format below the recorded precision. Those belong to the
 * interval model, and whether the edition keeps two date models is a decision above this file.
 */

import type { DatePrecision, PaperDate } from "./schemas/dates.ts";

const PRECISION_RANK: Record<DatePrecision, number> = {
  year: 0,
  month: 1,
  day: 2,
  range: 0,
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export class DatePrecisionError extends Error {
  readonly requested: DatePrecision;
  readonly available: DatePrecision;

  constructor(requested: DatePrecision, available: DatePrecision) {
    super(
      `Cannot format date with precision "${requested}" when recorded precision is "${available}".`,
    );
    this.name = "DatePrecisionError";
    this.requested = requested;
    this.available = available;
  }
}

/**
 * Returns date formatted at the coarser of date.precision and requestedPrecision.
 * Never fabricates or formats below the recorded precision.
 */
export function formatDate(date: PaperDate, requestedPrecision?: DatePrecision): string {
  const req = requestedPrecision || date.precision;
  const effectiveRank = Math.min(PRECISION_RANK[date.precision], PRECISION_RANK[req]);

  const year = date.earliest.slice(0, 4);
  const monthNum = Number(date.earliest.slice(5, 7));
  const day = date.earliest.slice(8, 10);

  if (effectiveRank === 0) {
    // Year
    return year;
  }
  if (effectiveRank === 1) {
    // Month
    const mName = MONTH_NAMES[monthNum - 1] || `${monthNum}`;
    return `${mName} ${year}`;
  }
  // Day
  const mName = MONTH_NAMES[monthNum - 1] || `${monthNum}`;
  return `${Number(day)} ${mName} ${year}`;
}

/**
 * Strict build-time date formatter. Fails if requestedPrecision is finer than date.precision.
 */
export function formatDateStrict(date: PaperDate, requestedPrecision: DatePrecision): string {
  if (PRECISION_RANK[requestedPrecision] > PRECISION_RANK[date.precision]) {
    throw new DatePrecisionError(requestedPrecision, date.precision);
  }
  return formatDate(date, requestedPrecision);
}

/**
 * Compares two historical dates.
 * Returns -1 if d1 strictly precedes d2, 1 if d1 strictly follows d2,
 * 0 if intervals are identical, and "indeterminate" if intervals overlap.
 */
export function compareDates(d1: PaperDate, d2: PaperDate): -1 | 0 | 1 | "indeterminate" {
  if (d1.latest < d2.earliest) {
    return -1;
  }
  if (d1.earliest > d2.latest) {
    return 1;
  }
  if (d1.earliest === d2.earliest && d1.latest === d2.latest) {
    return 0;
  }
  return "indeterminate";
}
