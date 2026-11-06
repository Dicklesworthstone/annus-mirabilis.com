/** The chronology projects existing dates without turning a month or year into an invented day. */
import { evaluateShelfDate, SHELF_CUTOFF_YEAR } from "../../content/checks/epistemic/shelfDate.ts";
import type { PaperDateType } from "../../content/provenance/receiptSchema.ts";
import type { KnowledgeCard, PremiseEventKind } from "../cards/types.ts";

export { SHELF_CUTOFF_YEAR };

export const TIMELINE_TRACK_IDS = ["year-1905", "long-arc", "later-confirmations"] as const;
export type TimelineTrackId = (typeof TIMELINE_TRACK_IDS)[number];
export type TimelineDateKind = PaperDateType | PremiseEventKind | "available";
export type TimelineDate = Readonly<{
  kind: TimelineDateKind;
  earliest: string;
  latest: string;
  precision: "day" | "month" | "year" | "range";
}>;
export type TimelineSource = Readonly<{ title: string; locator: string; href?: string }>;
export type TimelineLink = Readonly<{ href: string; label: string }>;
export type TimelineEntry = Readonly<{
  /** The public anchor is t-<id>; source-card ids and paper/date-kind pairs remain stable. */
  id: string;
  track: TimelineTrackId;
  paper: string;
  date: TimelineDate;
  title: string;
  summary: string;
  sources: readonly TimelineSource[];
  links: readonly TimelineLink[];
  limits?: string;
  printedDateLine?: string;
  priorEvent?: TimelineDate;
  status?: KnowledgeCard["status"];
  admittedImport?: boolean;
  parallelWorkBasis?: string;
  /** Uses the existing shelf rule; no independent timeline cutoff decides availability. */
  beforeBoundary: boolean;
}>;
export type TimelineTrack = Readonly<{
  id: TimelineTrackId;
  title: string;
  description: string;
  entries: readonly TimelineEntry[];
  span: string;
}>;

export const TIMELINE_TRACKS: Readonly<
  Record<TimelineTrackId, Readonly<{ title: string; description: string }>>
> = {
  "year-1905": {
    title: "The 1905 papers",
    description:
      "The date printed by the author, the journal's receipt date, and the issue's publication date answer different questions. Each keeps its own label here.",
  },
  "long-arc": {
    title: "The long arc",
    description:
      "The observations and arguments on the discovery routes' shelves, followed by the work those routes explicitly bring in from 1905. Availability does not establish what Einstein read.",
  },
  "later-confirmations": {
    title: "Later evidence",
    description:
      "The observations and arguments the discovery routes discuss after the 1905 papers. Their limits say which claim each addresses and what the comparison leaves open.",
  },
};

export const TIMELINE_PAPER_NAMES: Readonly<Record<string, string>> = {
  "light-quanta": "Light quanta",
  "brownian-motion": "Brownian motion",
  "special-relativity": "Special relativity",
  "mass-energy": "Mass and energy",
};

const KIND_LABELS: Readonly<Record<TimelineDateKind, string>> = {
  "date-line": "Manuscript date-line",
  received: "Received by the journal",
  "issue-publication": "Issue published",
  submitted: "Submitted",
  "later-edition": "Later edition",
  presented: "Presented",
  published: "Published",
  performed: "Experiment performed",
  available: "Dated source",
};
export const dateKindLabel = (kind: TimelineDateKind): string => KIND_LABELS[kind];

const MONTHS = [
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

function endpointLabel(value: string, precision: TimelineDate["precision"]): string {
  const [year, month, day] = value.split("-");
  if (precision === "year" || !month) return year ?? value;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName) return value;
  if (precision === "month" || !day) return `${monthName} ${year}`;
  return `${Number(day)} ${monthName} ${year}`;
}

export function formatTimelineDate(date: TimelineDate): string {
  const first = endpointLabel(date.earliest, date.precision);
  const last = endpointLabel(date.latest, date.precision);
  return first === last ? first : `${first}–${last}`;
}

/** Bounds are for ordering only. The displayed date always retains its recorded precision. */
export function timelineDateBound(date: TimelineDate, side: "earliest" | "latest"): string {
  const value = date[side];
  const [year = "", month, day] = value.split("-");
  if (!month) return `${year}-${side === "earliest" ? "01-01" : "12-31"}`;
  if (day) return value;
  if (side === "earliest") return `${year}-${month}-01`;
  const y = Number(year);
  const days =
    Number(month) === 2
      ? y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
        ? 29
        : 28
      : [4, 6, 9, 11].includes(Number(month))
        ? 30
        : 31;
  return `${year}-${month}-${days}`;
}

export function compareTimelineEntries(a: TimelineEntry, b: TimelineEntry): number {
  const first = timelineDateBound(a.date, "earliest").localeCompare(
    timelineDateBound(b.date, "earliest"),
  );
  if (first !== 0) return first;
  const last = timelineDateBound(a.date, "latest").localeCompare(
    timelineDateBound(b.date, "latest"),
  );
  return last || a.id.localeCompare(b.id);
}

/** Span follows the current members, including the end of the widest overlapping interval. */
export function timelineSpan(entries: readonly TimelineEntry[]): string {
  if (entries.length === 0) return "No dated entries";
  let first = entries[0] as TimelineEntry;
  let last = first;
  for (const entry of entries) {
    if (timelineDateBound(entry.date, "earliest") < timelineDateBound(first.date, "earliest"))
      first = entry;
    if (timelineDateBound(entry.date, "latest") > timelineDateBound(last.date, "latest"))
      last = entry;
  }
  const start = endpointLabel(first.date.earliest, first.date.precision);
  const end = endpointLabel(last.date.latest, last.date.precision);
  return start === end ? start : `${start} to ${end}`;
}

export function availableBeforeBoundary(card: KnowledgeCard): boolean {
  const decision = evaluateShelfDate(
    { id: "timeline-boundary", kind: "shelf" },
    {
      id: card.id,
      status: card.status,
      latestYear: card.date.latestYear,
      admittedImport: card.admittedImport,
    },
  );
  return decision.ok && decision.reason === "available-by-1904";
}

export function groupTimeline(entries: readonly TimelineEntry[]): readonly TimelineTrack[] {
  return TIMELINE_TRACK_IDS.map((id) => {
    const members = entries.filter((entry) => entry.track === id).sort(compareTimelineEntries);
    return { id, ...TIMELINE_TRACKS[id], entries: members, span: timelineSpan(members) };
  });
}
