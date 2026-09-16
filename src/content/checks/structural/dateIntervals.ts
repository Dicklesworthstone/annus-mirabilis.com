/**
 * Precision-aware date intervals and chronological comparison.
 *
 * Each typed date is treated as an interval [earliest, latest] in ISO YYYY-MM-DD.
 * - Day precision: [YYYY-MM-DD, YYYY-MM-DD]
 * - Month precision: [YYYY-MM-01, YYYY-MM-<lastDay>]
 * - Year precision: [YYYY-01-01, YYYY-12-31]
 * - Range precision: [earliest, latest]
 *
 * A constraint "X is not after Y" fails only when the earliest possible X
 * is strictly later than the latest possible Y (X.earliest > Y.latest).
 *
 * Spec: AGENTS.md, am-cm-schemas-source-1en, and am-cm-checks-structural-lq0
 */

import type { DatePrecision, PaperDate } from "../../schemas/dates.ts";

export interface DateInterval {
  readonly earliest: string;
  readonly latest: string;
  readonly precision?: DatePrecision | undefined;
}

/**
 * Returns the number of days in a given month (accounting for leap years).
 */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Parses an ISO date string or PaperDate object into a normalized DateInterval [earliest, latest].
 */
export function parseDateInterval(input: string | PaperDate | DateInterval): DateInterval {
  if (typeof input === "object" && input !== null) {
    if ("earliest" in input && "latest" in input) {
      return {
        earliest: input.earliest,
        latest: input.latest,
        precision: "precision" in input ? (input.precision as DatePrecision) : undefined,
      };
    }
  }

  if (typeof input === "string") {
    const trimmed = input.trim();

    // Day: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return { earliest: trimmed, latest: trimmed, precision: "day" };
    }

    // Month: YYYY-MM
    if (/^\d{4}-\d{2}$/.test(trimmed)) {
      const [yStr, mStr] = trimmed.split("-");
      const year = Number(yStr);
      const month = Number(mStr);
      const lastDay = lastDayOfMonth(year, month);
      const lastDayStr = String(lastDay).padStart(2, "0");
      return {
        earliest: `${trimmed}-01`,
        latest: `${trimmed}-${lastDayStr}`,
        precision: "month",
      };
    }

    // Year: YYYY
    if (/^\d{4}$/.test(trimmed)) {
      return {
        earliest: `${trimmed}-01-01`,
        latest: `${trimmed}-12-31`,
        precision: "year",
      };
    }

    // Fallback if full ISO timestamp
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      const datePart = trimmed.slice(0, 10);
      return { earliest: datePart, latest: datePart, precision: "day" };
    }
  }

  throw new Error(`Invalid date interval input: ${JSON.stringify(input)}`);
}

/**
 * Checks if interval X is not after interval Y.
 * Fails only when the earliest possible X is strictly later than the latest possible Y (X.earliest > Y.latest).
 */
export function isDateNotAfter(
  x: string | PaperDate | DateInterval,
  y: string | PaperDate | DateInterval,
): boolean {
  const intX = parseDateInterval(x);
  const intY = parseDateInterval(y);
  return intX.earliest <= intY.latest;
}

/**
 * Comprehensive comparison between two date intervals.
 */
export function compareDateIntervals(
  x: string | PaperDate | DateInterval,
  y: string | PaperDate | DateInterval,
): {
  notAfter: boolean;
  earliestX: string;
  latestX: string;
  earliestY: string;
  latestY: string;
} {
  const intX = parseDateInterval(x);
  const intY = parseDateInterval(y);
  return {
    notAfter: intX.earliest <= intY.latest,
    earliestX: intX.earliest,
    latestX: intX.latest,
    earliestY: intY.earliest,
    latestY: intY.latest,
  };
}
