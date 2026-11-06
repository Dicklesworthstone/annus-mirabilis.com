import { evaluateShelfDate } from "../../content/checks/epistemic/shelfDate.ts";
import type { JourneyShelf } from "../cards/journeyCards.ts";
import type { KnowledgeCard } from "../cards/types.ts";
import { ROUTE_INDEX } from "../routeIndex.ts";
import { timelineDateBound } from "../timeline/model.ts";

export const DESK_OBJECT_IDS = [
  "object-spectrum",
  "object-microscope",
  "object-clocks",
  "object-conductor-magnet",
  "object-energy-ledger",
] as const;
export type DeskObjectId = (typeof DESK_OBJECT_IDS)[number];
export const DESK_QUESTIONS = [
  "What could you actually measure?",
  "What interpretation would you be tempted to put on that measurement?",
  "Which further measurement or argument would distinguish that interpretation from another?",
] as const;
export const DESK_EXPERIMENT_IDS = [
  "lq-02",
  "signed-displacement",
  "sr-04",
  "shelf-michelson-morley",
  "shelf-fizeau",
  "shelf-maxwell-galilean",
] as const;
export type DeskExperimentId = (typeof DESK_EXPERIMENT_IDS)[number];
export const DESK_TIMELINE_BOUNDARY = "/timeline/#t-boundary-1904";
export type DeskObject = Readonly<{
  id: DeskObjectId;
  title: string;
  question: string;
  description: string;
  unresolved: string;
  responses: readonly [string, string, string];
  cardIds: readonly string[];
  foundations: readonly string[];
  experiments: readonly DeskExperimentId[];
  journey: string;
}>;
export type DeskCatalogueEntry = Readonly<{
  card: KnowledgeCard;
  journeys: readonly string[];
  objectIds: readonly DeskObjectId[];
}>;
export type DeskFilter = Readonly<{
  object: string;
  status: string;
  from: string;
  to: string;
}>;
export const DEFAULT_DESK_FILTER: DeskFilter = Object.freeze({
  object: "all",
  status: "all",
  from: "",
  to: "",
});
export type DeskFilterEntry = Readonly<{
  id: string;
  objectIds: readonly DeskObjectId[];
  status: KnowledgeCard["status"];
  earliestYear: number;
  latestYear: number;
}>;

/** The existing shelf rule decides eligibility; the desk never admits a journey's 1905 import. */
export function deskCatalogue(
  shelves: readonly JourneyShelf[],
  objects: readonly DeskObject[],
): readonly DeskCatalogueEntry[] {
  const entries = new Map<
    string,
    { card: KnowledgeCard; journeys: string[]; objectIds: DeskObjectId[] }
  >();
  for (const shelf of shelves)
    for (const card of shelf.shelf) {
      if (card.status === "later" || card.admittedImport) continue;
      const decision = evaluateShelfDate(
        { id: "desk-1904", kind: "shelf", parallelWorkAcknowledged: true },
        { ...card, latestYear: card.date.latestYear },
      );
      if (!decision.ok) throw new Error(`1904 desk cannot admit ${card.id}: ${decision.reason}`);
      const existing = entries.get(card.id);
      if (existing) {
        if (JSON.stringify(existing.card) !== JSON.stringify(card))
          throw new Error(`1904 desk has conflicting cards for ${card.id}`);
        if (!existing.journeys.includes(shelf.journey)) existing.journeys.push(shelf.journey);
      } else entries.set(card.id, { card, journeys: [shelf.journey], objectIds: [] });
    }
  for (const object of objects)
    for (const id of object.cardIds) {
      const entry = entries.get(id);
      if (!entry)
        throw new Error(
          `1904 desk ${object.id} refers to an unknown, later or imported card: ${id}`,
        );
      if (!entry.objectIds.includes(object.id)) entry.objectIds.push(object.id);
    }
  for (const entry of entries.values())
    if (!entry.objectIds.length)
      throw new Error(`1904 desk card ${entry.card.id} belongs to no object`);
  return [...entries.values()].sort((a, b) => {
    const date = (card: KnowledgeCard) =>
      ({ ...card.date, kind: card.date.eventKind ?? "available" }) as const;
    return (
      timelineDateBound(date(a.card), "earliest").localeCompare(
        timelineDateBound(date(b.card), "earliest"),
      ) || a.card.id.localeCompare(b.card.id)
    );
  });
}

export function deskFilterEntry(entry: DeskCatalogueEntry): DeskFilterEntry {
  return {
    id: entry.card.id,
    objectIds: entry.objectIds,
    status: entry.card.status,
    earliestYear: Number(entry.card.date.earliest.slice(0, 4)),
    latestYear: entry.card.date.latestYear,
  };
}

/** Inclusive overlap preserves a range-dated source instead of inventing a day within it. */
export function matchesDeskFilter(entry: DeskFilterEntry, filter: DeskFilter): boolean {
  if (filter.object !== "all" && !entry.objectIds.some((id) => id === filter.object)) return false;
  if (filter.status !== "all" && entry.status !== filter.status) return false;
  const from = /^\d{1,4}$/.test(filter.from) ? Number(filter.from) : undefined;
  const to = /^\d{1,4}$/.test(filter.to) ? Number(filter.to) : undefined;
  if (from !== undefined && to !== undefined && from > to) return false;
  return (
    (from === undefined || entry.latestYear >= from) &&
    (to === undefined || entry.earliestYear <= to)
  );
}

export function deskSourceTitle(card: KnowledgeCard): string {
  const source = card.sources[0];
  if (typeof source === "string") return source;
  if (source && typeof source === "object" && "title" in source && typeof source.title === "string")
    return source.title;
  return card.proposition;
}

/** CardDetail already interprets stage-03 as step 3; publish the actual route's step address. */
export function deskJourneyStageLinks(card: KnowledgeCard, journey: string) {
  const route = ROUTE_INDEX.find((route) => route.slug === journey);
  if (!route) throw new Error(`1904 desk: unknown journey ${journey}`);
  return (card.admittedStages ?? []).map((stage) => {
    const match = /^(?:stage|step)-(\d{2})$/.exec(stage);
    const number = Number(match?.[1]);
    const title = route.steps[number - 1];
    if (!match || !title)
      throw new Error(`1904 desk: ${card.id} refers to unknown ${journey} stage ${stage}`);
    return {
      href: `/discover/${journey}/#step-${match[1]}`,
      label: `${route.name}, step ${number}: ${title}`,
    };
  });
}
