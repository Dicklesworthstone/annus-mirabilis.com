/**
 * Participant code parser for comprehension and accessibility study rounds.
 * Format: <paper>-<route>-<YYYYMMDD>-<nn>
 * Specification: am-edit-comprehension-protocol-ouih and am-edit-review-records-hofz
 */

export const KNOWN_PAPERS = [
  "light-quanta",
  "brownian-motion",
  "special-relativity",
  "mass-energy",
  "molecular-dimensions",
] as const;

export type PaperSlug = (typeof KNOWN_PAPERS)[number];

export const CLOSED_ROUTE_IDS = [
  "no-algebra",
  "nonvisual",
  "full-derivation",
  "low-cost-phone",
] as const;

export type RouteId = (typeof CLOSED_ROUTE_IDS)[number];

export type ParsedParticipantCode = Readonly<{
  code: string;
  paper: PaperSlug;
  route: RouteId;
  date: string; // ISO date YYYY-MM-DD
  rawDate: string; // YYYYMMDD
  sequence: number;
}>;

export class ParticipantCodeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ParticipantCodeError";
    this.code = code;
  }
}

/**
 * Parses and validates a participant code string.
 * Example: "brownian-motion-nonvisual-20260916-01"
 */
export function parseParticipantCode(rawCode: string): ParsedParticipantCode {
  if (typeof rawCode !== "string") {
    throw new ParticipantCodeError(
      "invalid-participant-code",
      "Participant code must be a string.",
    );
  }

  const trimmed = rawCode.trim();
  if (!trimmed) {
    throw new ParticipantCodeError("empty-participant-code", "Participant code cannot be empty.");
  }

  // Look for matching paper prefix from known papers (sorted descending by length to match longest)
  const sortedPapers = [...KNOWN_PAPERS].sort((a, b) => b.length - a.length);
  const matchedPaper = sortedPapers.find((p) => trimmed.startsWith(`${p}-`));
  if (!matchedPaper) {
    throw new ParticipantCodeError(
      "unknown-paper-in-code",
      `Participant code "${trimmed}" does not start with a recognized paper slug (${KNOWN_PAPERS.join(", ")}).`,
    );
  }

  const restAfterPaper = trimmed.slice(matchedPaper.length + 1);

  // Look for matching route from closed routes
  const sortedRoutes = [...CLOSED_ROUTE_IDS].sort((a, b) => b.length - a.length);
  const matchedRoute = sortedRoutes.find((r) => restAfterPaper.startsWith(`${r}-`));
  if (!matchedRoute) {
    throw new ParticipantCodeError(
      "unknown-route-in-code",
      `Participant code "${trimmed}" does not contain a valid route id (${CLOSED_ROUTE_IDS.join(", ")}).`,
    );
  }

  const restAfterRoute = restAfterPaper.slice(matchedRoute.length + 1);

  // Remaining should be <YYYYMMDD>-<nn>
  const match = /^(\d{8})-(\d{1,3})$/.exec(restAfterRoute);
  if (!match) {
    throw new ParticipantCodeError(
      "malformed-date-or-sequence",
      `Participant code "${trimmed}" has invalid date or sequence format. Expected YYYYMMDD-nn.`,
    );
  }

  const rawDate = match[1];
  const rawSeq = match[2];
  if (!rawDate || !rawSeq) {
    throw new ParticipantCodeError(
      "malformed-date-or-sequence",
      `Participant code "${trimmed}" has missing date or sequence tokens.`,
    );
  }

  const year = Number.parseInt(rawDate.slice(0, 4), 10);
  const month = Number.parseInt(rawDate.slice(4, 6), 10);
  const day = Number.parseInt(rawDate.slice(6, 8), 10);

  if (year < 1900 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new ParticipantCodeError(
      "invalid-date-values",
      `Participant code "${trimmed}" has invalid calendar date ${rawDate}.`,
    );
  }

  const isoDate = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
  const sequence = Number.parseInt(rawSeq, 10);
  if (Number.isNaN(sequence) || sequence < 1) {
    throw new ParticipantCodeError(
      "invalid-sequence",
      `Participant code "${trimmed}" has invalid participant sequence "${rawSeq}".`,
    );
  }

  return {
    code: trimmed,
    paper: matchedPaper,
    route: matchedRoute,
    date: isoDate,
    rawDate,
    sequence,
  };
}
