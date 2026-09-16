/**
 * Schema and validation for typed historical dates with precision-aware interval storage.
 * Specification: AGENTS.md and am-cm-schemas-source-1en
 */

export const PAPER_DATE_TYPES = [
  "date-line",
  "received",
  "issue-publication",
  "submitted",
  "later-edition",
] as const;
export type PaperDateType = (typeof PAPER_DATE_TYPES)[number];

export const DATE_PRECISIONS = ["day", "month", "year", "range"] as const;
export type DatePrecision = (typeof DATE_PRECISIONS)[number];

export type PaperDate = Readonly<{
  type: PaperDateType;
  text?: string | undefined;
  earliest: string;
  latest: string;
  precision: DatePrecision;
  source: string;
  verifiedAt: string;
  confirmedFromScan?: boolean | undefined;
}>;

export class DateValidationError extends Error {
  readonly code: string;
  readonly recordId?: string | undefined;
  readonly field?: string | undefined;

  constructor(code: string, message: string, recordId?: string, field?: string) {
    super(message);
    this.name = "DateValidationError";
    this.code = code;
    this.recordId = recordId;
    this.field = field;
  }
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function validatePaperDate(raw: unknown, recordId = "unknown", field = "date"): PaperDate {
  if (!raw || typeof raw !== "object") {
    throw new DateValidationError(
      "invalid-date-record",
      "Date must be an object.",
      recordId,
      field,
    );
  }

  const o = raw as Record<string, unknown>;

  // Reject single instant field if present
  if ("instant" in o || ("iso" in o && !("earliest" in o && "latest" in o))) {
    throw new DateValidationError(
      "date-precision-instant",
      `Date record carrying a single instant field; coarse-precision dates must store [earliest, latest] interval.`,
      recordId,
      field,
    );
  }

  if (!PAPER_DATE_TYPES.includes(o.type as PaperDateType)) {
    throw new DateValidationError(
      "invalid-date-type",
      `Invalid date type "${o.type}". Expected one of: ${PAPER_DATE_TYPES.join(", ")}`,
      recordId,
      `${field}.type`,
    );
  }

  if (!DATE_PRECISIONS.includes(o.precision as DatePrecision)) {
    throw new DateValidationError(
      "invalid-date-precision",
      `Invalid date precision "${o.precision}". Expected one of: ${DATE_PRECISIONS.join(", ")}`,
      recordId,
      `${field}.precision`,
    );
  }

  const precision = o.precision as DatePrecision;
  const earliest = typeof o.earliest === "string" ? o.earliest : "";
  const latest = typeof o.latest === "string" ? o.latest : "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(earliest)) {
    throw new DateValidationError(
      "invalid-iso-date",
      `Invalid earliest date format: "${earliest}". Must be YYYY-MM-DD.`,
      recordId,
      `${field}.earliest`,
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(latest)) {
    throw new DateValidationError(
      "invalid-iso-date",
      `Invalid latest date format: "${latest}". Must be YYYY-MM-DD.`,
      recordId,
      `${field}.latest`,
    );
  }

  if (earliest > latest) {
    throw new DateValidationError(
      "date-precision-inverted",
      `Inverted date interval: earliest (${earliest}) is after latest (${latest}).`,
      recordId,
      field,
    );
  }

  const [eY, eM, eD] = earliest.split("-").map(Number) as [number, number, number];
  const [lY, lM, lD] = latest.split("-").map(Number) as [number, number, number];

  if (precision === "day") {
    if (earliest !== latest) {
      throw new DateValidationError(
        "date-precision-interval-mismatch",
        `Precision "day" requires earliest (${earliest}) to equal latest (${latest}).`,
        recordId,
        field,
      );
    }
  } else if (precision === "month") {
    const expectedLast = lastDayOfMonth(eY, eM);
    if (eY !== lY || eM !== lM || eD !== 1 || lD !== expectedLast) {
      throw new DateValidationError(
        "date-precision-interval-mismatch",
        `Precision "month" requires interval from first to last day of month (${eY}-${String(eM).padStart(2, "0")}-01 to ${eY}-${String(eM).padStart(2, "0")}-${expectedLast}), found ${earliest} to ${latest}.`,
        recordId,
        field,
      );
    }
  } else if (precision === "year") {
    if (eY !== lY || eM !== 1 || eD !== 1 || lM !== 12 || lD !== 31) {
      throw new DateValidationError(
        "date-precision-interval-mismatch",
        `Precision "year" requires interval from Jan 1 to Dec 31 of year (${eY}-01-01 to ${eY}-12-31), found ${earliest} to ${latest}.`,
        recordId,
        field,
      );
    }
  }

  if (typeof o.source !== "string" || !o.source.trim()) {
    throw new DateValidationError(
      "missing-date-source",
      "Date source citation is required.",
      recordId,
      `${field}.source`,
    );
  }

  if (typeof o.verifiedAt !== "string" || !o.verifiedAt.trim()) {
    throw new DateValidationError(
      "missing-date-verified",
      "Date verifiedAt is required.",
      recordId,
      `${field}.verifiedAt`,
    );
  }

  return {
    type: o.type as PaperDateType,
    ...(typeof o.text === "string" ? { text: o.text } : {}),
    earliest,
    latest,
    precision,
    source: o.source as string,
    verifiedAt: o.verifiedAt as string,
    ...(typeof o.confirmedFromScan === "boolean" ? { confirmedFromScan: o.confirmedFromScan } : {}),
  };
}

export function validateChronology(dates: readonly PaperDate[], recordId = "unknown"): void {
  const dateline = dates.find((d) => d.type === "date-line");
  const received = dates.find((d) => d.type === "received");
  const published = dates.find((d) => d.type === "issue-publication");

  if (dateline && received) {
    if (received.latest < dateline.earliest) {
      throw new DateValidationError(
        "chronology-received-before-dateline",
        `Paper received date (${received.earliest}..${received.latest}) is strictly before date-line (${dateline.earliest}..${dateline.latest}).`,
        recordId,
        "dates",
      );
    }
  }

  if (received && published) {
    if (published.latest < received.earliest) {
      throw new DateValidationError(
        "chronology-published-before-received",
        `Issue publication date (${published.earliest}..${published.latest}) is strictly before received date (${received.earliest}..${received.latest}).`,
        recordId,
        "dates",
      );
    }
  }
}
