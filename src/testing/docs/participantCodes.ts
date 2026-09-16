/**
 * Strict participant-code parser and formatter (am-edit-comprehension-protocol-ouih).
 *
 * Participant codes have the exact shape:
 *   <paper>-<route>-<YYYYMMDD>-<nn>
 * E.g.:
 *   brownian-motion-nonvisual-20270412-03
 *   brownian-motion-full-derivation-20270412-01
 *   brownian-motion-slice-low-cost-phone-20270412-11
 *
 * Because both paper slugs and route identifiers contain hyphens, parsing proceeds
 * strictly from the right (last token: 2-digit index, second-to-last: 8-digit date,
 * preceding tokens matched against closed route list and closed paper list).
 *
 * This parser is the SINGLE authority in the repository for participant code validation.
 */

export const VALID_PAPERS = [
  "light-quanta",
  "brownian-motion",
  "special-relativity",
  "mass-energy",
  "molecular-dimensions",
  "brownian-motion-slice",
] as const;

export type ValidPaper = (typeof VALID_PAPERS)[number];

export const VALID_ROUTES = [
  "no-algebra",
  "nonvisual",
  "full-derivation",
  "low-cost-phone",
] as const;

export type ValidRoute = (typeof VALID_ROUTES)[number];

export interface ParsedParticipantCode {
  readonly ok: true;
  readonly paper: ValidPaper;
  readonly route: ValidRoute;
  readonly date: string; // "YYYY-MM-DD"
  readonly index: number;
  readonly rawCode: string;
}

export interface FailedParticipantCode {
  readonly ok: false;
  readonly error: string;
  readonly expected?: string | undefined;
}

export type ParticipantCodeResult = ParsedParticipantCode | FailedParticipantCode;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 1: // Jan
    case 3: // Mar
    case 5: // May
    case 7: // Jul
    case 8: // Aug
    case 10: // Oct
    case 12: // Dec
      return 31;
    case 4: // Apr
    case 6: // Jun
    case 9: // Sep
    case 11: // Nov
      return 30;
    case 2: // Feb
      return isLeapYear(year) ? 29 : 28;
    default:
      return 0;
  }
}

function validateCalendarDate(
  dateDigits: string,
): { ok: true; date: string } | { ok: false; error: string } {
  if (!/^\d{8}$/.test(dateDigits)) {
    return {
      ok: false,
      error: `Date segment must be 8 digits in YYYYMMDD format without hyphens (e.g. 20270412), received "${dateDigits}"`,
    };
  }

  const year = parseInt(dateDigits.slice(0, 4), 10);
  const month = parseInt(dateDigits.slice(4, 6), 10);
  const day = parseInt(dateDigits.slice(6, 8), 10);

  if (month < 1 || month > 12) {
    return {
      ok: false,
      error: `Impossible calendar month in date "${dateDigits}": month must be between 01 and 12`,
    };
  }

  const maxDays = daysInMonth(year, month);
  if (day < 1 || day > maxDays) {
    return {
      ok: false,
      error: `Impossible calendar date "${dateDigits}": month ${month.toString().padStart(2, "0")} has ${maxDays} days in year ${year}`,
    };
  }

  const formattedDate = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  return { ok: true, date: formattedDate };
}

/**
 * Parses a participant code strictly from the right.
 */
export function parseParticipantCode(code: string): ParticipantCodeResult {
  if (typeof code !== "string" || !code.trim()) {
    return {
      ok: false,
      error: "Participant code must be a non-empty string",
      expected: "<paper>-<route>-<YYYYMMDD>-<nn>",
    };
  }

  const trimmed = code.trim();
  const tokens = trimmed.split("-");

  if (tokens.length < 4) {
    return {
      ok: false,
      error: `Participant code "${trimmed}" has fewer than 4 hyphen-separated segments`,
      expected: "<paper>-<route>-<YYYYMMDD>-<nn>",
    };
  }

  // Segment N (last): index (exactly 2 digits)
  const lastIndex = tokens.length - 1;
  const indexStr = tokens[lastIndex] ?? "";

  // Check if someone passed a hyphenated date like 2027-04-12-3
  // in which case tokens near the end are single/double digits representing month/day/index
  if (tokens.length >= 6) {
    const fourthFromLast = tokens[tokens.length - 4] ?? "";
    if (/^\d{4}$/.test(fourthFromLast)) {
      return {
        ok: false,
        error: `Date segment must be 8 digits in YYYYMMDD format without hyphens (e.g. 20270412), received hyphenated date form "${tokens.slice(tokens.length - 4, tokens.length - 1).join("-")}"`,
        expected: "YYYYMMDD without hyphens",
      };
    }
  }

  if (!/^\d{2}$/.test(indexStr)) {
    return {
      ok: false,
      error: `Participant code index must be exactly two digits (01-99), received "${indexStr}"`,
      expected: "two-digit index 01-99",
    };
  }

  const index = parseInt(indexStr, 10);
  if (index < 1 || index > 99) {
    return {
      ok: false,
      error: `Participant code index must be between 01 and 99, received "${indexStr}"`,
      expected: "01-99",
    };
  }

  // Segment N-1 (second to last): date in YYYYMMDD format (8 digits)
  const dateStr = tokens[tokens.length - 2] ?? "";
  const dateValidation = validateCalendarDate(dateStr);
  if (!dateValidation.ok) {
    return {
      ok: false,
      error: dateValidation.error,
      expected: "valid calendar date in YYYYMMDD format (e.g. 20270412)",
    };
  }

  // Prefix tokens: paper and route
  const prefix = tokens.slice(0, tokens.length - 2).join("-");

  // Match route from closed list from the right of prefix
  let matchedRoute: ValidRoute | undefined;
  let matchedPaper: string | undefined;

  for (const route of VALID_ROUTES) {
    if (prefix.endsWith(`-${route}`)) {
      matchedRoute = route;
      matchedPaper = prefix.slice(0, prefix.length - route.length - 1);
      break;
    }
  }

  if (!matchedRoute) {
    // Determine what route was attempted for descriptive error
    const lastDashIdx = prefix.lastIndexOf("-");
    const attemptedRoute = lastDashIdx >= 0 ? prefix.slice(lastDashIdx + 1) : prefix;
    return {
      ok: false,
      error: `Unknown route "${attemptedRoute}". Valid routes: ${VALID_ROUTES.join(", ")}`,
      expected: VALID_ROUTES.join(", "),
    };
  }

  if (!matchedPaper || !(VALID_PAPERS as readonly string[]).includes(matchedPaper)) {
    return {
      ok: false,
      error: `Unknown paper "${matchedPaper ?? ""}". Valid papers: ${VALID_PAPERS.join(", ")}`,
      expected: VALID_PAPERS.join(", "),
    };
  }

  return {
    ok: true,
    paper: matchedPaper as ValidPaper,
    route: matchedRoute,
    date: dateValidation.date,
    index,
    rawCode: trimmed,
  };
}

/**
 * Formats a parsed participant code or parts record back to standard participant code string.
 */
export function formatParticipantCode(
  parts: ParticipantCodeResult | { paper: string; route: string; date: string; index: number },
): string {
  if ("ok" in parts) {
    if (!parts.ok) {
      throw new Error(`Cannot format invalid participant code: ${parts.error}`);
    }
    const cleanDate = parts.date.replace(/-/g, "");
    const indexStr = parts.index.toString().padStart(2, "0");
    return `${parts.paper}-${parts.route}-${cleanDate}-${indexStr}`;
  }

  const cleanDate = parts.date.replace(/-/g, "");
  const indexStr = parts.index.toString().padStart(2, "0");
  return `${parts.paper}-${parts.route}-${cleanDate}-${indexStr}`;
}
