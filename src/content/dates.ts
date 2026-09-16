/**
 * Precision-aware date formatting and chronological comparison helpers.
 * Specification: AGENTS.md and am-cm-schemas-source-1en
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
