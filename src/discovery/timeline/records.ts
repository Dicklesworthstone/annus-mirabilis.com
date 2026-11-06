/**
 * The chronology reads the same source cards as the journeys and the same dated receipts as
 * the papers index. It adds no biographical dates, measurements, or claims about influence.
 */
import { join } from "node:path";
import { loadProvenanceReceipts } from "../../content/provenance/loadReceipts.ts";
import type { PaperDate, ReceiptFrontMatter } from "../../content/provenance/receiptSchema.ts";
import { JOURNEY_CARDS } from "../cards/journeyCards.ts";
import type { KnowledgeCard } from "../cards/types.ts";
import {
  availableBeforeBoundary,
  groupTimeline,
  TIMELINE_PAPER_NAMES,
  type TimelineEntry,
  type TimelineSource,
  type TimelineTrack,
} from "./model.ts";

export class TimelineContentError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "TimelineContentError";
    this.code = code;
  }
}

function sourceRecord(source: unknown): TimelineSource {
  if (typeof source === "string") return { title: source, locator: "" };
  const raw = (source ?? {}) as Record<string, unknown>;
  return {
    title: typeof raw.title === "string" ? raw.title : "Source cited by the discovery route",
    locator: typeof raw.locator === "string" ? raw.locator : "",
  };
}

export function knowledgeCardEntry(card: KnowledgeCard, paper: string): TimelineEntry {
  const sources = card.sources.map(sourceRecord);
  return {
    id: card.id,
    track: card.status === "later" ? "later-confirmations" : "long-arc",
    paper,
    date: { ...card.date, kind: card.date.eventKind ?? "available" },
    title: sources[0]?.title ?? card.proposition,
    summary: card.proposition,
    sources,
    links: [
      {
        href: `/discover/${paper}/#card-${card.id}`,
        label: `Follow this source in the ${TIMELINE_PAPER_NAMES[paper]?.toLowerCase() ?? paper} journey`,
      },
      {
        href: `/papers/${paper}/`,
        label: `Read the ${TIMELINE_PAPER_NAMES[paper]?.toLowerCase() ?? paper} paper`,
      },
    ],
    ...(card.limits ? { limits: card.limits } : {}),
    ...(card.priorEvent
      ? { priorEvent: { ...card.priorEvent, kind: card.priorEvent.eventKind } }
      : {}),
    status: card.status,
    admittedImport: Boolean(card.admittedImport),
    ...(card.parallelWorkBasis ? { parallelWorkBasis: card.parallelWorkBasis } : {}),
    beforeBoundary: availableBeforeBoundary(card),
  };
}

export function paperDateEntry(
  paper: string,
  receipt: ReceiptFrontMatter,
  date: PaperDate,
): TimelineEntry {
  // Day-specific publication is earned in the existing receipt, not inferred from an ISO string.
  if (date.precision === "day" && (!date.verifiedAt || !date.confirmedFromScan))
    throw new TimelineContentError(
      "timeline-unconfirmed-paper-day",
      `${receipt.key} ${date.type}: a day-specific timeline date requires the receipt's scan confirmation.`,
    );
  return {
    id: `${paper}-${date.type}`,
    track: "year-1905",
    paper,
    date: { kind: date.type, earliest: date.iso, latest: date.iso, precision: date.precision },
    title: TIMELINE_PAPER_NAMES[paper] ?? receipt.paper.titleEnglishWorking,
    summary: receipt.paper.titleEnglishWorking,
    sources: [
      {
        title: date.source,
        locator: `${receipt.paper.journal.name} (${receipt.paper.journal.series}) ${receipt.paper.journal.volume}, ${receipt.paper.journal.pages.first}–${receipt.paper.journal.pages.last}`,
        href: `https://github.com/Dicklesworthstone/annus-mirabilis.com/blob/main/docs/provenance/${receipt.key}.md`,
      },
    ],
    links: [
      {
        href: `/papers/${paper}/`,
        label: `Read the ${TIMELINE_PAPER_NAMES[paper]?.toLowerCase() ?? paper} paper`,
      },
      {
        href: `/papers/${paper}/view/facsimile/`,
        label: `Open the ${TIMELINE_PAPER_NAMES[paper]?.toLowerCase() ?? paper} journal pages`,
      },
    ],
    ...(date.text ? { printedDateLine: date.text } : {}),
    beforeBoundary: false,
  };
}

export type Timeline = Readonly<{
  entries: readonly TimelineEntry[];
  tracks: readonly TimelineTrack[];
}>;

export function assembleTimeline(entries: readonly TimelineEntry[]): Timeline {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id))
      throw new TimelineContentError(
        "timeline-duplicate-anchor",
        `Two timeline entries would publish the same anchor t-${entry.id}.`,
      );
    seen.add(entry.id);
  }
  return { entries, tracks: groupTimeline(entries) };
}

export function loadTimeline(root: string = process.cwd()): Timeline {
  const loaded = loadProvenanceReceipts({
    provenanceDir: join(root, "docs", "provenance"),
    rootDir: root,
    requireLocal: false,
  });
  const entries: TimelineEntry[] = [];
  for (const { journey, cards } of JOURNEY_CARDS) {
    const receipt = loaded.receipts.find((entry) => entry.receipt?.frontMatter.slug === journey)
      ?.receipt?.frontMatter;
    if (!receipt || receipt.paper.dates.length === 0)
      throw new TimelineContentError(
        "timeline-missing-paper-dates",
        `The timeline requires the dated provenance receipt for ${journey}.`,
      );
    entries.push(...receipt.paper.dates.map((date) => paperDateEntry(journey, receipt, date)));
    entries.push(...cards.map((card) => knowledgeCardEntry(card, journey)));
  }
  return assembleTimeline(entries);
}
